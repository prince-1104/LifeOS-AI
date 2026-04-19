"""Admin password authentication and session management.

Login checks a DB-stored password override first, then falls back to
the ADMIN_PASSWORD in config / .env.  The "forgot password" flow stores
a 6-digit reset code in the admin_otp table (logged to the console when
SMTP is not configured) and lets the admin set a new password.
"""

import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from db.models import AdminConfig, AdminOtp, AdminSession
from db.postgres import get_db

logger = logging.getLogger(__name__)

ADMIN_PASSWORD_KEY = "admin_password"


# ── Password Verification ─────────────────────────────────────────────


async def verify_admin_credentials(
    db: AsyncSession, email: str, password: str
) -> bool:
    """Check email + password.

    Priority: DB override (hashed) → config default.
    """
    settings = get_settings()
    if email != settings.ADMIN_EMAIL:
        return False

    # Check DB override first
    stmt = select(AdminConfig.value).where(AdminConfig.key == ADMIN_PASSWORD_KEY)
    result = await db.execute(stmt)
    db_password_hash = result.scalar_one_or_none()

    if db_password_hash is not None:
        try:
            salt_hex, stored_hash = db_password_hash.split(":")
            salt = bytes.fromhex(salt_hex)
            pwd_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
            return pwd_hash.hex() == stored_hash
        except Exception:
            return False

    # Fallback to plain environment variable (if not set in DB yet)
    return password == settings.ADMIN_PASSWORD


# ── Forgot-Password Flow ─────────────────────────────────────────────


def generate_reset_code() -> str:
    """Generate a 6-digit numeric reset code."""
    return f"{secrets.randbelow(900000) + 100000}"


async def store_reset_code(db: AsyncSession, email: str, code: str) -> None:
    """Delete any previous codes for this email, then store a new one."""
    settings = get_settings()
    await db.execute(delete(AdminOtp).where(AdminOtp.email == email))

    row = AdminOtp(
        email=email,
        otp=code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(row)
    await db.commit()

    # Log to console (for dev / when SMTP is not configured)
    logger.info("Password-reset code for %s: %s", email, code)
    print(f"\n{'='*50}")
    print(f"  PASSWORD RESET CODE for {email}: {code}")
    print(f"{'='*50}\n")


async def verify_reset_code(db: AsyncSession, email: str, code: str) -> bool:
    """Validate a reset code and delete it on success (single-use)."""
    stmt = select(AdminOtp).where(
        AdminOtp.email == email,
        AdminOtp.otp == code,
        AdminOtp.expires_at > datetime.now(timezone.utc),
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if not row:
        return False

    await db.delete(row)
    await db.commit()
    return True


async def set_admin_password(db: AsyncSession, new_password: str) -> None:
    """Persist a new admin password block securely in the DB (overrides config default)."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    salt = os.urandom(16)
    pwd_hash = hashlib.pbkdf2_hmac("sha256", new_password.encode("utf-8"), salt, 100000)
    hashed_value = f"{salt.hex()}:{pwd_hash.hex()}"

    stmt = pg_insert(AdminConfig).values(
        key=ADMIN_PASSWORD_KEY,
        value=hashed_value,
    ).on_conflict_do_update(
        index_elements=["key"],
        set_={"value": hashed_value},
    )
    await db.execute(stmt)
    await db.commit()


# ── Session Management ────────────────────────────────────────────────


async def create_admin_session(db: AsyncSession) -> str:
    """Create a new admin session and return the bearer token."""
    settings = get_settings()
    token = secrets.token_urlsafe(48)

    row = AdminSession(
        token=token,
        expires_at=datetime.now(timezone.utc)
        + timedelta(hours=settings.ADMIN_SESSION_EXPIRY_HOURS),
    )
    db.add(row)
    await db.commit()
    return token


async def validate_session(db: AsyncSession, token: str) -> bool:
    """Check if a session token is valid and not expired."""
    stmt = select(AdminSession).where(
        AdminSession.token == token,
        AdminSession.expires_at > datetime.now(timezone.utc),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None


# ── FastAPI Dependencies ──────────────────────────────────────────────


async def get_admin_session(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> str:
    """FastAPI dependency: validates admin bearer token.

    Returns the token string if valid, raises 401 otherwise.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid admin token",
        )

    token = auth.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty admin token",
        )

    is_valid = await validate_session(db, token)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin session",
        )

    return token
