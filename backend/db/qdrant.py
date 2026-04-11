from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, VectorParams

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
