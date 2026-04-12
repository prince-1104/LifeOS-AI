from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import User

# In-memory set of user IDs we have already upserted this process lifetime.
# Avoids a DB round-trip on every single API call (~300ms saved per request
# after the first one for each user).
_known_users: set[str] = set()


async def ensure_user_exists(
    session: AsyncSession,
    user_id: str,
    email: str | None,
) -> None:
    """
    INSERT INTO users (id, email)
    VALUES (%s, %s)
    ON CONFLICT (id) DO NOTHING

    Skips the DB call entirely if we already upserted this user during this
    server process lifetime.
    """
    if user_id in _known_users:
        return

    stmt = (
        insert(User)
        .values(id=user_id, email=email)
        .on_conflict_do_nothing(index_elements=["id"])
    )
    await session.execute(stmt)
    await session.commit()
    _known_users.add(user_id)
