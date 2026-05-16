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


# Max individual push notifications per user per poll cycle.
# Beyond this, send a single grouped summary to avoid flooding.
_MAX_INDIVIDUAL_PUSHES = 3


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

        # Group by user to prevent notification flooding
        user_reminders: dict[str, list[tuple[str, str]]] = {}
        for rid, uid, task in rows:
            rid_str = str(rid)
            if rid_str in _push_sent:
                continue
            user_reminders.setdefault(uid, []).append((rid_str, task))

        for uid, items in user_reminders.items():
            if not items:
                continue

            if len(items) <= _MAX_INDIVIDUAL_PUSHES:
                # Send individual notifications
                for rid_str, task in items:
                    sent = await send_push(
                        external_user_ids=[uid],
                        title="⏰ Cortexa Reminder",
                        message=task,
                    )
                    _push_sent.add(rid_str)
                    if sent:
                        logger.info("Push sent for reminder %s → user %s", rid_str, uid)
                    else:
                        logger.warning(
                            "Push not delivered for reminder %s (user %s)",
                            rid_str, uid,
                        )
            else:
                # Too many — send a single grouped summary
                task_list = ", ".join(task for _, task in items[:5])
                extra = len(items) - 5
                message = task_list
                if extra > 0:
                    message += f" and {extra} more"

                sent = await send_push(
                    external_user_ids=[uid],
                    title=f"⏰ {len(items)} Reminders Due",
                    message=message,
                )
                for rid_str, _ in items:
                    _push_sent.add(rid_str)

                if sent:
                    logger.info(
                        "Grouped push sent for %d reminders → user %s",
                        len(items), uid,
                    )
                else:
                    logger.warning(
                        "Grouped push not delivered for user %s", uid,
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
