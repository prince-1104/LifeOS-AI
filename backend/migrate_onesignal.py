"""Add onesignal_player_id column to users table."""
import asyncio

from sqlalchemy import text

from db.postgres import async_session


async def migrate():
    async with async_session() as s:
        await s.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT")
        )
        await s.commit()
        print("Migration done: onesignal_player_id column added.")


if __name__ == "__main__":
    asyncio.run(migrate())
