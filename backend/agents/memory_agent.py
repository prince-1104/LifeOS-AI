from sqlalchemy.ext.asyncio import AsyncSession

from schemas import OrchestratorOutput
from services.llm_service import parse_memory
from services.memory_service import store_memory


async def process(
    text: str,
    db: AsyncSession,
    user_id: str | None = None,
    orchestrator: OrchestratorOutput | None = None,
) -> str:
    """
    Store a memory. If orchestrator already provided content (and optional tags),
    skip Gemini parse_memory to avoid a second LLM call.
    """
    if orchestrator and orchestrator.content and str(orchestrator.content).strip():
        content = orchestrator.content.strip()
        tags = orchestrator.tags if orchestrator.tags is not None else []
    else:
        parsed = await parse_memory(text)
        content = parsed.get("content", text)
        tags = parsed.get("tags", [])

    memory = await store_memory(
        db=db,
        content=content,
        tags=tags,
        raw_input=text,
        user_id=user_id,
    )
    return f"Memory saved: {memory.content}"
