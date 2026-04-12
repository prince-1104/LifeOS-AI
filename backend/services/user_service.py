"""Persist Clerk users on first authenticated request."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import User


async def ensure_user(
    session: AsyncSession,
    user_id: str,
    email: str | None,
) -> None:
    result = await session.execute(select(User).where(User.id == user_id))
    row = result.scalar_one_or_none()
    if row is None:
        session.add(User(id=user_id, email=email))
        await session.commit()
        return
    if email and row.email != email:
        row.email = email
        await session.commit()
