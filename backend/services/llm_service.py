import json
import logging

from google import genai
from google.genai import types

from config import get_settings

settings = get_settings()
_client = genai.Client(api_key=settings.GEMINI_API_KEY)

MODEL = "gemini-2.0-flash"

logger = logging.getLogger(__name__)


async def classify_input(text: str) -> tuple[str, dict]:
    """Classify user input as 'memory' or 'query'. Used only as fallback.

    Returns (classification_type, usage_dict).
    """
    response = await _client.aio.models.generate_content(
        model=MODEL,
        contents=text,
        config=types.GenerateContentConfig(
            system_instruction=(
                "You are a classifier. Given user input, respond with ONLY "
                'a JSON object: {"type": "memory"} if the user wants to store/remember '
                'something, or {"type": "query"} if the user is asking a question. '
                "No other text."
            ),
            response_mime_type="application/json",
        ),
    )
    parsed = json.loads(response.text)

    # Extract token usage from Gemini response
    usage = _extract_gemini_usage(response, MODEL, "classify_input")

    return parsed.get("type", "query"), usage


async def parse_memory(text: str) -> tuple[dict, dict]:
    """Extract structured memory content and tags from user input.

    Returns (parsed_memory_dict, usage_dict).
    """
    response = await _client.aio.models.generate_content(
        model=MODEL,
        contents=text,
        config=types.GenerateContentConfig(
            system_instruction=(
                "You are a memory parser. Given user input, extract the core fact "
                "and return a JSON object with:\n"
                '- "content": the cleaned-up fact (concise, third-person)\n'
                '- "tags": a list of 1-5 relevant single-word tags\n'
                "Example input: 'remember my keys are under the table'\n"
                'Example output: {"content": "keys are under the table", '
                '"tags": ["keys", "location", "table"]}\n'
                "Respond with ONLY the JSON object."
            ),
            response_mime_type="application/json",
        ),
    )
    parsed = json.loads(response.text)

    # Extract token usage from Gemini response
    usage = _extract_gemini_usage(response, MODEL, "parse_memory")

    return parsed, usage


def _extract_gemini_usage(response, model: str, endpoint: str) -> dict:
    """Extract token usage from a Gemini response object."""
    usage = {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "model": model,
        "provider": "gemini",
        "endpoint": endpoint,
    }
    try:
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            meta = response.usage_metadata
            usage["prompt_tokens"] = getattr(meta, "prompt_token_count", 0) or 0
            usage["completion_tokens"] = getattr(meta, "candidates_token_count", 0) or 0
            usage["total_tokens"] = getattr(meta, "total_token_count", 0) or 0
    except Exception:
        logger.debug("Failed to extract Gemini usage metadata")
    return usage
