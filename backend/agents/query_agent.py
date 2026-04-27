"""
Smart query agent: answers user questions about their finances, reminders, and memories.

Uses deterministic DB queries first (fast, no LLM cost), then falls back to
Qdrant memory search for personal memory queries.
"""

import logging
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from services.db_service import DBService
from services.memory_service import search_memory_payloads

logger = logging.getLogger(__name__)
settings = get_settings()


# ── Keyword sets for intent detection ─────────────────────────────────

_SPEND_WORDS = frozenset({
    "spend", "spent", "spending", "spends", "expense", "expenses",
    "kharcha", "kharche", "kitna", "kitne",
})

_INCOME_WORDS = frozenset({
    "income", "earned", "earning", "received", "salary",
    "aaya", "mila",
})

_REMINDER_WORDS = frozenset({
    "reminder", "reminders", "meeting", "meetings", "task", "tasks",
    "schedule", "scheduled", "todo", "to-do", "appointment",
    "yaad", "kaam",
})

_MEMORY_WORDS = frozenset({
    "remember", "memory", "memories", "stored", "saved", "noted",
    "where", "what",
})

_TIME_WORDS = {
    "today": 1,
    "yesterday": 1,
    "this week": 7,
    "last week": 7,
    "week": 7,
    "this month": 30,
    "last month": 30,
    "month": 30,
    "this year": 365,
    "last year": 365,
    "year": 365,
}

_DAY_NAMES = {
    "monday": 0, "mon": 0,
    "tuesday": 1, "tue": 1,
    "wednesday": 2, "wed": 2,
    "thursday": 3, "thu": 3,
    "friday": 4, "fri": 4,
    "saturday": 5, "sat": 5,
    "sunday": 6, "sun": 6,
}

_STOPWORDS = frozenset({
    "a", "an", "are", "did", "do", "does", "how", "i", "in", "is", "it",
    "me", "much", "my", "of", "on", "tell", "the", "to", "was", "were",
    "what", "when", "where", "which", "who", "why", "have", "has", "been",
    "show", "get", "give", "all", "total", "please", "can", "you",
    # Hindi
    "mera", "meri", "mere", "kaha", "kahan", "kya", "hai", "h",
    "ka", "ki", "ke", "ko", "ye", "wo", "yeh", "woh", "se", "ne",
    "par", "pe", "bhi", "maine", "dikhao", "batao",
})

_SPEND_STRIP = _STOPWORDS | _SPEND_WORDS | frozenset({
    "send", "for", "list", "spends",
})


# ── Time period detection ─────────────────────────────────────────────

def _detect_period_days(text: str) -> int | None:
    """Detect how many days the user is asking about. Returns None for ambiguous."""
    low = text.lower()

    # Explicit day counts: "last 3 days", "past 5 days"
    m = re.search(r"(?:last|past)\s+(\d+)\s+days?", low)
    if m:
        return int(m.group(1))

    m = re.search(r"(?:last|past)\s+(\d+)\s+weeks?", low)
    if m:
        return int(m.group(1)) * 7

    m = re.search(r"(?:last|past)\s+(\d+)\s+months?", low)
    if m:
        return int(m.group(1)) * 30

    # Named periods
    for key, days in _TIME_WORDS.items():
        if key in low:
            if key == "yesterday":
                return 1
            return days

    return None


def _detect_day_name(text: str) -> str | None:
    """Detect a specific day name (Monday, Tuesday, etc.)."""
    low = text.lower()
    for name, _ in _DAY_NAMES.items():
        if name in low:
            return name
    return None


def _get_date_range_for_day(day_name: str) -> tuple[datetime, datetime]:
    """Get the date range for the next occurrence of a named day.

    If today is that day, returns today's range.
    Also checks the most recent past occurrence.
    Returns (start_of_day_utc, end_of_day_utc) for the nearest occurrence.
    """
    target_weekday = _DAY_NAMES.get(day_name.lower(), 0)
    now = datetime.now(timezone.utc)
    current_weekday = now.weekday()

    # Check both past and future occurrences; use the closest
    days_ahead = (target_weekday - current_weekday) % 7
    days_behind = (current_weekday - target_weekday) % 7

    if days_ahead == 0:
        # Today is that day
        target_date = now.date()
    elif days_behind <= days_ahead:
        # Past occurrence is closer
        target_date = (now - timedelta(days=days_behind)).date()
    else:
        # Future occurrence is closer
        target_date = (now + timedelta(days=days_ahead)).date()

    start = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=timezone.utc)
    end = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59, tzinfo=timezone.utc)
    return start, end


