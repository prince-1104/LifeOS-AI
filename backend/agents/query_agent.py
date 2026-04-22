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
        "i",
        "in",
        "is",
        "it",
        "me",
        "much",
        "my",
        "of",
        "on",
        "tell",
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
    return [t for t in raw if t not in _STOPWORDS and len(t) > 1]


def _token_matches_content(content: str, token: str) -> bool:
    if token in content:
        return True
    if len(token) > 2 and token.endswith("s") and token[:-1] in content:
        return True
    if len(token) > 2 and not token.endswith("s") and f"{token}s" in content:
        return True
    # Handle common verb forms
    if len(token) > 3 and token.endswith("ed") and token[:-2] in content:
        return True
    if len(token) > 3 and token.endswith("ing") and token[:-3] in content:
        return True
    return False


def _score_result(query: str, result: dict) -> float:
    """Score a result by how many query tokens match its content.
    Returns a ratio between 0.0 and 1.0."""
    tokens = _query_tokens(query)
    if not tokens:
        return 1.0
    content = (result.get("content") or "").lower()
    matched = sum(1 for tok in tokens if _token_matches_content(content, tok))
    return matched / len(tokens)


def filter_results(query: str, results: list[dict]) -> list[dict]:
    """Filter and rank results by relevance.
    
    Instead of requiring ALL tokens to match (too strict),
    we require at least HALF of the tokens to match,
    and fall back to the semantic results if nothing passes.
    """
    tokens = _query_tokens(query)
    if not tokens or not results:
        return results

    scored: list[tuple[float, dict]] = []
    for r in results:
        score = _score_result(query, r)
        if score > 0:  # At least one token matches
            scored.append((score, r))

    if scored:
        # Sort by score descending (best matches first)
        scored.sort(key=lambda x: x[0], reverse=True)
        # Return results where at least 30% of tokens match
        threshold = 0.3
        good = [r for score, r in scored if score >= threshold]
        if good:
            return good

    # Fall back to returning the original semantic results from Qdrant
    # (they already passed the vector similarity threshold)
    return results


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
        return "I couldn't find anything matching that in your memories."

    if len(rows) == 1:
        content = rows[0].get("content", "")
        return f"Here's what I found: {content}"

    lines = ["Here's what I found in your memories:"]
    for r in rows:
        lines.append(f"• {r.get('content', '')}")
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
