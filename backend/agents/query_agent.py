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
        # Hindi stopwords
        "mera",
        "meri",
        "mere",
        "kaha",
        "kahan",
        "kya",
        "hai",
        "h",
        "ka",
        "ki",
        "ke",
        "ko",
        "ye",
        "wo",
        "yeh",
        "woh",
        "se",
        "ne",
        "par",
        "pe",
        "bhi",
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


def filter_results(query: str, results: list[dict]) -> list[dict]:
    """Filter and rank results by keyword relevance.

    Uses the Qdrant similarity score (_qdrant_score) as the primary signal.
    If keyword tokens are found, boosts matching results.
    Only returns the top result(s) from semantic search — avoids dumping everything.
    """
    if not results:
        return results

    tokens = _query_tokens(query)

    # If we have keyword tokens, try to filter by them
    if tokens:
        scored: list[tuple[float, dict]] = []
        for r in results:
            content = (r.get("content") or "").lower()
            matched = sum(1 for tok in tokens if _token_matches_content(content, tok))
            ratio = matched / len(tokens)
            if ratio >= 0.5:  # At least half the meaningful tokens match
                scored.append((ratio, r))

        if scored:
            scored.sort(key=lambda x: x[0], reverse=True)
            return [r for _, r in scored]

    # No keyword match — rely on Qdrant semantic similarity.
    # Only return the BEST result (highest score) to avoid noise.
    if len(results) >= 1:
        # Sort by qdrant score descending (stored in _qdrant_score)
        sorted_results = sorted(
            results,
            key=lambda r: r.get("_qdrant_score", 0),
            reverse=True,
        )
        best = sorted_results[0]
        best_score = best.get("_qdrant_score", 0)

        # Only return if the best result has a strong similarity
        if best_score >= 0.30:
            # Include any other results within 90% of the best score
            cutoff = best_score * 0.90
            return [r for r in sorted_results if r.get("_qdrant_score", 0) >= cutoff]

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
    # Keep the qdrant score for ranking, but rename to avoid confusion
    for p in payloads:
        score = p.pop("_score", None)
        p["_qdrant_score"] = score if score is not None else 0
    refined = filter_results(text, payloads)
    # Clean up internal score before passing to handler
    for r in refined:
        r.pop("_qdrant_score", None)
    return handle_query(refined)