def _extract_spend_keyword(text: str) -> str | None:
    """Extract the category keyword from a spending query (e.g., "food", "AC")."""
    low = text.lower()

    if not any(sig in low for sig in _SPEND_WORDS):
        return None

    # Don't match aggregate queries
    if any(phrase in low for phrase in [
        "total spend", "total spent", "how much spend", "how much spent",
        "how much did i spend", "how much have i spent",
    ]):
        # Unless there's a specific category after "on" or "for"
        m = re.search(r"(?:on|for|in)\s+(\w+)", low)
        if m:
            word = m.group(1)
            if word not in _SPEND_STRIP and len(word) > 1:
                return word
        # If "today/week/month" is specified, it's a time-period query, not a keyword query
        if any(t in low for t in ["today", "week", "month", "year", "yesterday"]):
            return None

    # Try to extract keyword from "on/for X" pattern
    m = re.search(r"(?:on|for|in)\s+([a-zA-Z][\w\s]*?)(?:\s+(?:today|this|last|week|month|year)|$)", low)
    if m:
        word = m.group(1).strip()
        tokens = [t for t in word.split() if t not in _SPEND_STRIP and len(t) > 1]
        if tokens:
            return " ".join(tokens)

    # Fallback: extract remaining tokens after stripping stopwords
    raw_tokens = re.findall(r"[a-zA-Z0-9]+", text)
    keywords = [t for t in raw_tokens if t.lower() not in _SPEND_STRIP and len(t) > 1]
    if len(keywords) == 1:
        return keywords[0]

    return None


def _has_spending_intent(text: str) -> bool:
    low = text.lower()
    return any(w in low for w in _SPEND_WORDS)


def _has_income_intent(text: str) -> bool:
    low = text.lower()
    return any(w in low for w in _INCOME_WORDS)


def _has_reminder_intent(text: str) -> bool:
    low = text.lower()
    return any(w in low for w in _REMINDER_WORDS)


def _is_top_categories_intent(text: str) -> bool:
    low = text.lower()
    if "most" in low and ("spend" in low or "spending" in low):
        return True
    if "top" in low and "categor" in low:
        return True
    if "where" in low and ("spending" in low or "spend" in low):
        return True
    if "highest" in low and ("spend" in low or "expense" in low):
        return True
    return False


def _is_summary_intent(text: str) -> bool:
    low = text.lower()
    if "summary" in low or "overview" in low or "report" in low:
        return True
    if "overall" in low and ("spend" in low or "finance" in low):
        return True
    return False


# ── Formatting helpers ────────────────────────────────────────────────

def _fmt_amount(amount: Decimal) -> str:
    """Format amount in INR without unnecessary decimals."""
    if amount == amount.to_integral_value():
        return f"₹{int(amount)}"
    return f"₹{amount:.2f}"


def _fmt_date(dt: datetime) -> str:
    return dt.strftime("%d %b %Y, %I:%M %p")


def _fmt_date_short(dt: datetime) -> str:
    return dt.strftime("%d %b")


# ── Main process function ────────────────────────────────────────────

async def process(
    text: str,
    user_id: str | None = None,
    db: AsyncSession | None = None,
) -> str:
    """Answer user queries using their actual data."""
    uid = user_id if user_id is not None else settings.DEFAULT_USER_ID
    low = text.lower()

    if db is not None:
        try:
            answer = await _smart_data_answer(text, low, uid, db)
            if answer is not None:
                return answer
        except Exception:
            logger.exception("Smart data answer failed for query: %s", text[:100])

    # Fallback: search Qdrant memories
    try:
        payloads = await search_memory_payloads(query=text, user_id=uid)
        for p in payloads:
            score = p.pop("_score", None)
            p["_qdrant_score"] = score if score is not None else 0
        refined = _filter_memory_results(text, payloads)
        for r in refined:
            r.pop("_qdrant_score", None)
        return _format_memory_results(refined)
    except Exception:
        logger.exception("Memory search failed for query: %s", text[:100])
        return "🔍 I couldn't search your data right now. Please try again."


