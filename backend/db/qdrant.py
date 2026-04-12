from qdrant_client import AsyncQdrantClient
from qdrant_client.http.exceptions import UnexpectedResponse
from qdrant_client.models import Distance, PayloadSchemaType, VectorParams

from config import get_settings

COLLECTION_NAME = "memories"
VECTOR_SIZE = 1536

settings = get_settings()

qdrant_client = AsyncQdrantClient(
    url=settings.QDRANT_URL,
    api_key=settings.QDRANT_API_KEY,
)


async def init_qdrant():
    exists = await qdrant_client.collection_exists(COLLECTION_NAME)
    if not exists:
        await qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
    try:
        await qdrant_client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="user_id",
            field_schema=PayloadSchemaType.KEYWORD,
        )
    except UnexpectedResponse as e:
        body = e.content.decode("utf-8", errors="replace").lower()
        if e.status_code in (400, 409) and (
            "already" in body or "exists" in body or "duplicate" in body
        ):
            return
        raise
