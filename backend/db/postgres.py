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

        # ── Batch 1: core table migrations (single round-trip) ────────
        await conn.execute(
            text(
                "ALTER TABLE memories ADD COLUMN IF NOT EXISTS user_id "
                "VARCHAR(255) NOT NULL DEFAULT 'default';\n"
                "ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(36);\n"
                "ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS latency_ms_total NUMERIC(12,3);\n"
                "ALTER TABLE reminders ADD COLUMN IF NOT EXISTS snooze_count INTEGER DEFAULT 0 NOT NULL;"
            )
        )

        # ── Batch 2: user profile columns (single round-trip) ────────
        await conn.execute(
            text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);\n"
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);\n"
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);\n"
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);\n"
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS image_url TEXT;\n"
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;\n"
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();"
            )
        )

        # ── Batch 3: subscription columns (single round-trip) ────────
        await conn.execute(
            text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(50) NOT NULL DEFAULT 'free';\n"
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);\n"
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);\n"
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_start_date TIMESTAMPTZ;\n"
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_end_date TIMESTAMPTZ;"
            )
        )


