import asyncio
import sys
sys.path.append('.')
from uuid import UUID
from db.postgres import async_session, init_db
from db.models import Transaction, Memory, Reminder
from sqlalchemy import select

async def main():
    await init_db()
    async with async_session() as s:
        stmt = select(Transaction).where(Transaction.id == UUID('a736c29c-a6c6-4a92-bd2f-90d48ea16f76'))
        res = await s.execute(stmt)
        r = res.scalar_one_or_none()
        if r is None:
            print("Transaction Not Found in DB")
            # Let's see what IS in the db
            res2 = await s.execute(select(Transaction))
            for tr in res2.scalars().all():
                print(f"Row: id={tr.id}, user_id={tr.user_id}")
        else:
            print(f"Transaction Found! id={r.id}, user_id={r.user_id}")

if __name__ == '__main__':
    asyncio.run(main())
