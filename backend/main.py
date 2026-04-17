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
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api_response import ProcessResponseEnvelope, utc_timestamp
from auth.deps import get_authenticated_user_id, get_current_user
from sqlalchemy import text
from config import get_settings
from db.postgres import get_db, init_db
from db.qdrant import init_qdrant
from services.process_service import process_input
from routes.analytics import router as analytics_router
from routes.admin import router as admin_router
from routes.profile import router as profile_router
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


from timing_middleware import TimingMiddleware

app = FastAPI(title="TrackerAgent", version="0.1.0", lifespan=lifespan)
app.add_middleware(TimingMiddleware)

_settings = get_settings()
_cors_origins = [o.strip() for o in _settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(analytics_router)
app.include_router(admin_router)
app.include_router(profile_router)


class ProcessRequest(BaseModel):
    input: str
    user_timezone: str | None = None


@app.get("/health")
async def health():
    return {"status": "ok"}


async def ensure_user_exists(db, user):
    """Upsert full Clerk profile into the users table.
    Every field is updated on conflict so the DB stays in sync with Clerk.
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info("ensure_user_exists: id=%s email=%s name=%s %s",
                user.id, user.email, user.first_name, user.last_name)

    query = text("""
    INSERT INTO users (id, email, first_name, last_name, username, phone, image_url, last_sign_in_at)
    VALUES (:id, :email, :first_name, :last_name, :username, :phone, :image_url, :last_sign_in_at)
    ON CONFLICT (id) DO UPDATE SET
        email          = COALESCE(EXCLUDED.email, users.email),
        first_name     = COALESCE(EXCLUDED.first_name, users.first_name),
        last_name      = COALESCE(EXCLUDED.last_name, users.last_name),
        username       = COALESCE(EXCLUDED.username, users.username),
        phone          = COALESCE(EXCLUDED.phone, users.phone),
        image_url      = COALESCE(EXCLUDED.image_url, users.image_url),
        last_sign_in_at = COALESCE(EXCLUDED.last_sign_in_at, users.last_sign_in_at),
        updated_at     = NOW()
    """)

    await db.execute(query, {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "phone": user.phone,
        "image_url": user.image_url,
        "last_sign_in_at": user.last_sign_in_at,
    })
    await db.commit()

@app.post("/process", response_model=ProcessResponseEnvelope)
async def process(
    req: ProcessRequest,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    await ensure_user_exists(db, user)
    user_id = user.id
    request_id = str(uuid.uuid4())
    tz: ZoneInfo | None = None
    if req.user_timezone:
        tz_str = req.user_timezone
        if tz_str.upper() == "IST" or tz_str == "Asia/Calcutta":
            tz_str = "Asia/Kolkata"
        try:
            tz = ZoneInfo(tz_str)
        except Exception:
            tz = ZoneInfo("Asia/Kolkata")
    else:
        tz = ZoneInfo("Asia/Kolkata")

    result = await process_input(
        user_id,
        req.input,
        db,
        request_id=request_id,
        user_timezone=tz,
    )
    return ProcessResponseEnvelope.model_validate(result)
