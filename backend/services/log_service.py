"""Persistence for query/audit logs (async SQLAlchemy)."""

import json
import logging
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from db.models import AgentLog, ErrorLog, OrchestratorLog, QueryLog

logger = logging.getLogger(__name__)

_LOG_INPUT_MAX = 4000
_PREVIEW_MAX = 200
_DETAIL_MAX = 500


def _trunc(s: str | None, n: int) -> str:
    if s is None:
        return ""
    return s if len(s) <= n else s[: n - 3] + "..."


async def log_query(
    db: AsyncSession,
    user_id: str,
    query: str,
    response: str,
    result_type: str,
    request_id: str,
    latency_ms_total: Decimal | float | None = None,
) -> None:
    row = QueryLog(
        request_id=request_id,
        user_id=user_id,
        query=query,
        response=response,
        result_type=result_type,
        latency_ms_total=latency_ms_total,
    )
    db.add(row)
    await db.commit()


async def log_orchestrator_step(
    db: AsyncSession,
    *,
    request_id: str,
    user_id: str,
    input_text: str,
    latency_ms: float,
    orchestrator_json: str | None,
    error_message: str | None = None,
) -> None:
    row = OrchestratorLog(
        request_id=request_id,
        user_id=user_id,
        input_text=_trunc(input_text, _LOG_INPUT_MAX),
        orchestrator_json=orchestrator_json,
        latency_ms=Decimal(str(round(latency_ms, 3))),
        error_message=_trunc(error_message, _LOG_INPUT_MAX) if error_message else None,
    )
    db.add(row)
    await db.commit()


async def log_agent_step(
    db: AsyncSession,
    *,
    request_id: str,
    user_id: str,
    agent: str,
    latency_ms: float,
    response_text: str | None = None,
) -> None:
    row = AgentLog(
        request_id=request_id,
        user_id=user_id,
        agent=agent,
        latency_ms=Decimal(str(round(latency_ms, 3))),
        response_preview=_trunc(response_text, _PREVIEW_MAX) if response_text else None,
    )
    db.add(row)
    await db.commit()


async def log_error(
    db: AsyncSession,
    *,
    request_id: str,
    user_id: str,
    stage: str,
    message: str,
    detail: str | None = None,
) -> None:
    row = ErrorLog(
        request_id=request_id,
        user_id=user_id,
        stage=stage,
        message=_trunc(message, _LOG_INPUT_MAX),
        detail=_trunc(detail, _DETAIL_MAX) if detail else None,
    )
    db.add(row)
    await db.commit()


def orch_to_json(orch) -> str:
    try:
        return json.dumps(orch.model_dump(mode="json"), default=str)
    except Exception:
        return "{}"
