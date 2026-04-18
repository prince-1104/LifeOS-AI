from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from schemas import OrchestratorOutput
from services.reminder_service import insert_reminder
from utils.time_parse import parse_time


async def process(
    user_input: str,
    orch: OrchestratorOutput,
    db: AsyncSession,
    user_id: str,
    user_timezone: ZoneInfo | None = None,
) -> str:
    del user_input  # orchestrator fields are source of truth
    if not orch.time or not orch.task or not str(orch.task).strip():
        return "I couldn't understand the reminder."

    try:
        reminder_time = parse_time(str(orch.time).strip(), user_tz=user_timezone)
    except ValueError:
        return "I couldn't parse the reminder time."

    task = str(orch.task).strip()
    await insert_reminder(db, user_id, task, reminder_time)

    # Format the response in user time if timezone is known
    display_time = reminder_time
    time_suffix = ""
    if user_timezone is not None:
        display_time = display_time.astimezone(user_timezone)
    else:
        time_suffix = " (UTC)"
        
    when = display_time.strftime("%I:%M %p").lstrip("0") + time_suffix
    if display_time.date() != reminder_time.date():
        when = display_time.strftime("%b %d, %I:%M %p").lstrip("0") + time_suffix

    return f"Reminder set for '{task}' at {when}."
