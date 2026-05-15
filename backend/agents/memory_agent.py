import logging

from sqlalchemy.ext.asyncio import AsyncSession

from schemas import OrchestratorOutput
from services.llm_service import parse_memory
from services.memory_service import store_memory

logger = logging.getLogger(__name__)


async def process(
    text: str,
    db: AsyncSession,
    user_id: str | None = None,
    orchestrator: OrchestratorOutput | None = None,
    request_id: str | None = None,
) -> str:
    """
    Store a memory. If orchestrator already provided content (and optional tags),
    skip Gemini parse_memory to avoid a second LLM call.
    """
    gemini_usage = None

    if orchestrator and orchestrator.content and str(orchestrator.content).strip():
        content = orchestrator.content.strip()
        tags = orchestrator.tags if orchestrator.tags is not None else []
    else:
        parsed, gemini_usage = await parse_memory(text)
        content = parsed.get("content", text)
        tags = parsed.get("tags", [])

    # Log Gemini token usage for parse_memory if it was called
    if gemini_usage and request_id and user_id:
        try:
            from services.usage_service import log_token_usage
            await log_token_usage(
                db,
                request_id=request_id,
                user_id=user_id,
                model=gemini_usage.get("model", "gemini-2.0-flash"),
                prompt_tokens=gemini_usage.get("prompt_tokens", 0),
                completion_tokens=gemini_usage.get("completion_tokens", 0),
                total_tokens=gemini_usage.get("total_tokens", 0),
                endpoint="/process:parse_memory",
            )
        except Exception:
            logger.debug("Failed to log parse_memory token usage")

    memory = await store_memory(
        db=db,
        content=content,
        tags=tags,
        raw_input=text,
        user_id=user_id,
    )
    return f"🧠 Memory saved: {memory.content}"
