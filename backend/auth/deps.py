"""FastAPI dependencies: verified Clerk user id + DB upsert."""

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from auth.clerk_jwt import verify_clerk_bearer_token
from db.postgres import get_db
from services.user_service import ensure_user


def _claims_email(claims: dict) -> str | None:
    e = claims.get("email")
    if isinstance(e, str) and e.strip():
        return e.strip()
    return None


async def get_authenticated_user_id(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> str:
    sub, claims = verify_clerk_bearer_token(request.headers.get("Authorization"))
    await ensure_user(db, sub, _claims_email(claims))
    return sub


AuthenticatedUserId = Annotated[str, Depends(get_authenticated_user_id)]
