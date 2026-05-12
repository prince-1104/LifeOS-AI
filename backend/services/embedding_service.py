"""
Embedding service: converts text to vector embeddings.

Primary: OpenAI text-embedding-3-small (2s timeout).
Fallback: Google Gemini text-embedding-004.
"""

import asyncio
import logging

from google import genai
from openai import AsyncOpenAI

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
_gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)

OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
GEMINI_EMBEDDING_MODEL = "text-embedding-004"

# Timeout for OpenAI before switching to Gemini (seconds)
OPENAI_TIMEOUT_SECONDS = 2


async def get_embedding(text: str) -> list[float]:
    """Return a vector embedding for the given text.

    Tries OpenAI first; falls back to Gemini on timeout or error.
    """
    try:
        response = await asyncio.wait_for(
            _openai_client.embeddings.create(
                input=text,
                model=OPENAI_EMBEDDING_MODEL,
            ),
            timeout=OPENAI_TIMEOUT_SECONDS,
        )
        return response.data[0].embedding

    except asyncio.TimeoutError:
        logger.warning(
            "get_embedding: OpenAI timed out after %ss — falling back to Gemini",
            OPENAI_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        logger.warning(
            "get_embedding: OpenAI failed (%s: %s) — falling back to Gemini",
            type(exc).__name__,
            exc,
        )

    # Gemini fallback
    result = await _gemini_client.aio.models.embed_content(
        model=GEMINI_EMBEDDING_MODEL,
        contents=text,
    )
    return result.embeddings[0].values
