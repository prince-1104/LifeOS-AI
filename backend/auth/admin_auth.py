from fastapi import Depends, HTTPException, status
from auth.deps import get_current_user
from config import get_settings
# ── FastAPI Dependencies ──────────────────────────────────────────────


async def get_admin_session(
    user = Depends(get_current_user),
) -> str:
    """FastAPI dependency: validates admin via Clerk.

    Returns the user id string if valid admin, raises 401/403 otherwise.
    """
    settings = get_settings()
    
    if not user.email or user.email.lower() != settings.ADMIN_EMAIL.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return user.id
