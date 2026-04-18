"""Background polling for due reminders (APScheduler + async SQLAlchemy).

When a reminder becomes due the scheduler:
1. Uses the Clerk user_id directly as OneSignal external_user_id.
2. Sends a real push notification via the OneSignal REST API.
3. Falls back to console logging when OneSignal is not configured.
4. Does NOT mark the reminder as 'done' — the user acknowledges it
   via the in-app "Done" button (PATCH /reminders/:id/done).
   This prevents a race condition where the scheduler marks reminders
   done before the frontend can show the in-app popup.

No DB join needed — OneSignal resolves external_user_id → device(s).
"""

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from db.models import Reminder
from db.postgres import async_session
from services.onesignal_service import send_push

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

# Track which reminders have already had a push sent (in-process memory).
# Prevents re-sending push every 30 seconds for the same reminder.
# Cleared on process restart — acceptable because the frontend polls
# independently and handles display via /reminders/due.
_push_sent: set[str] = set()


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
            rid_str = str(rid)
            if rid_str in _push_sent:
                continue  # Already sent push for this one

            # Send push using external_user_id (= Clerk user_id)
            sent = await send_push(
                external_user_ids=[uid],
                title="⏰ Cortexa Reminder",
                message=task,
            )
            _push_sent.add(rid_str)

            if sent:
                logger.info("Push sent for reminder %s → user %s", rid, uid)
            else:
                logger.warning(
                    "Push not delivered for reminder %s (user %s) — "
                    "user may not have subscribed yet.",
                    rid,
                    uid,
                )

        # NOTE: Reminders are NOT marked as done here.
        # The user acknowledges them via the frontend "Done" button
        # which calls PATCH /reminders/:id/done.


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
