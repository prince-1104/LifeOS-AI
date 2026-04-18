"""User profile endpoints — get and update profile fields."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from auth.deps import get_current_user
from db.postgres import get_db
from services.user_sync import ensure_user_exists

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/user", tags=["profile"])


class ProfileResponse(BaseModel):
    id: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    image_url: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    hobbies: Optional[str] = None
    profile_complete: bool = False


class ProfileUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    hobbies: Optional[str] = None


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's profile from the DB."""
    await ensure_user_exists(db, user)

    result = await db.execute(
        text("SELECT * FROM users WHERE id = :id"), {"id": user.id}
    )
    row = result.mappings().first()

    if not row:
        return ProfileResponse(id=user.id, profile_complete=False)

    has_name = bool(row.get("first_name"))
    has_age = row.get("age") is not None
    has_gender = bool(row.get("gender"))
    profile_complete = has_name and has_age and has_gender

    return ProfileResponse(
        id=row["id"],
        email=row.get("email"),
        first_name=row.get("first_name"),
        last_name=row.get("last_name"),
        phone=row.get("phone"),
        image_url=row.get("image_url"),
        age=row.get("age"),
        gender=row.get("gender"),
        address=row.get("address"),
        hobbies=row.get("hobbies"),
        profile_complete=profile_complete,
    )


@router.put("/profile", response_model=ProfileResponse)
async def update_profile(
    body: ProfileUpdateRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update profile fields (age, gender, address, hobbies, name)."""
    await ensure_user_exists(db, user)

    # Build SET clause dynamically from non-None fields
    updates = {}
    if body.first_name is not None:
        updates["first_name"] = body.first_name
    if body.last_name is not None:
        updates["last_name"] = body.last_name
    if body.age is not None:
        updates["age"] = body.age
    if body.gender is not None:
        updates["gender"] = body.gender
    if body.address is not None:
        updates["address"] = body.address
    if body.hobbies is not None:
        updates["hobbies"] = body.hobbies

    if updates:
        set_parts = [f"{k} = :{k}" for k in updates]
        set_parts.append("updated_at = NOW()")
        set_clause = ", ".join(set_parts)
        updates["id"] = user.id

        await db.execute(
            text(f"UPDATE users SET {set_clause} WHERE id = :id"), updates
        )
        await db.commit()
        logger.info("Profile updated for user %s: %s", user.id, list(updates.keys()))

    return await get_profile(user=user, db=db)
