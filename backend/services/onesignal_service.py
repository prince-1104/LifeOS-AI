"""OneSignal push notification delivery via REST API v1.

Uses `include_external_user_ids` instead of player_ids so the backend
only needs the Clerk user_id — OneSignal handles multi-device routing.
"""

import logging
from typing import Sequence

import httpx

from config import get_settings

logger = logging.getLogger(__name__)

_API_URL = "https://onesignal.com/api/v1/notifications"


async def send_push(
    *,
    external_user_ids: Sequence[str],
    title: str,
    message: str,
    url: str | None = None,
) -> bool:
    """Send a push notification to users by their external_user_id (Clerk user ID).

    OneSignal resolves these to all subscribed devices for each user.
    Returns True on success, False on failure (logged, never raises).
    """
    settings = get_settings()
    if not settings.ONESIGNAL_APP_ID or not settings.ONESIGNAL_REST_API_KEY:
        logger.warning("OneSignal keys not configured — skipping push.")
        return False

    if not external_user_ids:
        logger.debug("No external_user_ids supplied — nothing to send.")
        return False

    payload: dict = {
        "app_id": settings.ONESIGNAL_APP_ID,
        "include_external_user_ids": list(external_user_ids),
        "target_channel": "push",
        "headings": {"en": title},
        "contents": {"en": message},
        "chrome_web_icon": "https://cdn-icons-png.flaticon.com/512/3387/3387295.png",
    }
    if url:
        payload["url"] = url

    headers = {
        "Authorization": f"Basic {settings.ONESIGNAL_REST_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(_API_URL, json=payload, headers=headers)
            data = resp.json() if resp.status_code in (200, 201) else {}
            recipients = data.get("recipients", 0)

            if resp.status_code in (200, 201) and recipients > 0:
                logger.info(
                    "Push sent to %d device(s) for %d user(s).",
                    recipients,
                    len(external_user_ids),
                )
                return True
            elif resp.status_code in (200, 201) and recipients == 0:
                logger.warning(
                    "OneSignal accepted but 0 recipients — user(s) may not have "
                    "subscribed or allowed notifications yet."
                )
                return False
            else:
                logger.error(
                    "OneSignal error %s: %s", resp.status_code, resp.text
                )
                return False
    except Exception:
        logger.exception("Failed to send OneSignal push notification.")
        return False
