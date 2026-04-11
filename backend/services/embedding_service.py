from openai import AsyncOpenAI

from config import get_settings

settings = get_settings()
_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

EMBEDDING_MODEL = "text-embedding-3-small"


async def get_embedding(text: str) -> list[float]:
    response = await _client.embeddings.create(input=text, model=EMBEDDING_MODEL)
    return response.data[0].embedding
