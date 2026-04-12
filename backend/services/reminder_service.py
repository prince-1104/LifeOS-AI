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
