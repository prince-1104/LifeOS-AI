import asyncio
import sys
sys.path.append('.')
from uuid import UUID
from db.postgres import async_session, init_db
from db.models import Transaction
from sqlalchemy import select
from services.db_service import DBService

async def main():
    await init_db()
    async with async_session() as s:
        svc = DBService(s)
        uid = 'user_3CGbs50adm5Qh665IdT5OS5SQvP'
        item = UUID('a736c29c-a6c6-4a92-bd2f-90d48ea16f76')
        
        # Test 1: exact query from original code
        stmt = select(Transaction).where(Transaction.id == item, Transaction.user_id == uid)
        res = await s.execute(stmt)
        row = res.scalar_one_or_none()
        print(f"Test 1 (two conditions): {row is not None}")

        # Test 2: only ID
        stmt2 = select(Transaction).where(Transaction.id == item)
        res2 = await s.execute(stmt2)
        row2 = res2.scalar_one_or_none()
        print(f"Test 2 (one condition): {row2 is not None}")

if __name__ == '__main__':
    asyncio.run(main())
