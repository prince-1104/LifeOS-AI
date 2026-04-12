import re
from decimal import Decimal

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


def _is_top_categories_intent(low: str) -> bool:
    if "most" in low and ("spend" in low or "spending" in low):
        return True
    if "top" in low and "categor" in low:
        return True
    if "where" in low and "spending" in low:
        return True
    return False


def _is_week_spend_intent(low: str) -> bool:
    if not ("week" in low or "this week" in low):
        return False
    return "spend" in low or "spent" in low or "how much" in low


async def _try_finance_db_answer(
    text: str,
    uid: str,
    db: AsyncSession,
) -> str | None:
    low = text.lower()
    svc = DBService(db)
    thr = Decimal(str(settings.FINANCE_HIGH_SPEND_WEEK_THRESHOLD))

    if "spend" in low and "today" in low:
        total = await svc.get_total_spent_today(uid)
        return f"You spent ₹{total} today."

    if _is_week_spend_intent(low):
        total = await svc.get_total_spent_last_7_days(uid)
        msg = f"You spent ₹{total} in the last 7 days."
        if total > thr:
            msg += " That's quite high compared to typical weeks."
        return msg

    if _is_top_categories_intent(low):
        rows = await svc.get_spending_by_category(uid, limit=10)
        top3 = rows[:3]
        if not top3:
            return "No spending data found."
        lines = ["Your top spending categories:"]
        for cat, amt in top3:
            lines.append(f"- {cat}: ₹{amt}")
        return "\n".join(lines)

    return None


async def process(
    text: str,
    user_id: str | None = None,
    db: AsyncSession | None = None,
) -> str:
    uid = user_id if user_id is not None else settings.DEFAULT_USER_ID

    if db is not None:
        finance_reply = await _try_finance_db_answer(text, uid, db)
        if finance_reply is not None:
            return finance_reply

    payloads = await search_memory_payloads(query=text, user_id=uid)
    for p in payloads:
        p.pop("_score", None)
    refined = filter_results(text, payloads)
    return handle_query(refined)
