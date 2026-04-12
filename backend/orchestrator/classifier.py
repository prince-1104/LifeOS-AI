"""
Legacy rule-based classifier (regex + Gemini fallback).

Production routing uses orchestrator_llm.classify_llm + router.route instead.
Kept for reference or experiments only.
"""

import re

from services.llm_service import classify_input as llm_classify

MEMORY_PATTERNS = [
    r"\bremember\b",
    r"\bnote\s+that\b",
    r"\bsave\b",
    r"\bkeep\s+in\s+mind\b",
    r"\bdon'?t\s+forget\b",
    r"\bstore\b",
    r"\brecord\b",
    r"\bjot\s+down\b",
    r"\bmake\s+a\s+note\b",
]

QUERY_PATTERNS = [
    r"^(where|what|when|how|who|which|why)\b",
    r"\bdid\s+i\b",
    r"\bdo\s+i\s+have\b",
    r"\bfind\b",
    r"\btell\s+me\b",
    r"\bshow\s+me\b",
    r"\brecall\b",
    r"\bwhat('?s| is| are| was| were)\b",
    r"\?$",
]


def _match_patterns(text: str, patterns: list[str]) -> bool:
    for pattern in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False


async def classify(text: str) -> str:
    """Classify user input as 'memory' or 'query'. Rule-based with LLM fallback."""
    lower = text.strip().lower()

    is_memory = _match_patterns(lower, MEMORY_PATTERNS)
    is_query = _match_patterns(lower, QUERY_PATTERNS)

    if is_memory and not is_query:
        return "memory"
    if is_query and not is_memory:
        return "query"

    # Ambiguous or no match — fall back to Gemini
    return await llm_classify(text)
