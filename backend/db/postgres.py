from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=False,  # disabled because 1 round-trip adds 250+ ms latency to Neon 
    pool_size=5,          # keep connections alive
    max_overflow=10,
    pool_recycle=1800     # 30 mins recycle
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session


async def init_db():
    import db.models  # noqa: F401 — register Memory, Transaction, Reminder on Base.metadata

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                "ALTER TABLE memories ADD COLUMN IF NOT EXISTS user_id "
                "VARCHAR(255) NOT NULL DEFAULT 'default'"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(36)"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS latency_ms_total NUMERIC(12,3)"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE reminders ADD COLUMN IF NOT EXISTS snooze_count INTEGER DEFAULT 0 NOT NULL"
            )
        )
        # ── User profile columns (Clerk sync) ────────────────────────
        for col_def in [
            "first_name VARCHAR(255)",
            "last_name VARCHAR(255)",
            "username VARCHAR(255)",
            "phone VARCHAR(50)",
            "image_url TEXT",
            "last_sign_in_at TIMESTAMPTZ",
            "updated_at TIMESTAMPTZ DEFAULT NOW()",
        ]:
            await conn.execute(
                text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_def}")
            )
        # ── Subscription columns ─────────────────────────────────────
        for col_def in [
            "plan VARCHAR(50) NOT NULL DEFAULT 'free'",
            "stripe_customer_id VARCHAR(255)",
            "stripe_subscription_id VARCHAR(255)",
            "plan_start_date TIMESTAMPTZ",
            "plan_end_date TIMESTAMPTZ",
        ]:
            await conn.execute(
                text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_def}")
            )


