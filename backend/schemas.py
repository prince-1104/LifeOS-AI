from typing import Literal

from pydantic import BaseModel


class OrchestratorOutput(BaseModel):
    type: Literal["memory", "query", "finance", "reminder", "unknown"]

    content: str | None = None
    tags: list[str] | None = None

    amount: float | None = None
    category: str | None = None
    transaction_type: Literal["income", "expense"] | None = None
    source: str | None = None

    time: str | None = None
    task: str | None = None

    query: str | None = None
