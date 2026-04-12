from sqlalchemy.ext.asyncio import AsyncSession

from agents import memory_agent, query_agent
from schemas import OrchestratorOutput


def _finance_stub(orch: OrchestratorOutput) -> str:
    parts = ["Finance tracking is not implemented yet."]
    if orch.amount is not None:
        parts.append(f"Parsed amount: {orch.amount}.")
    if orch.category:
        parts.append(f"Category: {orch.category}.")
    return " ".join(parts)


def _reminder_stub(orch: OrchestratorOutput) -> str:
    parts = ["Reminders / scheduler are not implemented yet."]
    if orch.task:
        parts.append(f"Task: {orch.task}.")
    if orch.time:
        parts.append(f"Time: {orch.time}.")
    return " ".join(parts)


async def route(
    user_input: str,
    orch: OrchestratorOutput,
    db: AsyncSession,
    user_id: str,
) -> tuple[str, str]:
    """
    Dispatch by orchestrator type. Returns (response_text, type_string).
    """
    t = orch.type

    if t == "memory":
        text = await memory_agent.process(
            user_input,
            db,
            user_id=user_id,
            orchestrator=orch,
        )
        return text, "memory"

    if t == "query":
        q = orch.query if orch.query else user_input
        text = await query_agent.process(q, user_id=user_id)
        return text, "query"

    if t == "finance":
        return _finance_stub(orch), "finance"

    if t == "reminder":
        return _reminder_stub(orch), "reminder"

    return "I didn't understand.", "unknown"
