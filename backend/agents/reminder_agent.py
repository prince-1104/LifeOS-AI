from sqlalchemy.ext.asyncio import AsyncSession

from schemas import OrchestratorOutput
from services.reminder_service import insert_reminder
from utils.time_parse import parse_time


async def process(
    user_input: str,
    orch: OrchestratorOutput,
    db: AsyncSession,
    user_id: str,
) -> str:
    del user_input  # orchestrator fields are source of truth
    if not orch.time or not orch.task or not str(orch.task).strip():
        return "I couldn't understand the reminder."

    try:
        reminder_time = parse_time(str(orch.time).strip())
    except ValueError:
        return "I couldn't parse the reminder time."

    task = str(orch.task).strip()
    await insert_reminder(db, user_id, task, reminder_time)

    when = reminder_time.strftime("%Y-%m-%d %H:%M UTC")
    return f"Reminder set for {task} at {when}."
