import asyncio
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta
from sqlalchemy import select
from db.postgres import async_session
from db.models import User

async def run():
    async with async_session() as db:
        user_id = "user_3CZsF9sfZs6jq6XeMvJ8i5WlYJg"
        stmt = select(User).where(User.id == user_id)
        user = (await db.execute(stmt)).scalar_one_or_none()
        
        if not user:
            print(f"User {user_id} not found!")
            return
            
        print(f"Found user: {user.first_name} {user.last_name}")
        
        user.plan = "basic_29"
        user.plan_start_date = datetime.now(timezone.utc)
        user.plan_end_date = datetime.now(timezone.utc) + relativedelta(months=1)
        user.stripe_subscription_id = "order_user_3CZ_ee470605"
        
        await db.commit()
        print("User successfully synced to basic_29 plan!")

if __name__ == "__main__":
    asyncio.run(run())
