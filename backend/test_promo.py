import asyncio
from db.postgres import get_db, async_session
from sqlalchemy import text

async def check():
    async with async_session() as db:
        result = await db.execute(text("SELECT email, plan FROM users WHERE stripe_subscription_id='order_user_3CZ_527c153d'"))
        with open("out3.txt", "w", encoding="utf-8") as f:
            for row in result.fetchall():
                f.write(str(row) + "\n")

if __name__ == "__main__":
    asyncio.run(check())
