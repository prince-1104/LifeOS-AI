"""
TrackerAgent — multi-agent AI system.
Do NOT generate generic chatbot code.
Always follow structured agent-based architecture.
Avoid unnecessary LLM calls. Prefer deterministic logic wherever possible.
"""

import uuid
from contextlib import asynccontextmanager
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api_response import ProcessResponseEnvelope, utc_timestamp
from db.postgres import get_db, init_db
from db.qdrant import init_qdrant
from services.process_service import process_input
from scheduler.reminder_scheduler import (
    shutdown_reminder_scheduler,
    start_reminder_scheduler,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await init_qdrant()
    start_reminder_scheduler()
    try:
        yield
    finally:
        shutdown_reminder_scheduler()


app = FastAPI(title="TrackerAgent", version="0.1.0", lifespan=lifespan)


class ProcessRequest(BaseModel):
    user_id: str
    input: str
    user_timezone: str | None = None


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/process", response_model=ProcessResponseEnvelope)
async def process(req: ProcessRequest, db: AsyncSession = Depends(get_db)):
    request_id = str(uuid.uuid4())
    tz: ZoneInfo | None = None
    if req.user_timezone:
        try:
            tz = ZoneInfo(req.user_timezone)
        except Exception:
            return ProcessResponseEnvelope(
                success=False,
                type="error",
                response="Invalid timezone identifier.",
                data=None,
                timestamp=utc_timestamp(),
                request_id=request_id,
            )

    result = await process_input(
        req.user_id,
        req.input,
        db,
        request_id=request_id,
        user_timezone=tz,
    )
    return ProcessResponseEnvelope.model_validate(result)
