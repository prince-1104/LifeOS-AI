"""Background polling for due reminders (APScheduler + async SQLAlchemy).

When a reminder becomes due the scheduler:
1. Uses the Clerk user_id directly as OneSignal external_user_id.
2. Sends a real push notification via the OneSignal REST API.
3. Falls back to console logging when OneSignal is not configured.
4. Marks the reminder as 'done' regardless.

No DB join needed — OneSignal resolves external_user_id → device(s).
"""

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, update

from db.models import Reminder
from db.postgres import async_session
from services.onesignal_service import send_push

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def process_due_reminders() -> None:
    now = datetime.now(timezone.utc)
    async with async_session() as session:
        stmt = select(Reminder.id, Reminder.user_id, Reminder.task).where(
            Reminder.status == "pending",
            Reminder.reminder_time <= now,
        )
        result = await session.execute(stmt)
        rows = list(result.all())
        if not rows:
            return

        for rid, uid, task in rows:
            # Send push using external_user_id (= Clerk user_id)
            sent = await send_push(
                external_user_ids=[uid],
                title="⏰ Cortexa Reminder",
                message=task,
            )
            if sent:
                logger.info("Push sent for reminder %s → user %s", rid, uid)
            else:
                logger.warning(
                    "Push not delivered for reminder %s (user %s) — "
                    "user may not have subscribed yet.",
                    rid,
                    uid,
                )

        # Mark all processed reminders as done
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
