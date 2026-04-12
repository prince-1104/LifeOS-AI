from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str
    QDRANT_URL: str
    QDRANT_API_KEY: str
    OPENAI_API_KEY: str
    GEMINI_API_KEY: str

    DEFAULT_USER_ID: str = "default"
    QDRANT_SCORE_THRESHOLD: float = 0.25

    ORCHESTRATOR_MODEL: str = "gpt-4o-mini"

    FINANCE_HIGH_SPEND_WEEK_THRESHOLD: float = 5000.0

    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 3600

    MAX_INPUT_LENGTH: int = 500


@lru_cache
def get_settings() -> Settings:
    return Settings()
