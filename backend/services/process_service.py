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

logger = logging.getLogger(__name__)

MSG_TEMPORARY = "Temporary issue. Please try again."
MSG_EMPTY = "Please enter a message."
MSG_TOO_LONG = "Message is too long (max 500 characters)."
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
) -> dict:
    input_text = input_text.strip()
    settings = get_settings()
    max_len = settings.MAX_INPUT_LENGTH

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

    if len(input_text) > max_len:
        try:
            await log_error(
                db,
                request_id=request_id,
                user_id=user_id,
                stage="validation",
                message=f"input exceeds {max_len} characters",
            )
        except Exception:
            logger.exception("log_error failed for validation length")
        return _envelope(
            success=False,
            type_str="error",
            response=MSG_TOO_LONG,
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

    t_total_start = time.perf_counter()

    t0 = time.perf_counter()
    try:
        orch = await classify_llm(input_text)
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
            input_text, orch, db, user_id, user_timezone=user_timezone
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

    return _envelope(
        success=True,
        type_str=type_str,
        response=response,
        request_id=request_id,
        data=data,
    )