async def _smart_data_answer(
    text: str,
    low: str,
    uid: str,
    db: AsyncSession,
) -> str | None:
    """Try to answer from finance/reminder DB. Returns None if not a data query."""
    svc = DBService(db)

    # ── 1. Spending summary / overview ────────────────────────────────
    if _is_summary_intent(text):
        summary = await svc.get_spending_summary(uid)
        return _format_summary(summary)

    # ── 2. Top spending categories ("where am I spending most") ───────
    if _is_top_categories_intent(text):
        days = _detect_period_days(text) or 30
        cats = await svc.get_spending_by_category_period(uid, days)
        if not cats:
            return "🔍 No spending data found for this period."
        period_label = _period_label(days)
        lines = [f"💰 Your top spending categories ({period_label}):"]
        for i, (cat, amt) in enumerate(cats[:5], 1):
            bar = "█" * min(int(float(amt) / float(cats[0][1]) * 10), 10) if float(cats[0][1]) > 0 else ""
            lines.append(f"  {i}. **{cat}** — {_fmt_amount(amt)} {bar}")
        total = sum(a for _, a in cats)
        lines.append(f"\n📊 Total: {_fmt_amount(total)}")
        return "\n".join(lines)

    # ── 3. Category-specific spend ("how much on food") ──────────────
    keyword = _extract_spend_keyword(text)
    if keyword and _has_spending_intent(text):
        days = _detect_period_days(text) or 30
        items, total = await svc.search_expenses_by_keyword(uid, keyword)
        if items:
            period_label = _period_label(days)
            lines = [f"💰 You spent {_fmt_amount(total)} on **{keyword}**:"]
            for item in items[:10]:
                lines.append(
                    f"  • {item['category']} — {_fmt_amount(item['amount'])}"
                    + (f" ({item['date']})" if item.get('date') else "")
                )
            if len(items) > 10:
                lines.append(f"  ... and {len(items) - 10} more")
            return "\n".join(lines)
        else:
            return f"🔍 No expenses found matching \"{keyword}\"."

    # ── 4. Reminder queries ──────────────────────────────────────────
    if _has_reminder_intent(text):
        return await _handle_reminder_query(text, low, uid, svc)

    # ── 5. Total spend for period ("total spend today/week/month") ───
    if _has_spending_intent(text):
        return await _handle_spending_query(text, low, uid, svc)

    # ── 6. Income queries ────────────────────────────────────────────
    if _has_income_intent(text):
        return await _handle_income_query(text, low, uid, svc)

    # ── 7. General "how much" or "total" type queries ────────────────
    if any(phrase in low for phrase in ["how much", "total", "kitna", "kitne"]):
        return await _handle_spending_query(text, low, uid, svc)

    return None


# ── Handlers ──────────────────────────────────────────────────────────

async def _handle_spending_query(
    text: str, low: str, uid: str, svc: DBService
) -> str:
    """Handle total-spend type queries."""
    days = _detect_period_days(text)

    if days is None:
        # Default to today if no period specified
        if "today" in low or "aaj" in low:
            days = 1
        else:
            days = 1  # default to today

    if days == 1 and ("today" in low or "aaj" in low or days == 1):
        total = await svc.get_total_spent_today(uid)
        if total == 0:
            return "💰 You haven't recorded any expenses today yet."

        # Also get breakdown
        cats = await svc.get_spending_by_category_period(uid, 1)
        lines = [f"💰 You spent **{_fmt_amount(total)}** today."]
        if cats:
            lines.append("\n📋 Breakdown:")
            for cat, amt in cats[:5]:
                lines.append(f"  • {cat}: {_fmt_amount(amt)}")
        return "\n".join(lines)

    total = await svc.get_total_spent_period(uid, days)
    period_label = _period_label(days)
    if total == 0:
        return f"💰 No expenses recorded in the {period_label}."

    cats = await svc.get_spending_by_category_period(uid, days)
    lines = [f"💰 You spent **{_fmt_amount(total)}** in the {period_label}."]
    if cats:
        lines.append("\n📋 Breakdown:")
        for cat, amt in cats[:5]:
            lines.append(f"  • {cat}: {_fmt_amount(amt)}")
    return "\n".join(lines)


