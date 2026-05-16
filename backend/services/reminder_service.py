"""Async persistence for reminders."""

from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Reminder


async def insert_reminder(
    session: AsyncSession,
    user_id: str,
    task: str,
    reminder_time: datetime,
) -> UUID:
    row = Reminder(
        user_id=user_id,
        task=task,
        reminder_time=reminder_time,
        status="pending",
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row.id


async def cancel_previous_reminder_by_task(
    session: AsyncSession,
    user_id: str,
    task_substring: str,
) -> bool:
    """Find a pending reminder matching the task substring and cancel it. Returns True if one was cancelled."""
    from sqlalchemy import select

    # Find the most recently created pending reminder matching the task
    stmt = (
        select(Reminder)
        .where(Reminder.user_id == user_id)
        .where(Reminder.status == "pending")
        .where(Reminder.task.ilike(f"%{task_substring}%"))
        .order_by(Reminder.created_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    reminder = result.scalar_one_or_none()

    if reminder:
        reminder.status = "done"  # Use "done" to effectively cancel it since check constraint requires pending/done
        await session.commit()
        return True
    return False
