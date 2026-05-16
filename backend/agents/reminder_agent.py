from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from schemas import OrchestratorOutput
from services.reminder_service import insert_reminder
from utils.time_parse import parse_time

import logging

logger = logging.getLogger(__name__)


async def process(
    user_input: str,
    orch: OrchestratorOutput,
    db: AsyncSession,
    user_id: str,
    user_timezone: ZoneInfo | None = None,
) -> str:
    if not orch.task or not str(orch.task).strip():
        return "❌ I couldn't understand the reminder. Please specify what to remind you about."

    task = str(orch.task).strip()
    reminder_time = None

    # Try parsing the orchestrator's time field first
    if orch.time and str(orch.time).strip():
        orch_time = str(orch.time).strip()
        logger.info(
            "Reminder parse: orch.time=%r, user_tz=%s, raw_input=%r",
            orch_time, user_timezone, user_input,
        )
        try:
            reminder_time = parse_time(orch_time, user_tz=user_timezone)
            logger.info(
                "Reminder parsed successfully: orch.time=%r → UTC=%s",
                orch_time, reminder_time.isoformat(),
            )
        except ValueError as exc:
            logger.warning(
                "Failed to parse orchestrator time %r (%s), trying raw input",
                orch_time, exc,
            )

    # Fallback: try extracting time from the raw user input
    if reminder_time is None and user_input:
        logger.info("Falling back to raw input parsing for: %r", user_input)
        try:
            reminder_time = _try_parse_from_raw_input(user_input, user_timezone)
            if reminder_time:
                logger.info(
                    "Fallback parse succeeded: raw=%r → UTC=%s",
                    user_input, reminder_time.isoformat(),
                )
        except Exception:
            logger.debug("Fallback time parse from raw input also failed")

    if reminder_time is None:
        return (
            "❌ I couldn't parse the reminder time. "
            "Try something like 'tomorrow 5pm', 'Monday 10am', or 'in 30 minutes'."
        )

    await insert_reminder(db, user_id, task, reminder_time)

    # Format the response in user time if timezone is known
    display_time = reminder_time
    time_suffix = ""
    if user_timezone is not None:
        display_time = display_time.astimezone(user_timezone)
        now_local = datetime.now(timezone.utc).astimezone(user_timezone)
    else:
        time_suffix = " (UTC)"
        now_local = datetime.now(timezone.utc)

    # Show date+time if reminder is NOT today (in the user's local timezone)
    if display_time.date() != now_local.date():
        when = display_time.strftime("%b %d, %I:%M %p").lstrip("0") + time_suffix
    else:
        when = display_time.strftime("%I:%M %p").lstrip("0") + time_suffix

    logger.info(
        "Reminder created: task=%r, utc=%s, display=%s, when=%s",
        task, reminder_time.isoformat(), display_time.isoformat(), when,
    )

    return f"⏰ Reminder set for '{task}' at {when}."


def _try_parse_from_raw_input(
    user_input: str, user_tz: ZoneInfo | None
) -> "datetime | None":
    """Try to extract time from the raw user input by scanning for
    common time expressions. This is a fallback when the LLM's time
    field is malformed or misspelled."""
    import re

    low = user_input.lower()

    # Try direct parse of the whole input (unlikely but fast)
    try:
        return parse_time(low, user_tz=user_tz)
    except ValueError:
        pass

    # Try extracting after common prepositions:
    # "at 5pm", "for tomorrow 5pm", "on Monday 10am"
    patterns = [
        # Bare time: "4:30pm", "7pm", "10:30am", "14:00"
        r"(\d{1,2}(?::\d{2})?\s*(?:am|pm))",
        r"(\d{1,2}:\d{2})",
        # After prepositions: "at 5pm", "by 7pm"
        r"(?:at|for|on|by)\s+(.+?)(?:\s+(?:to|for)\s+|$)",
        r"(?:tomorrow|tmrw|tommorow|kal)\s*(.*)",
        r"((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+.+)",
        r"((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d+.+)",
        r"(?:in|after)\s+(\d+\s*(?:min|hour|minute|hr|h|m)s?)",
    ]
    for pattern in patterns:
        m = re.search(pattern, low, re.I)
        if m:
            try:
                return parse_time(m.group(1).strip(), user_tz=user_tz)
            except ValueError:
                pass
            try:
                return parse_time(m.group(0).strip(), user_tz=user_tz)
            except ValueError:
                continue

    return None
