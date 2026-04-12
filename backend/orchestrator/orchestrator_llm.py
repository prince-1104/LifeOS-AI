"""
LLM orchestrator: returns structured JSON only. Does not execute tools or DB.
Single OpenAI call per classify_llm (~300–800ms). Query execution after routing stays non-LLM.
"""

import json

from openai import AsyncOpenAI
from pydantic import ValidationError

from config import get_settings
from schemas import OrchestratorOutput

settings = get_settings()
_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

SYSTEM_PROMPT = """You are an AI orchestrator for a personal life assistant system.

Your job is to analyze user input and return structured JSON.

You MUST classify input into one of these types:
- memory
- query
- finance
- reminder
- unknown

Rules:
- Output ONLY valid JSON
- No explanation
- Extract structured data when possible
- Keep values clean and minimal

Examples:

Input: "remember my keys are under the table"
Output:
{
  "type": "memory",
  "content": "keys under table",
  "tags": ["keys", "location"]
}

Input: "where are my keys"
Output:
{
  "type": "query",
  "query": "keys location"
}

Input: "I spent 200 on food"
Output:
{
  "type": "finance",
  "amount": 200,
  "category": "food"
}

Input: "remind me at 7pm to go gym"
Output:
{
  "type": "reminder",
  "task": "go gym",
  "time": "19:00"
}
"""


async def classify_llm(user_input: str) -> OrchestratorOutput:
    response = await _client.chat.completions.create(
        model=settings.ORCHESTRATOR_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_input},
        ],
        temperature=0,
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content
    if not raw:
        return OrchestratorOutput(type="unknown")

    try:
        data = json.loads(raw)
        return OrchestratorOutput.model_validate(data)
    except (json.JSONDecodeError, ValidationError, ValueError):
        return OrchestratorOutput(type="unknown")
