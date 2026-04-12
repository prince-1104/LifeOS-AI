"""Verify Clerk session JWTs using JWKS."""

from functools import lru_cache
from typing import Any

import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient

from config import get_settings


@lru_cache
def _jwk_client() -> PyJWKClient:
    settings = get_settings()
    if not settings.CLERK_JWKS_URL or not settings.CLERK_JWKS_URL.strip():
        raise RuntimeError("CLERK_JWKS_URL is not configured")
    return PyJWKClient(
        settings.CLERK_JWKS_URL,
        cache_jwk_set=True,
        lifespan=3600,
    )


def verify_clerk_bearer_token(authorization: str | None) -> tuple[str, dict[str, Any]]:
    """
    Parse Authorization: Bearer <jwt>, verify signature via Clerk JWKS, return (sub, claims).
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty bearer token",
        )
    settings = get_settings()
    try:
        jwk_client = _jwk_client()
        signing_key = jwk_client.get_signing_key_from_jwt(token)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Server auth is not configured",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from e

    iss = settings.CLERK_ISSUER.strip() if settings.CLERK_ISSUER else None
    aud = settings.CLERK_AUDIENCE.strip() if settings.CLERK_AUDIENCE else None
    decode_kw: dict[str, Any] = {
        "algorithms": ["RS256"],
        "options": {
            "verify_signature": True,
            "verify_exp": True,
            "verify_aud": bool(aud),
            "verify_iss": bool(iss),
        },
    }
    if iss:
        decode_kw["issuer"] = iss
    if aud:
        decode_kw["audience"] = aud
    try:
        payload = jwt.decode(token, signing_key.key, **decode_kw)
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from e

    sub = payload.get("sub")
    if not sub or not isinstance(sub, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )
    return sub, payload
