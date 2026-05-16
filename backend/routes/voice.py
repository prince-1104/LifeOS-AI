"""
Voice I/O routes — transcribe (STT), speak (TTS), and full voice pipeline.

Uses OpenAI Whisper for transcription and OpenAI TTS for speech synthesis.
Note: Voice features require OpenAI. If OpenAI is unavailable (quota/key issue),
these endpoints return a clear error — there is no Gemini equivalent for audio.
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
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Convert audio → text using OpenAI Whisper."""
    from services.subscription_service import get_user_plan_config, check_feature_access

    _, plan_config = await get_user_plan_config(db, user.id)
    voice_check = check_feature_access(plan_config, "voice_input")
    if not voice_check.allowed:
        return {"success": False, "text": "", "error": voice_check.upgrade_message}

    audio_bytes = await audio.read()
    # Whisper expects a file-like object with a name attribute
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = audio.filename or "recording.webm"

    try:
        transcript = await _client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            # No language parameter — let Whisper auto-detect (supports Hindi + English)
        )
        return {"success": True, "text": transcript.text}
    except Exception as exc:
        logger.exception("Whisper transcription failed (OpenAI unavailable)")
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
    """Convert text → speech using OpenAI TTS. Returns audio/mpeg stream."""
    from services.subscription_service import get_user_plan_config, check_feature_access

    _, plan_config = await get_user_plan_config(db, user.id)
    tts_check = check_feature_access(plan_config, "premium_tts")
    if not tts_check.allowed:
        return {"success": False, "error": tts_check.upgrade_message}

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
        logger.exception("TTS generation failed (OpenAI unavailable)")
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

    Returns JSON with transcript + text response, and optionally an audio_url
    for the TTS response.
    """
    await ensure_user_exists(db, user)
    user_id = user.id
    request_id = str(uuid.uuid4())

    # ── Plan-based voice access check ─────────────────────────────────
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

    # Step 1: Transcribe
    audio_bytes = await audio.read()
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = audio.filename or "recording.webm"

    import time as _time

    try:
        t_stt = _time.perf_counter()
        transcript = await _client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
        )
        stt_ms = (_time.perf_counter() - t_stt) * 1000.0
        transcribed_text = transcript.text.strip()

        # ── Log STT cost ──────────────────────────────────────────────
        # Whisper charges $0.006 per minute of audio.
        # Estimate duration from file size (~16KB/sec for m4a at 128kbps).
        try:
            estimated_seconds = max(len(audio_bytes) / 16000, 1)
            estimated_minutes = estimated_seconds / 60
            # Convert to pseudo-tokens for cost tracking (1 "token" = cost equivalent)
            stt_cost_usd = estimated_minutes * 0.006
            settings = get_settings()
            stt_cost_inr = stt_cost_usd * settings.INR_PER_USD

            from services.usage_service import log_token_usage
            from services.subscription_service import add_daily_cost
            await log_token_usage(
                db,
                request_id=request_id,
                user_id=user_id,
                model="whisper-1",
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=int(estimated_seconds),  # track seconds as pseudo-tokens
                endpoint="/voice/process:stt",
                latency_ms=stt_ms,
            )
            await add_daily_cost(db, user_id, int(estimated_seconds), stt_cost_inr)
            await db.commit()
        except Exception:
            logger.debug("Failed to log STT cost (non-fatal)")

    except Exception as exc:
        logger.exception("Voice pipeline: transcription failed (OpenAI unavailable)")
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

    # Step 3: Generate TTS if requested AND plan supports it
    import base64

    audio_base64 = None
    if tts and response_text and plan_config.premium_tts:
        try:
            # Clean markdown formatting for better TTS
            clean_text = _clean_for_tts(response_text)
            t_tts = _time.perf_counter()
            tts_response = await _client.audio.speech.create(
                model="tts-1",
                voice=voice,
                input=clean_text[:4096],
                response_format="mp3",
            )
            tts_ms = (_time.perf_counter() - t_tts) * 1000.0
            audio_base64 = base64.b64encode(tts_response.content).decode("utf-8")

            # ── Log TTS cost ──────────────────────────────────────────
            # TTS-1 charges $15 per 1M characters.
            try:
                char_count = len(clean_text[:4096])
                tts_cost_usd = (char_count / 1_000_000) * 15.0
                settings = get_settings()
                tts_cost_inr = tts_cost_usd * settings.INR_PER_USD

                from services.usage_service import log_token_usage
                from services.subscription_service import add_daily_cost
                await log_token_usage(
                    db,
                    request_id=request_id,
                    user_id=user_id,
                    model="tts-1",
                    prompt_tokens=char_count,
                    completion_tokens=0,
                    total_tokens=char_count,
                    endpoint="/voice/process:tts",
                    latency_ms=tts_ms,
                )
                await add_daily_cost(db, user_id, char_count, tts_cost_inr)
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
