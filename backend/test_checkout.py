import asyncio
import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pydantic import BaseModel
import pytest

from config import Settings, get_settings
from routes.stripe_routes import create_subscription, CreateSubscriptionRequest
from db.postgres import async_session
from sqlalchemy import text

async def run_test():
    # Mock environment to ensure CASHFREE_CLIENT_ID is set
    os.environ["CASHFREE_CLIENT_ID"] = "mock_client"
    os.environ["CASHFREE_CLIENT_SECRET"] = "mock_secret"
    os.environ["CASHFREE_ENV"] = "sandbox"
    
    req = CreateSubscriptionRequest(
        plan_id="standard_49",
        billing_cycle="monthly",
        return_url="http://localhost:3000/billing"
    )

    async with async_session() as db:
        # Get a random user
        try:
            res = await db.execute(text("SELECT id FROM users LIMIT 1"))
            user_id = res.scalar()
            if not user_id:
                print("No user found in DB. Test abbreviated.")
                return
            
            print(f"Testing with user {user_id}...")
            
            # This calls the route exactly like the endpoint
            response = await create_subscription(req, db, user_id)
            print("SUCCESS:", response)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            print("ERROR CAUGHT!")

if __name__ == "__main__":
    asyncio.run(run_test())
