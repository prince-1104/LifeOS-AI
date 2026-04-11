import uuid
from datetime import datetime, timezone

from qdrant_client.models import PointStruct
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Memory
from db.qdrant import COLLECTION_NAME, qdrant_client
from services.embedding_service import get_embedding


async def store_memory(
    db: AsyncSession,
    content: str,
    tags: list[str],
    raw_input: str,
) -> Memory:
    memory_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    memory = Memory(
        id=memory_id,
        content=content,
        tags=tags,
        raw_input=raw_input,
        created_at=now,
    )
    db.add(memory)
    await db.commit()
    await db.refresh(memory)

    vector = await get_embedding(content)
    await qdrant_client.upsert(
        collection_name=COLLECTION_NAME,
        points=[
            PointStruct(
                id=str(memory_id),
                vector=vector,
                payload={
                    "memory_id": str(memory_id),
                    "content": content,
                    "tags": tags,
                    "created_at": now.isoformat(),
                },
            )
        ],
    )

    return memory


async def search_memories(query: str, limit: int = 3, score_threshold: float = 0.3):
    vector = await get_embedding(query)
    results = await qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=vector,
        limit=limit,
        score_threshold=score_threshold,
    )
    return results.points
