from sqlalchemy.ext.asyncio import AsyncSession

from services.llm_service import parse_memory
from services.memory_service import store_memory


async def process(text: str, db: AsyncSession) -> str:
    parsed = await parse_memory(text)
    content = parsed.get("content", text)
    tags = parsed.get("tags", [])

    memory = await store_memory(db=db, content=content, tags=tags, raw_input=text)
    return f"Memory saved: {memory.content}"
