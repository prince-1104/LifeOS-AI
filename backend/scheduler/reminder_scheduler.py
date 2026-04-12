"""Background polling for due reminders (APScheduler + async SQLAlchemy)."""

from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, update

from db.models import Reminder
from db.postgres import async_session

scheduler = AsyncIOScheduler()


async def process_due_reminders() -> None:
    now = datetime.now(timezone.utc)
    async with async_session() as session:
        stmt = select(Reminder.id, Reminder.task).where(
            Reminder.status == "pending",
            Reminder.reminder_time <= now,
        )
        result = await session.execute(stmt)
        rows = list(result.all())
        if not rows:
            return

        for rid, task in rows:
            print(f"\U0001f514 Reminder: {task}")

        await session.execute(
            update(Reminder)
            .where(Reminder.id.in_([r[0] for r in rows]))
            .values(status="done")
        )
        await session.commit()


def start_reminder_scheduler(interval_seconds: int = 30) -> None:
    scheduler.add_job(
        process_due_reminders,
        "interval",
        seconds=interval_seconds,
        id="process_due_reminders",
        replace_existing=True,
    )
    if not scheduler.running:
        scheduler.start()


def shutdown_reminder_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
