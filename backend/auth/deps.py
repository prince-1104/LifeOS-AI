"""FastAPI dependencies: verified Clerk user id + profile sync."""

import logging
from datetime import datetime, timezone
from typing import Annotated

import httpx
from fastapi import Depends, Request

from auth.clerk_jwt import verify_clerk_bearer_token
from config import get_settings

logger = logging.getLogger(__name__)

# ── Lightweight DTO returned by get_current_user ──────────────────────


class CurrentUser:
    """Carries all Clerk profile fields needed for DB sync."""

    def __init__(
        self,
        id: str,
        email: str | None = None,
        first_name: str | None = None,
        last_name: str | None = None,
        username: str | None = None,
        phone: str | None = None,
        image_url: str | None = None,
        last_sign_in_at: datetime | None = None,
    ):
        self.id = id
        self.email = email
        self.first_name = first_name
        self.last_name = last_name
        self.username = username
        self.phone = phone
        self.image_url = image_url
        self.last_sign_in_at = last_sign_in_at

    def __repr__(self) -> str:
        return f"CurrentUser(id={self.id!r}, email={self.email!r})"


# ── Helpers ───────────────────────────────────────────────────────────

def _epoch_ms_to_dt(ms: int | None) -> datetime | None:
    """Convert Clerk epoch-millisecond timestamp to a timezone-aware datetime."""
    if ms is None:
        return None
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)


async def _fetch_clerk_profile(user_id: str) -> dict | None:
    """Fetch full user object from Clerk Backend API using CLERK_SECRET_KEY."""
    settings = get_settings()
    secret = settings.CLERK_SECRET_KEY
    if not secret or not secret.strip():
        logger.warning("CLERK_SECRET_KEY not set - cannot fetch user profile")
        return None

    url = f"https://api.clerk.com/v1/users/{user_id}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {secret}"},
            )
            if resp.status_code != 200:
                logger.warning("Clerk API %s returned %s", url, resp.status_code)
                return None
            return resp.json()
    except Exception:
        logger.exception("Failed to fetch profile from Clerk API for %s", user_id)
    return None


def _extract_primary_email(data: dict) -> str | None:
    """Pull the primary email from Clerk user object."""
    for ea in data.get("email_addresses", []):
        if ea.get("id") == data.get("primary_email_address_id"):
            return ea.get("email_address")
    addrs = data.get("email_addresses", [])
    if addrs:
        return addrs[0].get("email_address")
    return None


def _extract_primary_phone(data: dict) -> str | None:
    """Pull the primary phone from Clerk user object."""
    for pn in data.get("phone_numbers", []):
        if pn.get("id") == data.get("primary_phone_number_id"):
            return pn.get("phone_number")
    phones = data.get("phone_numbers", [])
    if phones:
        return phones[0].get("phone_number")
    return None


def _clerk_data_to_current_user(user_id: str, data: dict) -> CurrentUser:
    """Map the raw Clerk API response to a CurrentUser DTO."""
    return CurrentUser(
        id=user_id,
        email=_extract_primary_email(data),
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        username=data.get("username"),
        phone=_extract_primary_phone(data),
        image_url=data.get("image_url"),
        last_sign_in_at=_epoch_ms_to_dt(data.get("last_sign_in_at")),
    )


# ── FastAPI Dependencies ──────────────────────────────────────────────


async def get_current_user(
    request: Request,
) -> CurrentUser:
    """Extract user identity from JWT then enrich with full Clerk profile."""
    sub, _claims = verify_clerk_bearer_token(request.headers.get("Authorization"))

    profile = await _fetch_clerk_profile(sub)
    if profile:
        return _clerk_data_to_current_user(sub, profile)

    # Fallback: minimal user if Clerk API is unreachable
    return CurrentUser(id=sub)


async def get_authenticated_user_id(
    request: Request,
) -> str:
    """Lightweight dependency - returns just the user_id string (no API call)."""
    sub, _claims = verify_clerk_bearer_token(request.headers.get("Authorization"))
    return sub


AuthenticatedUserId = Annotated[str, Depends(get_authenticated_user_id)]
