"""Standardized POST /process response envelope and structured `data` payloads."""

from datetime import datetime, timezone

from pydantic import BaseModel

from schemas import OrchestratorOutput


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class ProcessResponseEnvelope(BaseModel):
    success: bool
    type: str
    response: str
    data: dict | None = None
    timestamp: str
    request_id: str


def build_data_payload(orch: OrchestratorOutput, result_type: str) -> dict | None:
    """Structured fields for the UI; omit nulls and redundant blobs."""
    if result_type == "memory":
        out: dict = {}
        if orch.content:
            out["content"] = orch.content
        if orch.tags:
            out["tags"] = orch.tags
        return out or None

    if result_type == "query":
        if orch.query:
            return {"query": orch.query}
        return None

    if result_type == "finance":
        d: dict = {}
        if orch.amount is not None:
            d["amount"] = orch.amount
        if orch.category:
            d["category"] = orch.category
        if orch.transaction_type:
            d["transaction_type"] = orch.transaction_type
        if orch.source:
            d["source"] = orch.source
        return d or None

    if result_type == "reminder":
        r: dict = {}
        if orch.task:
            r["task"] = orch.task
        if orch.time:
            r["time"] = orch.time
        return r or None

    if result_type == "unknown":
        return None

    return None


def build_multi_data_payload(
    orch_list: list[OrchestratorOutput],
    type_list: list[str],
) -> dict | None:
    """Build a data payload containing an `items` array for multi-item responses."""
    items = []
    for orch, t in zip(orch_list, type_list):
        item_data = build_data_payload(orch, t)
        if item_data is not None:
            item_data["type"] = t
        else:
            item_data = {"type": t}
        items.append(item_data)
    return {"items": items} if items else None