async def _handle_income_query(
    text: str, low: str, uid: str, svc: DBService
) -> str:
    """Handle income-related queries."""
    days = _detect_period_days(text) or 30
    total = await svc.get_total_income_period(uid, days)
    period_label = _period_label(days)
    if total == 0:
        return f"💵 No income recorded in the {period_label}."
    return f"💵 Your total income in the {period_label}: **{_fmt_amount(total)}**"


async def _handle_reminder_query(
    text: str, low: str, uid: str, svc: DBService
) -> str:
    """Handle reminder/meeting/schedule queries."""

    # Check for specific day name
    day_name = _detect_day_name(text)
    if day_name:
        start, end = _get_date_range_for_day(day_name)
        reminders = await svc.get_reminders_by_date_range(uid, start, end)
        day_label = day_name.capitalize()
        if not reminders:
            return f"📅 No reminders/meetings found for **{day_label}** ({_fmt_date_short(start)})."
        lines = [f"📅 Your reminders for **{day_label}** ({_fmt_date_short(start)}):"]
        for r in reminders:
            status = "✅" if r.status == "done" else "⏳"
            time_str = r.reminder_time.strftime("%I:%M %p") if r.reminder_time else ""
            lines.append(f"  {status} {r.task} — {time_str}")
        return "\n".join(lines)

    # "today" reminders
    if "today" in low or "aaj" in low:
        now = datetime.now(timezone.utc)
        start = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)
        end = datetime(now.year, now.month, now.day, 23, 59, 59, tzinfo=timezone.utc)
        reminders = await svc.get_reminders_by_date_range(uid, start, end)
        if not reminders:
            return "📅 No reminders for today."
        lines = ["📅 Your reminders for **today**:"]
        for r in reminders:
            status = "✅" if r.status == "done" else "⏳"
            time_str = r.reminder_time.strftime("%I:%M %p") if r.reminder_time else ""
            lines.append(f"  {status} {r.task} — {time_str}")
        return "\n".join(lines)

    # "tomorrow" reminders
    if "tomorrow" in low or "kal" in low:
        now = datetime.now(timezone.utc)
        tmrw = now + timedelta(days=1)
        start = datetime(tmrw.year, tmrw.month, tmrw.day, 0, 0, 0, tzinfo=timezone.utc)
        end = datetime(tmrw.year, tmrw.month, tmrw.day, 23, 59, 59, tzinfo=timezone.utc)
        reminders = await svc.get_reminders_by_date_range(uid, start, end)
        if not reminders:
            return "📅 No reminders for tomorrow."
        lines = ["📅 Your reminders for **tomorrow**:"]
        for r in reminders:
            status = "✅" if r.status == "done" else "⏳"
            time_str = r.reminder_time.strftime("%I:%M %p") if r.reminder_time else ""
            lines.append(f"  {status} {r.task} — {time_str}")
        return "\n".join(lines)

    # "this week" reminders
    if "week" in low:
        reminders = await svc.get_all_reminders_upcoming(uid, days=7)
        if not reminders:
            return "📅 No upcoming reminders this week."
        lines = ["📅 Your reminders for this week:"]
        for r in reminders:
            status = "✅" if r.status == "done" else "⏳"
            date_str = _fmt_date(r.reminder_time) if r.reminder_time else ""
            lines.append(f"  {status} {r.task} — {date_str}")
        return "\n".join(lines)

    # All pending reminders
    if "pending" in low or "all" in low or "list" in low:
        reminders = await svc.get_pending_reminders(uid)
        if not reminders:
            return "📅 You have no pending reminders."
        lines = [f"📅 You have **{len(reminders)}** pending reminder(s):"]
        for r in reminders:
            date_str = _fmt_date(r.reminder_time) if r.reminder_time else ""
            lines.append(f"  ⏳ {r.task} — {date_str}")
        return "\n".join(lines)

    # Default: show upcoming reminders
    reminders = await svc.get_all_reminders_upcoming(uid, days=7)
    if not reminders:
        pending = await svc.get_pending_reminders(uid)
        if pending:
            lines = [f"📅 You have **{len(pending)}** pending reminder(s):"]
            for r in pending[:5]:
                date_str = _fmt_date(r.reminder_time) if r.reminder_time else ""
                lines.append(f"  ⏳ {r.task} — {date_str}")
            return "\n".join(lines)
        return "📅 No upcoming reminders."
    lines = ["📅 Your upcoming reminders:"]
    for r in reminders[:5]:
        status = "✅" if r.status == "done" else "⏳"
        date_str = _fmt_date(r.reminder_time) if r.reminder_time else ""
        lines.append(f"  {status} {r.task} — {date_str}")
    if len(reminders) > 5:
        lines.append(f"  ... and {len(reminders) - 5} more")
    return "\n".join(lines)


