"""Upsert Clerk profile data into the local users table."""

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from auth.deps import CurrentUser

logger = logging.getLogger(__name__)


async def ensure_user_exists(db: AsyncSession, user: CurrentUser) -> None:
    """Insert or update a user row so the DB always mirrors Clerk."""
    logger.info(
        "ensure_user_exists: id=%s email=%s name=%s %s",
        user.id, user.email, user.first_name, user.last_name,
    )

    query = text("""
    INSERT INTO users (id, email, first_name, last_name, username, phone, image_url, last_sign_in_at)
    VALUES (:id, :email, :first_name, :last_name, :username, :phone, :image_url, :last_sign_in_at)
    ON CONFLICT (id) DO UPDATE SET
        email          = COALESCE(EXCLUDED.email, users.email),
        first_name     = COALESCE(EXCLUDED.first_name, users.first_name),
        last_name      = COALESCE(EXCLUDED.last_name, users.last_name),
        username       = COALESCE(EXCLUDED.username, users.username),
        phone          = COALESCE(EXCLUDED.phone, users.phone),
        image_url      = COALESCE(EXCLUDED.image_url, users.image_url),
        last_sign_in_at = COALESCE(EXCLUDED.last_sign_in_at, users.last_sign_in_at),
        updated_at     = NOW()
    """)

    await db.execute(query, {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "phone": user.phone,
        "image_url": user.image_url,
        "last_sign_in_at": user.last_sign_in_at,
    })
    await db.commit()
