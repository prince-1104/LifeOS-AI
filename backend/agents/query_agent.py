import re

from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from services.db_service import DBService
from services.memory_service import search_memory_payloads

settings = get_settings()

_STOPWORDS = frozenset(
    {
        "a",
        "an",
        "are",
        "did",
        "do",
        "does",
        "how",
        "is",
        "it",
        "my",
        "of",
        "on",
        "the",
        "to",
        "was",
        "were",
        "what",
        "when",
        "where",
        "which",
        "who",
        "why",
    }
)


def _query_tokens(query: str) -> list[str]:
    raw = re.findall(r"[a-zA-Z0-9]+", query.lower())
    return [t for t in raw if t not in _STOPWORDS and len(t) > 0]


def _token_matches_content(content: str, token: str) -> bool:
    if token in content:
        return True
    if len(token) > 2 and token.endswith("s") and token[:-1] in content:
        return True
    if len(token) > 2 and not token.endswith("s") and f"{token}s" in content:
        return True
    return False


def filter_results(query: str, results: list[dict]) -> list[dict]:
    tokens = _query_tokens(query)
    if not tokens or not results:
        return results

    filtered: list[dict] = []
    for r in results:
        content = (r.get("content") or "").lower()
        if all(_token_matches_content(content, tok) for tok in tokens):
            filtered.append(r)

    if filtered:
        return filtered
    # Meaningful tokens but no payload matched — do not surface unrelated vector hits.
    return []


def _dedupe_by_content(results: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for r in results:
        c = (r.get("content") or "").strip()
        if not c or c in seen:
            continue
        seen.add(c)
        out.append(r)
    return out


def handle_query(results: list[dict]) -> str:
    rows = _dedupe_by_content(results)
    if not rows:
        return "I couldn't find anything."

    if len(rows) == 1:
        content = rows[0].get("content", "")
        return f"You said: {content}"

    lines = ["I found multiple related memories:"]
    for r in rows:
        lines.append(f"- {r.get('content', '')}")
    return "\n".join(lines)


async def process(
    text: str,
    user_id: str | None = None,
    db: AsyncSession | None = None,
) -> str:
    uid = user_id if user_id is not None else settings.DEFAULT_USER_ID
    low = text.lower()
    if db is not None and "spend" in low and "today" in low:
        svc = DBService(db)
        total = await svc.get_total_spent_today(uid)
        return f"You spent ₹{total} today."

    payloads = await search_memory_payloads(query=text, user_id=uid)
    for p in payloads:
        p.pop("_score", None)
    refined = filter_results(text, payloads)
    return handle_query(refined)
