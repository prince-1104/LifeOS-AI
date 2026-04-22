"""
Subscription limit enforcement, FIFO memory eviction, cost guard,
and daily usage tracking.

All limit checks return a LimitCheckResult with conversion-optimized
upgrade messages.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import DailyUsage, Memory, User
from plans import PlanConfig, get_next_upgrade, get_plan, min_plan_for_feature

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════
#  RESULT TYPE
# ═══════════════════════════════════════════════════════════════════════


@dataclass
class LimitCheckResult:
    allowed: bool
    reason: str | None = None  # machine-readable: "daily_request_limit", etc.
    upgrade_message: str | None = None  # user-facing conversion prompt
    upgrade_plan: str | None = None  # next plan name


def _ok() -> LimitCheckResult:
    return LimitCheckResult(allowed=True)


def _denied(
    reason: str,
    message: str,
    upgrade_plan: str | None = None,
) -> LimitCheckResult:
    return LimitCheckResult(
        allowed=False,
        reason=reason,
        upgrade_message=message,
        upgrade_plan=upgrade_plan,
    )


# ═══════════════════════════════════════════════════════════════════════
#  HELPERS — get / upsert daily usage row
# ═══════════════════════════════════════════════════════════════════════

_today_utc = lambda: datetime.now(timezone.utc).date()


async def _get_or_create_daily(db: AsyncSession, user_id: str) -> DailyUsage:
    """Get today's DailyUsage row, creating it on first access."""
    today = _today_utc()
    stmt = select(DailyUsage).where(
        DailyUsage.user_id == user_id,
        DailyUsage.date == today,
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if row is not None:
        return row

    row = DailyUsage(user_id=user_id, date=today)
    db.add(row)
    await db.flush()
    return row


async def get_monthly_cost(db: AsyncSession, user_id: str) -> Decimal:
    """Sum cost_inr for the current calendar month."""
    today = _today_utc()
    first_of_month = today.replace(day=1)
    stmt = select(func.coalesce(func.sum(DailyUsage.cost_inr), 0)).where(
        DailyUsage.user_id == user_id,
        DailyUsage.date >= first_of_month,
    )
    result = await db.execute(stmt)
    return Decimal(str(result.scalar_one()))


async def get_user_plan_config(db: AsyncSession, user_id: str) -> tuple[User, PlanConfig]:
    """Fetch user row and resolve their PlanConfig."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    plan_name = user.plan if user and user.plan else "free"
    return user, get_plan(plan_name)


# ═══════════════════════════════════════════════════════════════════════
#  LIMIT CHECKS
# ═══════════════════════════════════════════════════════════════════════


async def check_daily_request_limit(
    db: AsyncSession,
    user_id: str,
    plan: PlanConfig,
) -> LimitCheckResult:
    usage = await _get_or_create_daily(db, user_id)
    if usage.requests_count >= plan.daily_requests:
        nxt = get_next_upgrade(plan.name)
        if nxt and plan.name == "free":
            msg = (
                f"🚫 You've hit today's limit of {plan.daily_requests} requests!\n\n"
                f"🚀 Unlock {nxt.daily_requests} daily requests with {nxt.display_name} "
                f"for just ₹{nxt.price_inr_monthly}/month — that's less than ₹1/day!\n"
                f"⚡ Don't let limits slow you down."
            )
        elif nxt:
            msg = (
                f"🚫 You've used all {plan.daily_requests} requests for today on your {plan.display_name} plan.\n\n"
                f"⬆️ Upgrade to {nxt.display_name} for {nxt.daily_requests} requests/day, "
                f"{nxt.memory_writes_per_day} memory saves & {nxt.reminders_per_day} reminders — "
                f"only ₹{nxt.price_inr_monthly}/month!"
            )
        else:
            msg = f"🏆 You've used all {plan.daily_requests} requests for today. You're on our highest plan — resets at midnight!"
        return _denied(
            reason="daily_request_limit",
            message=msg,
            upgrade_plan=nxt.name if nxt else None,
        )
    return _ok()


async def check_memory_write_limit(
    db: AsyncSession,
    user_id: str,
    plan: PlanConfig,
) -> LimitCheckResult:
    usage = await _get_or_create_daily(db, user_id)
    if usage.memory_writes >= plan.memory_writes_per_day:
        nxt = get_next_upgrade(plan.name)
        if nxt and plan.name == "free":
            msg = (
                f"🧠 You've saved {plan.memory_writes_per_day}/{plan.memory_writes_per_day} memories today!\n\n"
                f"🔓 Get {nxt.memory_writes_per_day} memory saves/day + {nxt.memory_storage_limit} total storage "
                f"with {nxt.display_name} — just ₹{nxt.price_inr_monthly}/month.\n"
                f"💡 Your memories deserve more space."
            )
        elif nxt:
            msg = (
                f"🧠 All {plan.memory_writes_per_day} memory saves used today on {plan.display_name}.\n\n"
                f"⬆️ {nxt.display_name} gives you {nxt.memory_writes_per_day} saves/day "
                f"and {nxt.memory_storage_limit} memory storage — ₹{nxt.price_inr_monthly}/month."
            )
        else:
            msg = f"🧠 All {plan.memory_writes_per_day} memory saves used today. Resets at midnight!"
        return _denied(
            reason="memory_write_limit",
            message=msg,
            upgrade_plan=nxt.name if nxt else None,
        )
    return _ok()


async def check_reminder_limit(
    db: AsyncSession,
    user_id: str,
    plan: PlanConfig,
) -> LimitCheckResult:
    usage = await _get_or_create_daily(db, user_id)
    if usage.reminders_created >= plan.reminders_per_day:
        nxt = get_next_upgrade(plan.name)
        if nxt and plan.name == "free":
            msg = (
                f"⏰ You've set {plan.reminders_per_day}/{plan.reminders_per_day} reminders today!\n\n"
                f"🔔 Get {nxt.reminders_per_day} reminders/day with {nxt.display_name} "
                f"— only ₹{nxt.price_inr_monthly}/month.\n"
                f"🎯 Never miss a task again."
            )
        elif nxt:
            msg = (
                f"⏰ All {plan.reminders_per_day} reminders used today on {plan.display_name}.\n\n"
                f"⬆️ {nxt.display_name} unlocks {nxt.reminders_per_day} reminders/day"
                + (" + long-term scheduling" if nxt.long_term_reminder and not plan.long_term_reminder else "")
                + f" — ₹{nxt.price_inr_monthly}/month."
            )
        else:
            msg = f"⏰ All {plan.reminders_per_day} reminders used today. Resets at midnight!"
        return _denied(
            reason="reminder_limit",
            message=msg,
            upgrade_plan=nxt.name if nxt else None,
        )
    return _ok()


def check_reminder_time_restriction(
    plan: PlanConfig,
    reminder_time: datetime,
) -> LimitCheckResult:
    """Reject reminders > 24h in the future if plan restricts to 24h only."""
    if not plan.reminder_24h_only:
        return _ok()

    now = datetime.now(timezone.utc)
    if reminder_time > now + timedelta(hours=24):
        min_plan = min_plan_for_feature("long_term_reminder")
        if min_plan:
            msg = (
                f"📅 Long-term reminders (beyond 24h) are a premium feature!\n\n"
                f"🔓 Unlock with {min_plan.display_name} — schedule reminders days, "
                f"weeks, or months ahead for just ₹{min_plan.price_inr_monthly}/month."
            )
        else:
            msg = "📅 Long-term reminders require a higher plan."
        return _denied(
            reason="reminder_24h_restriction",
            message=msg,
            upgrade_plan=min_plan.name if min_plan else None,
        )
    return _ok()


async def check_monthly_cost_limit(
    db: AsyncSession,
    user_id: str,
    plan: PlanConfig,
) -> LimitCheckResult:
    """Check if user has exceeded their monthly cost budget."""
    cost = await get_monthly_cost(db, user_id)
    if cost >= Decimal(str(plan.monthly_cost_budget_inr)):
        return _denied(
            reason="monthly_cost_limit",
            message="Monthly cost budget reached. Using optimized model.",
        )
    return _ok()


def check_feature_access(
    plan: PlanConfig,
    feature: str,
) -> LimitCheckResult:
    """Check if a feature is available on the user's plan."""
    feature_flag = getattr(plan, feature, None)
    if feature_flag is None:
        # Unknown feature — allow by default
        return _ok()
    if not feature_flag:
        min_plan = min_plan_for_feature(feature)
        feature_labels = {
            "voice_input": "🎙️ Voice Input",
            "premium_tts": "🔊 Premium Text-to-Speech",
            "priority_processing": "⚡ Priority Processing",
            "long_term_reminder": "📅 Long-term Reminders",
        }
        feature_label = feature_labels.get(feature, feature.replace("_", " ").title())
        if min_plan:
            msg = (
                f"🔒 {feature_label} is a premium feature!\n\n"
                f"✨ Available from {min_plan.display_name} — ₹{min_plan.price_inr_monthly}/month.\n"
                f"🚀 Upgrade now to supercharge your experience."
            )
        else:
            msg = f"🔒 {feature_label} is not available on your current plan."
        return _denied(
            reason=f"feature_locked:{feature}",
            message=msg,
            upgrade_plan=min_plan.name if min_plan else None,
        )
    return _ok()


# ═══════════════════════════════════════════════════════════════════════
#  MEMORY FIFO EVICTION
# ═══════════════════════════════════════════════════════════════════════


async def enforce_memory_storage_limit(
    db: AsyncSession,
    user_id: str,
    plan: PlanConfig,
) -> int:
    """
    If user exceeds memory_storage_limit, delete the oldest memories (FIFO)
    from both Postgres and Qdrant.  Returns the number of evicted memories.
    """
    # Count total stored memories
    count_stmt = select(func.count(Memory.id)).where(Memory.user_id == user_id)
    total = (await db.execute(count_stmt)).scalar_one()

    if total <= plan.memory_storage_limit:
        return 0

    excess = total - plan.memory_storage_limit

    # Get IDs of oldest memories to evict
    oldest_stmt = (
        select(Memory.id)
        .where(Memory.user_id == user_id)
        .order_by(Memory.created_at.asc())
        .limit(excess)
    )
    result = await db.execute(oldest_stmt)
    evict_ids = [row[0] for row in result.all()]

    if not evict_ids:
        return 0

    # Delete from Postgres
    del_stmt = delete(Memory).where(Memory.id.in_(evict_ids))
    await db.execute(del_stmt)
    await db.flush()

    # Delete from Qdrant (best-effort, don't fail the request)
    try:
        from db.qdrant import COLLECTION_NAME, qdrant_client
        from qdrant_client.models import PointIdsList

        await qdrant_client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=PointIdsList(points=[str(mid) for mid in evict_ids]),
        )
    except Exception:
        logger.warning("Failed to evict memories from Qdrant for user %s", user_id, exc_info=True)

    logger.info("Evicted %d old memories for user %s (limit: %d)", len(evict_ids), user_id, plan.memory_storage_limit)
    return len(evict_ids)


