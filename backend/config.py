from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str
    QDRANT_URL: str

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def ensure_asyncpg_scheme(cls, v: str) -> str:
        """Railway/neutral URLs often use postgresql://; SQLAlchemy async needs postgresql+asyncpg://."""
        if isinstance(v, str) and v.startswith("postgresql://") and not v.startswith(
            "postgresql+asyncpg://"
        ):
            return "postgresql+asyncpg://" + v.removeprefix("postgresql://")
        return v
    QDRANT_API_KEY: str
    OPENAI_API_KEY: str
    GEMINI_API_KEY: str

    DEFAULT_USER_ID: str = "default"
    QDRANT_SCORE_THRESHOLD: float = 0.15

    ORCHESTRATOR_MODEL: str = "gpt-4o-mini"

    FINANCE_HIGH_SPEND_WEEK_THRESHOLD: float = 5000.0

    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 3600

    MAX_INPUT_LENGTH: int = 500

    # Comma-separated origins for browser clients (e.g. Next.js dev server).
    # Includes Expo dev server for mobile web preview.
    CORS_ORIGINS: str = (
        "http://localhost:3006,http://127.0.0.1:3006,"
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:8081,http://127.0.0.1:8081,"
        "http://localhost:19006,http://127.0.0.1:19006"
    )

    # Clerk JWT verification (backend). JWKS URL from Clerk Dashboard → API keys.
    CLERK_JWKS_URL: str = ""
    # Issuer URL, e.g. https://your-instance.clerk.accounts.dev (must match JWT iss).
    CLERK_ISSUER: str = ""
    # Optional; set to verify JWT audience (session token aud).
    CLERK_AUDIENCE: str = ""
    # Optional; used by Clerk Backend API if you add server-side Clerk calls.
    CLERK_SECRET_KEY: str = ""

    # ── Admin panel ──────────────────────────────────────────────────
    ADMIN_EMAIL: str = "princeprasad.dr@gmail.com"
    ADMIN_PASSWORD: str = "admin@123"
    ADMIN_SESSION_EXPIRY_HOURS: int = 24

    # Cost per 1K tokens (USD)
    MODEL_COST_PER_1K: float = 0.002

    # ── OneSignal push notifications ─────────────────────────────────
    ONESIGNAL_APP_ID: str = ""
    ONESIGNAL_REST_API_KEY: str = ""

    # ── Cashfree Payments (subscription billing) ───────────────────────
    CASHFREE_CLIENT_ID: str = ""
    CASHFREE_CLIENT_SECRET: str = ""
    CASHFREE_WEBHOOK_SECRET: str = ""
    CASHFREE_ENV: str = "sandbox"  # "sandbox" or "production"

    # ── Currency conversion ──────────────────────────────────────────
    INR_PER_USD: float = 83.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
