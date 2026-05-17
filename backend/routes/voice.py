"""
Voice I/O routes — transcribe (STT), speak (TTS), and full voice pipeline.

Uses Gemini 2.0 Flash for transcription and Google Translate TTS for speech synthesis.
"""

import io
import logging
import uuid
import base64
import urllib.parse
import httpx
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from google import genai
from google.genai import types

from auth.deps import get_current_user
from config import get_settings
from db.postgres import get_db
from services.process_service import process_input
from services.user_sync import ensure_user_exists

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])

_settings = get_settings()
_gemini_client = genai.Client(api_key=_settings.GEMINI_API_KEY)


def chunk_text(text: str, limit: int = 150):
    words = text.split()
    chunks = []
    current = []
    current_len = 0
    for w in words:
        if current_len + len(w) + 1 > limit:
            chunks.append(" ".join(current))
            current = [w]
            current_len = len(w)
        else:
            current.append(w)
            current_len += len(w) + 1
    if current:
        chunks.append(" ".join(current))
    return chunks


async def _google_tts(text: str) -> bytes:
    chunks = chunk_text(text, 150)
    audio_data = b""
    async with httpx.AsyncClient() as client:
        for chunk in chunks:
            url = f"https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q={urllib.parse.quote(chunk)}"
            res = await client.get(url)
            if res.status_code == 200:
                audio_data += res.content
    return audio_data


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Convert audio → text using Gemini."""
    from services.subscription_service import get_user_plan_config, check_feature_access

    _, plan_config = await get_user_plan_config(db, user.id)
    voice_check = check_feature_access(plan_config, "voice_input")
    if not voice_check.allowed:
        return {"success": False, "text": "", "error": voice_check.upgrade_message}

    audio_bytes = await audio.read()
    filename = audio.filename or "recording.webm"
    mime_type = "audio/mp4" if "m4a" in filename else "audio/webm"

    try:
        response = await _gemini_client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                "Transcribe this audio exactly as it is spoken in its original language (e.g. Hindi or English). Do not add any extra commentary or translation. Output ONLY the transcription."
            ],
        )
        return {"success": True, "text": response.text.strip()}
    except Exception as exc:
        logger.exception("Gemini transcription failed")
        return {
            "success": False,
            "text": "",
            "error": "Voice transcription is temporarily unavailable. Please try text input.",
        }


@router.post("/speak")
async def speak(
    text: str = Form(...),
    voice: str = Form("nova"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Convert text → speech using Google TTS. Returns audio/mpeg stream."""
    from services.subscription_service import get_user_plan_config, check_feature_access

    _, plan_config = await get_user_plan_config(db, user.id)
    tts_check = check_feature_access(plan_config, "premium_tts")
    if not tts_check.allowed:
        return {"success": False, "error": tts_check.upgrade_message}

    try:
        audio_bytes = await _google_tts(text[:4096])
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
        return {
            "success": False,
            "error": "Text-to-speech is temporarily unavailable. Please read the response as text.",
        }


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
    """
    await ensure_user_exists(db, user)
    user_id = user.id
    request_id = str(uuid.uuid4())

    from services.subscription_service import get_user_plan_config, check_feature_access

    _, plan_config = await get_user_plan_config(db, user_id)
    voice_check = check_feature_access(plan_config, "voice_input")
    if not voice_check.allowed:
        return {
            "success": False,
            "transcript": "",
            "response": voice_check.upgrade_message,
            "type": "limit",
            "data": None,
            "audio_base64": None,
        }

    audio_bytes = await audio.read()
    filename = audio.filename or "recording.webm"
    mime_type = "audio/mp4" if "m4a" in filename else "audio/webm"

    import time as _time

    try:
        t_stt = _time.perf_counter()
        response = await _gemini_client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                "Transcribe this audio exactly as it is spoken in its original language (e.g. Hindi or English). Do not add any extra commentary or translation. Output ONLY the transcription."
            ],
        )
        stt_ms = (_time.perf_counter() - t_stt) * 1000.0
        transcribed_text = response.text.strip()

        try:
            total_tokens = 0
            if hasattr(response, "usage_metadata") and response.usage_metadata:
                total_tokens = getattr(response.usage_metadata, "total_token_count", 0) or 0
            
            # Gemini cost is negligible for audio compared to Whisper, but log usage
            from services.usage_service import log_token_usage
            await log_token_usage(
                db,
                request_id=request_id,
                user_id=user_id,
                model="gemini-2.0-flash",
                prompt_tokens=total_tokens,
                completion_tokens=0,
                total_tokens=total_tokens,
                endpoint="/voice/process:stt",
                latency_ms=stt_ms,
            )
            await db.commit()
        except Exception:
            logger.debug("Failed to log STT cost (non-fatal)")

    except Exception as exc:
        logger.exception("Voice pipeline: transcription failed")
        return {
            "success": False,
            "transcript": "",
            "response": "Voice input is temporarily unavailable. Please type your message instead.",
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

    audio_base64 = None
    if tts and response_text and plan_config.premium_tts:
        try:
            clean_text = _clean_for_tts(response_text)
            t_tts = _time.perf_counter()
            audio_bytes_tts = await _google_tts(clean_text[:4096])
            tts_ms = (_time.perf_counter() - t_tts) * 1000.0
            audio_base64 = base64.b64encode(audio_bytes_tts).decode("utf-8")

            try:
                char_count = len(clean_text[:4096])
                from services.usage_service import log_token_usage
                await log_token_usage(
                    db,
                    request_id=request_id,
                    user_id=user_id,
                    model="google-tts",
                    prompt_tokens=char_count,
                    completion_tokens=0,
                    total_tokens=char_count,
                    endpoint="/voice/process:tts",
                    latency_ms=tts_ms,
                )
                await db.commit()
            except Exception:
                logger.debug("Failed to log TTS cost (non-fatal)")

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
    # Remove common emojis
    text = re.sub(
        r"[💰🧠⏰🔍❌💬💵📊📋📅💸📈📉🏷️✅⏳🤖💊📞🛒💳🎂🏋️📚☕🍕🚕🏠█]",
        "",
        text,
    )
    # Collapse multiple spaces/newlines
    text = re.sub(r"\n+", ". ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()
