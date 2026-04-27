"""Single entry point for orchestration + routing (used by POST /process)."""

import logging
import time
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from api_response import (
    ProcessResponseEnvelope,
    build_data_payload,
    utc_timestamp,
)
from config import get_settings
from orchestrator.orchestrator_llm import classify_llm
from orchestrator.router import route
from services.log_service import (
    log_agent_step,
    log_error,
    log_orchestrator_step,
    log_query,
    orch_to_json,
)
from services.rate_limit_service import check_rate_limit
from services.subscription_service import (
    check_daily_request_limit,
    check_monthly_cost_limit,
    get_user_plan_config,
    increment_daily_requests,
)
from services.usage_service import log_token_usage

logger = logging.getLogger(__name__)

MSG_TEMPORARY = "Temporary issue. Please try again."
MSG_EMPTY = "Please enter a message."
MSG_RATE_LIMIT = "Too many requests. Please try again later."


def _envelope(
    *,
    success: bool,
    type_str: str,
    response: str,
    request_id: str,
    data: dict | None = None,
) -> dict:
    return ProcessResponseEnvelope(
        success=success,
        type=type_str,
        response=response,
        data=data,
        timestamp=utc_timestamp(),
        request_id=request_id,
    ).model_dump()


async def process_input(
    user_id: str,
    input_text: str,
    db: AsyncSession,
    *,
    request_id: str,
    user_timezone: ZoneInfo | None = None,
    user_name: str | None = None,
) -> dict:
    input_text = input_text.strip()
    settings = get_settings()

    if len(input_text) == 0:
        try:
            await log_error(
                db,
                request_id=request_id,
                user_id=user_id,
                stage="validation",
                message="empty input",
            )
        except Exception:
            logger.exception("log_error failed for validation")
        return _envelope(
            success=False,
            type_str="error",
            response=MSG_EMPTY,
            request_id=request_id,
            data=None,
        )

    if not check_rate_limit(user_id):
        try:
            await log_error(
                db,
                request_id=request_id,
                user_id=user_id,
                stage="rate_limit",
                message="rate limit exceeded",
            )
        except Exception:
            logger.exception("log_error failed for rate_limit")
        return _envelope(
            success=False,
            type_str="error",
            response=MSG_RATE_LIMIT,
            request_id=request_id,
            data=None,
        )

    # ── Subscription limit checks ─────────────────────────────────────
    try:
        _user_row, plan_config = await get_user_plan_config(db, user_id)
    except Exception:
        logger.exception("Failed to fetch plan config for user %s", user_id)
        # Fallback to free plan on error — don't block the request
        from plans import get_plan
        plan_config = get_plan("free")

    # ── Per-plan message length limit (prevents token waste) ──────────
    max_chars = plan_config.max_input_chars
    if len(input_text) > max_chars:
        try:
            await log_error(
                db,
                request_id=request_id,
                user_id=user_id,
                stage="validation",
                message=f"input exceeds {max_chars} characters (plan: {plan_config.name})",
            )
        except Exception:
            logger.exception("log_error failed for validation length")

        from plans import get_next_upgrade
        next_plan = get_next_upgrade(plan_config.name)
        upgrade_hint = ""
        if next_plan:
            upgrade_hint = f" Upgrade to {next_plan.display_name} for up to {next_plan.max_input_chars} characters."

        return _envelope(
            success=False,
            type_str="limit",
            response=f"Message is too long (max {max_chars} characters on {plan_config.display_name} plan).{upgrade_hint}",
            request_id=request_id,
            data={"reason": "input_too_long", "max_chars": max_chars, "upgrade_plan": next_plan.name if next_plan else None},
        )

    # 1. Daily request limit
    req_check = await check_daily_request_limit(db, user_id, plan_config)
    if not req_check.allowed:
        return _envelope(
            success=False,
            type_str="limit",
            response=req_check.upgrade_message,
            request_id=request_id,
            data={"reason": req_check.reason, "upgrade_plan": req_check.upgrade_plan},
        )

    # 2. Monthly cost budget (flag for fallback model, don't block)
    cost_check = await check_monthly_cost_limit(db, user_id, plan_config)
    use_fallback_model = not cost_check.allowed

    t_total_start = time.perf_counter()

    t0 = time.perf_counter()
    try:
        orch, orch_usage = await classify_llm(input_text)
        orch_ms = (time.perf_counter() - t0) * 1000.0
        try:
            await log_orchestrator_step(
                db,
                request_id=request_id,
                user_id=user_id,
                input_text=input_text,
                latency_ms=orch_ms,
                orchestrator_json=orch_to_json(orch),
                error_message=None,
            )
        except Exception:
            logger.exception("orchestrator_logs insert failed")

        # Log orchestrator token usage
        if orch_usage:
            try:
                await log_token_usage(
                    db,
                    request_id=request_id,
                    user_id=user_id,
                    model=orch_usage.get("model", "gpt-4o-mini"),
                    prompt_tokens=orch_usage.get("prompt_tokens", 0),
                    completion_tokens=orch_usage.get("completion_tokens", 0),
                    total_tokens=orch_usage.get("total_tokens", 0),
                    endpoint="/process:orchestrator",
                    latency_ms=orch_ms,
                )
            except Exception:
                logger.exception("usage_log insert failed for orchestrator")
    except Exception as exc:
        orch_ms = (time.perf_counter() - t0) * 1000.0
        try:
            await log_orchestrator_step(
                db,
                request_id=request_id,
                user_id=user_id,
                input_text=input_text,
                latency_ms=orch_ms,
                orchestrator_json=None,
                error_message=str(exc)[:500],
            )
        except Exception:
            logger.exception("orchestrator_logs insert failed after classify error")
        try:
            await log_error(
                db,
                request_id=request_id,
                user_id=user_id,
                stage="classify",
                message="classify_llm failed",
                detail=str(exc),
            )
        except Exception:
            logger.exception("log_error failed for classify")
        return _envelope(
            success=False,
            type_str="error",
            response=MSG_TEMPORARY,
            request_id=request_id,
            data=None,
        )

    try:
        t1 = time.perf_counter()
        response, type_str = await route(
            input_text,
            orch,
            db,
            user_id,
            user_timezone=user_timezone,
            plan_config=plan_config,
            use_fallback_model=use_fallback_model,
            user_name=user_name,
        )
        route_ms = (time.perf_counter() - t1) * 1000.0
        try:
            await log_agent_step(
                db,
                request_id=request_id,
                user_id=user_id,
                agent=type_str,
                latency_ms=route_ms,
                response_text=response,
            )
        except Exception:
            logger.exception("agent_logs insert failed")
    except Exception as exc:
        try:
            await log_error(
                db,
                request_id=request_id,
                user_id=user_id,
                stage="route",
                message="route failed",
                detail=str(exc),
            )
        except Exception:
            logger.exception("log_error failed for route")
        return _envelope(
            success=False,
            type_str="error",
            response=MSG_TEMPORARY,
            request_id=request_id,
            data=None,
        )

    total_ms = (time.perf_counter() - t_total_start) * 1000.0
    data = build_data_payload(orch, type_str)

    try:
        await log_query(
            db,
            user_id,
            input_text,
            response,
            type_str,
            request_id,
            latency_ms_total=Decimal(str(round(total_ms, 3))),
        )
    except Exception:
        logger.exception("log_query failed; request already processed")

    # ── Post-processing: increment daily request counter ──────────────
    try:
        await increment_daily_requests(db, user_id)
        await db.commit()
    except Exception:
        logger.exception("Failed to increment daily usage for user %s", user_id)

    return _envelope(
        success=True,
        type_str=type_str,
        response=response,
        request_id=request_id,
        data=data,
    )

