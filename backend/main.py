"""
TrackerAgent — multi-agent AI system.
Do NOT generate generic chatbot code.
Always follow structured agent-based architecture.
Avoid unnecessary LLM calls. Prefer deterministic logic wherever possible.
"""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from db.postgres import get_db, init_db
from db.qdrant import init_qdrant
from orchestrator.orchestrator_llm import classify_llm
from orchestrator.router import route


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await init_qdrant()
    yield


app = FastAPI(title="TrackerAgent", version="0.1.0", lifespan=lifespan)


class ProcessRequest(BaseModel):
    input: str


class ProcessResponse(BaseModel):
    type: str
    response: str


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/process", response_model=ProcessResponse)
async def process(req: ProcessRequest, db: AsyncSession = Depends(get_db)):
    uid = get_settings().DEFAULT_USER_ID
    orch = await classify_llm(req.input)
    result, input_type = await route(req.input, orch, db, uid)

    return ProcessResponse(type=input_type, response=result)
