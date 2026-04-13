import asyncio
import sys
sys.path.append('.')
from db.postgres import async_session, init_db
from db.models import Transaction, Reminder, Memory
from sqlalchemy import select

async def main():
    await init_db()
    async with async_session() as s:
        res = await s.execute(select(Transaction))
        print("Transactions:", [str(r.id) for r in res.scalars().all()])
        
        res = await s.execute(select(Reminder))
        print("Reminders:", [str(r.id) for r in res.scalars().all()])

        res = await s.execute(select(Memory))
        print("Memories:", [str(r.id) for r in res.scalars().all()])

if __name__ == '__main__':
    asyncio.run(main())
