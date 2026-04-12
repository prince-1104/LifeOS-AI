import re
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from schemas import OrchestratorOutput
from services.db_service import DBService


def infer_transaction_type(user_input: str) -> str:
    """Heuristic income vs expense from natural language (no extra LLM call)."""
    low = user_input.lower()
    if "received" in low:
        return "income"
    if re.search(r"\b(?:earned|salary)\b", low):
        return "income"
    if re.search(r"\bgot\s+paid\b", low) or re.search(r"\bpaid\s+me\b", low):
        return "income"
    return "expense"


def extract_source(user_input: str, txn_type: str) -> str | None:
    if txn_type == "income":
        m = re.search(r"from\s+([A-Za-z][A-Za-z0-9]*)", user_input, re.I)
        return m.group(1) if m else None
    m = re.search(
        r"(?:paid|send|sent|give|gave)\s+[\d.]+\s+to\s+([A-Za-z][A-Za-z0-9]*)",
        user_input,
        re.I,
    )
    if m:
        return m.group(1)
    m = re.search(r"(?:to|for)\s+([A-Za-z][A-Za-z0-9]*)", user_input, re.I)
    return m.group(1) if m else None


async def process(
    user_input: str,
    orch: OrchestratorOutput,
    db: AsyncSession,
    user_id: str,
) -> str:
    if orch.amount is None:
        return "I couldn't understand the amount."

    txn_type = (
        orch.transaction_type if orch.transaction_type is not None else infer_transaction_type(user_input)
    )
    source = orch.source if orch.source and str(orch.source).strip() else extract_source(user_input, txn_type)

    cat_raw = orch.category
    if cat_raw is not None and str(cat_raw).strip():
        category = str(cat_raw).strip()
    else:
        category = "general"

    data = {
        "type": txn_type,
        "amount": Decimal(str(orch.amount)),
        "category": category,
        "note": None,
        "source": source,
        "event_time": datetime.now(timezone.utc),
    }

    svc = DBService(db)
    await svc.insert_transaction(user_id, data)

    sym = "₹"
    if txn_type == "income":
        return (
            f"Recorded income of {sym}{orch.amount:g}"
            + (f" from {source}." if source else ".")
        )
    return (
        f"Recorded expense of {sym}{orch.amount:g}"
        + f" for {category}"
        + (f" ({source})." if source else ".")
    )
