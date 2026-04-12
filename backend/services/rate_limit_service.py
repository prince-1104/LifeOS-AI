"""In-memory per-user sliding-window rate limit (single process only)."""

import time
from collections import defaultdict, deque

from config import get_settings

_windows: dict[str, deque[float]] = defaultdict(deque)


def check_rate_limit(user_id: str) -> bool:
    """
    Record this request and return True if allowed, False if over limit.
    """
    settings = get_settings()
    max_req = settings.RATE_LIMIT_REQUESTS
    window = float(settings.RATE_LIMIT_WINDOW_SECONDS)
    now = time.time()
    dq = _windows[user_id]
    while dq and dq[0] < now - window:
        dq.popleft()
    if len(dq) >= max_req:
        return False
    dq.append(now)
    return True
