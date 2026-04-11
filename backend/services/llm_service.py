import json

from google import genai
from google.genai import types

from config import get_settings

settings = get_settings()
_client = genai.Client(api_key=settings.GEMINI_API_KEY)

MODEL = "gemini-2.0-flash"


async def classify_input(text: str) -> str:
    """Classify user input as 'memory' or 'query'. Used only as fallback."""
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
    return parsed.get("type", "query")


async def parse_memory(text: str) -> dict:
    """Extract structured memory content and tags from user input."""
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
    return json.loads(response.text)