# ── Formatting helpers ────────────────────────────────────────────────

def _period_label(days: int) -> str:
    if days == 1:
        return "today"
    if days == 7:
        return "last 7 days"
    if days == 30:
        return "last 30 days"
    if days == 365:
        return "last year"
    return f"last {days} days"


def _format_summary(summary: dict) -> str:
    lines = ["📊 **Your Financial Summary**\n"]
    lines.append(f"  💸 Today: {_fmt_amount(summary['today'])}")
    lines.append(f"  💸 This week: {_fmt_amount(summary['week'])}")
    lines.append(f"  💸 This month: {_fmt_amount(summary['month'])}")
    lines.append(f"  💵 Income (month): {_fmt_amount(summary['income_month'])}")

    net = summary['income_month'] - summary['month']
    emoji = "📈" if net >= 0 else "📉"
    lines.append(f"  {emoji} Net balance (month): {_fmt_amount(net)}")

    cats = summary.get("top_categories", [])
    if cats:
        lines.append("\n🏷️ **Top Categories (30 days):**")
        for i, (cat, amt) in enumerate(cats[:5], 1):
            lines.append(f"  {i}. {cat}: {_fmt_amount(amt)}")

    return "\n".join(lines)


# ── Memory search helpers (kept from original) ───────────────────────

def _filter_memory_results(query: str, results: list[dict]) -> list[dict]:
    """Filter and rank Qdrant memory results by relevance."""
    if not results:
        return results

    tokens = _query_tokens(query)

    if tokens:
        scored: list[tuple[float, dict]] = []
        for r in results:
            content = (r.get("content") or "").lower()
            matched = sum(1 for tok in tokens if _token_matches_content(content, tok))
            ratio = matched / len(tokens)
            if ratio >= 0.5:
                scored.append((ratio, r))
        if scored:
            scored.sort(key=lambda x: x[0], reverse=True)
            return [r for _, r in scored]

    if len(results) >= 1:
        sorted_results = sorted(
            results,
            key=lambda r: r.get("_qdrant_score", 0),
            reverse=True,
        )
        best = sorted_results[0]
        best_score = best.get("_qdrant_score", 0)
        if best_score >= 0.30:
            cutoff = best_score * 0.90
            return [r for r in sorted_results if r.get("_qdrant_score", 0) >= cutoff]

    return []


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
    if len(token) > 3 and token.endswith("ed") and token[:-2] in content:
        return True
    if len(token) > 3 and token.endswith("ing") and token[:-3] in content:
        return True
    return False


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


def _format_memory_results(results: list[dict]) -> str:
    rows = _dedupe_by_content(results)
    if not rows:
        return "🔍 I searched your data but couldn't find a match. Try asking differently?"

    if len(rows) == 1:
        content = rows[0].get("content", "")
        return f"🤖 {content}"

    lines = ["🤖 Here's what I found:"]
    for r in rows:
        lines.append(f"  • {r.get('content', '')}")
    return "\n".join(lines)
