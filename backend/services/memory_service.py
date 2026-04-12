import uuid
from datetime import datetime, timezone

from qdrant_client.models import FieldCondition, Filter, MatchValue, PointStruct
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from db.models import Memory
from db.qdrant import COLLECTION_NAME, init_qdrant, qdrant_client
from services.embedding_service import get_embedding

settings = get_settings()


async def store_memory(
    db: AsyncSession,
    content: str,
    tags: list[str],
    raw_input: str,
    user_id: str | None = None,
) -> Memory:
    await init_qdrant()

    uid = user_id if user_id is not None else settings.DEFAULT_USER_ID
    memory_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    memory = Memory(
        id=memory_id,
        user_id=uid,
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
                    "user_id": uid,
                    "content": content,
                    "tags": tags,
                    "created_at": now.isoformat(),
                },
            )
        ],
    )

    return memory


def _user_filter(user_id: str) -> Filter:
    return Filter(
        must=[
            FieldCondition(key="user_id", match=MatchValue(value=user_id)),
        ]
    )


async def search_memories(
    query: str,
    user_id: str | None = None,
    limit: int = 5,
    score_threshold: float | None = None,
):
    await init_qdrant()

    uid = user_id if user_id is not None else settings.DEFAULT_USER_ID
    threshold = (
        settings.QDRANT_SCORE_THRESHOLD
        if score_threshold is None
        else score_threshold
    )

    vector = await get_embedding(query)
    results = await qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=vector,
        limit=limit,
        score_threshold=threshold,
        query_filter=_user_filter(uid),
    )
    return results.points


async def search_memory_payloads(
    query: str,
    user_id: str | None = None,
    limit: int = 5,
    score_threshold: float | None = None,
) -> list[dict]:
    points = await search_memories(
        query=query,
        user_id=user_id,
        limit=limit,
        score_threshold=score_threshold,
    )
    out: list[dict] = []
    for p in points:
        payload = dict(p.payload or {})
        payload["_score"] = getattr(p, "score", None)
        out.append(payload)
    return out
