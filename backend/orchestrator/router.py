import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from agents import finance_agent, memory_agent, query_agent, reminder_agent
from plans import PlanConfig, get_plan
from schemas import OrchestratorOutput
from services.subscription_service import (
    check_memory_write_limit,
    check_reminder_limit,
    check_reminder_time_restriction,
    enforce_memory_storage_limit,
    increment_memory_writes,
    increment_reminders,
)

logger = logging.getLogger(__name__)


async def route(
    user_input: str,
    orch: OrchestratorOutput,
    db: AsyncSession,
    user_id: str,
    user_timezone: ZoneInfo | None = None,
    plan_config: PlanConfig | None = None,
    use_fallback_model: bool = False,
) -> tuple[str, str]:
    """
    Dispatch by orchestrator type.  Returns (response_text, type_string).

    Enforces per-agent subscription limits (memory writes, reminders)
    before dispatching.  Increments daily counters on success.
    """
    if plan_config is None:
        plan_config = get_plan("free")

    t = orch.type

    if t == "memory":
        # ── Memory write limit ────────────────────────────────────────
        mem_check = await check_memory_write_limit(db, user_id, plan_config)
        if not mem_check.allowed:
            return mem_check.upgrade_message, "limit"

        text = await memory_agent.process(
            user_input,
            db,
            user_id=user_id,
            orchestrator=orch,
        )

        # Post-processing: increment counter + FIFO eviction
        try:
            await increment_memory_writes(db, user_id)
            evicted = await enforce_memory_storage_limit(db, user_id, plan_config)
            await db.commit()
            if evicted:
                text += f"\n\n(Oldest {evicted} {'memory' if evicted == 1 else 'memories'} removed to stay within your plan's limit of {plan_config.memory_storage_limit}.)"
        except Exception:
            logger.exception("Failed to enforce memory limits for user %s", user_id)

        return text, "memory"

    if t == "query":
        q = orch.query if orch.query else user_input
        text = await query_agent.process(q, user_id=user_id, db=db)
        return text, "query"

    if t == "finance":
        text = await finance_agent.process(user_input, orch, db, user_id)
        return text, "finance"

    if t == "reminder":
        # ── Reminder daily limit ──────────────────────────────────────
        rem_check = await check_reminder_limit(db, user_id, plan_config)
        if not rem_check.allowed:
            return rem_check.upgrade_message, "limit"

        # ── 24h restriction (parse reminder time if available) ────────
        if orch.time:
            try:
                from utils.time_parse import parse_time
                reminder_dt = parse_time(orch.time, user_tz=user_timezone)
                time_check = check_reminder_time_restriction(plan_config, reminder_dt)
                if not time_check.allowed:
                    return time_check.upgrade_message, "limit"
            except Exception:
                # If time parsing fails here, let the agent handle the error
                pass

        text = await reminder_agent.process(
            user_input,
            orch,
            db,
            user_id,
            user_timezone=user_timezone,
        )

        # Post-processing: increment reminder counter
        try:
            await increment_reminders(db, user_id)
            await db.commit()
        except Exception:
            logger.exception("Failed to increment reminder counter for user %s", user_id)

        return text, "reminder"

    return "🤔 I didn't understand that. Try rephrasing?", "unknown"

