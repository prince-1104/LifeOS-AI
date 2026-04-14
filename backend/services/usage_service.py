"""Service to log LLM token usage into usage_logs table."""

import logging
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from db.models import UsageLog

logger = logging.getLogger(__name__)


async def log_token_usage(
    db: AsyncSession,
    *,
    request_id: str,
    user_id: str,
    model: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    total_tokens: int | None = None,
    endpoint: str | None = None,
    latency_ms: float | None = None,
) -> None:
    """Persist a single LLM call's token usage."""
    if total_tokens is None:
        total_tokens = prompt_tokens + completion_tokens

    try:
        row = UsageLog(
            request_id=request_id,
            user_id=user_id,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            endpoint=endpoint,
            latency_ms=Decimal(str(round(latency_ms, 3))) if latency_ms is not None else None,
        )
        db.add(row)
        await db.commit()
    except Exception:
        logger.exception("Failed to log token usage for request %s", request_id)
