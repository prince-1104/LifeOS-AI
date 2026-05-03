"""
Voice I/O routes — transcribe (STT), speak (TTS), and full voice pipeline.

Uses OpenAI Whisper for transcription and OpenAI TTS for speech synthesis.
"""

import io
import logging
import uuid
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from auth.deps import get_current_user
from config import get_settings
from db.postgres import get_db
from services.process_service import process_input
from services.user_sync import ensure_user_exists

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])

_settings = get_settings()
_client = AsyncOpenAI(api_key=_settings.OPENAI_API_KEY)


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    user=Depends(get_current_user),
):
    """Convert audio → text using OpenAI Whisper."""
    audio_bytes = await audio.read()
    # Whisper expects a file-like object with a name attribute
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = audio.filename or "recording.webm"

    try:
        transcript = await _client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="en",  # auto-detects Hindi/English
        )
        return {"success": True, "text": transcript.text}
    except Exception as exc:
        logger.exception("Whisper transcription failed")
        return {"success": False, "text": "", "error": str(exc)}


@router.post("/speak")
async def speak(
    text: str = Form(...),
    voice: str = Form("nova"),
    user=Depends(get_current_user),
):
    """Convert text → speech using OpenAI TTS. Returns audio/mpeg stream."""
    try:
        response = await _client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=text[:4096],  # TTS limit
            response_format="mp3",
        )

        # Stream the audio bytes
        audio_bytes = response.content
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=response.mp3",
                "Cache-Control": "no-cache",
            },
        )
    except Exception as exc:
        logger.exception("TTS generation failed")
        return {"success": False, "error": str(exc)}


@router.post("/process")
async def voice_process(
    audio: UploadFile = File(...),
    user_timezone: str = Form(None),
    voice: str = Form("nova"),
    tts: bool = Form(True),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Full voice pipeline: Audio → Transcribe → Process → TTS response.

    Returns JSON with transcript + text response, and optionally an audio_url
    for the TTS response.
    """
    await ensure_user_exists(db, user)
    user_id = user.id
    request_id = str(uuid.uuid4())

    # Step 1: Transcribe
    audio_bytes = await audio.read()
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = audio.filename or "recording.webm"

    try:
        transcript = await _client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
        )
        transcribed_text = transcript.text.strip()
    except Exception as exc:
        logger.exception("Voice pipeline: transcription failed")
        return {
            "success": False,
            "transcript": "",
            "response": "Sorry, I couldn't understand the audio. Please try again.",
            "type": "error",
            "data": None,
            "audio_base64": None,
        }

    if not transcribed_text:
        return {
            "success": False,
            "transcript": "",
            "response": "I couldn't hear anything. Please try speaking again.",
            "type": "error",
            "data": None,
            "audio_base64": None,
        }

    # Step 2: Process through existing pipeline
    tz: ZoneInfo | None = None
    if user_timezone:
        tz_str = user_timezone
        if tz_str.upper() == "IST" or tz_str == "Asia/Calcutta":
            tz_str = "Asia/Kolkata"
        try:
            tz = ZoneInfo(tz_str)
        except Exception:
            tz = ZoneInfo("Asia/Kolkata")
    else:
        tz = ZoneInfo("Asia/Kolkata")

    result = await process_input(
        user_id,
        transcribed_text,
        db,
        request_id=request_id,
        user_timezone=tz,
        user_name=user.first_name,
    )

    response_text = result.get("response", "")

    # Step 3: Generate TTS if requested
    import base64

    audio_base64 = None
    if tts and response_text:
        try:
            # Clean markdown formatting for better TTS
            clean_text = _clean_for_tts(response_text)
            tts_response = await _client.audio.speech.create(
                model="tts-1",
                voice=voice,
                input=clean_text[:4096],
                response_format="mp3",
            )
            audio_base64 = base64.b64encode(tts_response.content).decode("utf-8")
        except Exception:
            logger.exception("Voice pipeline: TTS failed (non-fatal)")

    return {
        "success": result.get("success", False),
        "transcript": transcribed_text,
        "response": response_text,
        "type": result.get("type", "unknown"),
        "data": result.get("data"),
        "audio_base64": audio_base64,
    }


def _clean_for_tts(text: str) -> str:
    """Strip markdown/emoji for cleaner TTS output."""
    import re

    # Remove markdown bold/italic
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    # Remove common emojis (keep the text around them)
    text = re.sub(
        r"[💰🧠⏰🔍❌💬💵📊📋📅💸📈📉🏷️✅⏳🤖💊📞🛒💳🎂🏋️📚☕🍕🚕🏠█]",
        "",
        text,
    )
    # Collapse multiple spaces/newlines
    text = re.sub(r"\n+", ". ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()