# ═══════════════════════════════════════════════════════════════════════
#  USAGE INCREMENT HELPERS  (called after successful processing)
# ═══════════════════════════════════════════════════════════════════════


async def increment_daily_requests(db: AsyncSession, user_id: str) -> None:
    """Increment today's request counter by 1."""
    today = _today_utc()
    stmt = (
        pg_insert(DailyUsage)
        .values(user_id=user_id, date=today, requests_count=1)
        .on_conflict_do_update(
            constraint="uq_daily_usage_user_date",
            set_={"requests_count": DailyUsage.requests_count + 1},
        )
    )
    await db.execute(stmt)
    await db.flush()


async def increment_memory_writes(db: AsyncSession, user_id: str) -> None:
    """Increment today's memory write counter by 1."""
    today = _today_utc()
    stmt = (
        pg_insert(DailyUsage)
        .values(user_id=user_id, date=today, memory_writes=1)
        .on_conflict_do_update(
            constraint="uq_daily_usage_user_date",
            set_={"memory_writes": DailyUsage.memory_writes + 1},
        )
    )
    await db.execute(stmt)
    await db.flush()


async def increment_reminders(db: AsyncSession, user_id: str) -> None:
    """Increment today's reminder counter by 1."""
    today = _today_utc()
    stmt = (
        pg_insert(DailyUsage)
        .values(user_id=user_id, date=today, reminders_created=1)
        .on_conflict_do_update(
            constraint="uq_daily_usage_user_date",
            set_={"reminders_created": DailyUsage.reminders_created + 1},
        )
    )
    await db.execute(stmt)
    await db.flush()


async def add_daily_cost(
    db: AsyncSession,
    user_id: str,
    tokens: int,
    cost_inr: float,
) -> None:
    """Add tokens and cost to today's daily usage row."""
    today = _today_utc()
    stmt = (
        pg_insert(DailyUsage)
        .values(
            user_id=user_id,
            date=today,
            tokens_used=tokens,
            cost_inr=Decimal(str(round(cost_inr, 4))),
        )
        .on_conflict_do_update(
            constraint="uq_daily_usage_user_date",
            set_={
                "tokens_used": DailyUsage.tokens_used + tokens,
                "cost_inr": DailyUsage.cost_inr + Decimal(str(round(cost_inr, 4))),
            },
        )
    )
    await db.execute(stmt)
    await db.flush()
