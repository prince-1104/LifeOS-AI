"""Parse orchestrator time strings into UTC datetimes (wall-clock + roll-forward if past)."""

import re
from datetime import date, datetime, time, timedelta, timezone


def _combine_utc(d: date, hour: int, minute: int) -> datetime:
    return datetime.combine(d, time(hour, minute), tzinfo=timezone.utc)


def _parse_hour_minute(s: str) -> tuple[int, int] | None:
    s = s.strip().lower()
    s = re.sub(r"\s+", " ", s)

    # HH:MM with optional am/pm
    m = re.match(
        r"^(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?|am|pm)?$",
        s,
        re.I,
    )
    if m:
        h, mn = int(m.group(1)), int(m.group(2))
        ap = m.group(3)
        if ap:
            ap = ap.replace(".", "").lower()
            if ap.startswith("p") and h != 12:
                h += 12
            if ap.startswith("a") and h == 12:
                h = 0
        if not (0 <= h <= 23 and 0 <= mn <= 59):
            return None
        return h, mn

    # e.g. "7pm", "7:30 pm"
    m = re.match(r"^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm)$", s, re.I)
    if m:
        h = int(m.group(1))
        mn = int(m.group(2) or 0)
        ap = m.group(3).replace(".", "").lower()
        if ap.startswith("p") and h != 12:
            h += 12
        if ap.startswith("a") and h == 12:
            h = 0
        if not (0 <= h <= 23 and 0 <= mn <= 59):
            return None
        return h, mn

    return None


def parse_time(time_str: str, *, now: datetime | None = None) -> datetime:
    """
    Interpret time_str as a reminder instant in UTC.

    - Supports "HH:MM", "H:MMam/pm", "Ham/pm", optional "tomorrow" in the string.
    - If the resulting instant is not after ``now``, advances by one day (repeat until future).
    """
    if not time_str or not str(time_str).strip():
        raise ValueError("empty time string")

    now = now if now is not None else datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    else:
        now = now.astimezone(timezone.utc)

    raw = str(time_str).strip()
    low = raw.lower()
    use_tomorrow = "tomorrow" in low
    # strip tomorrow for time token extraction
    rest = re.sub(r"\bto-?morrow\b", " ", low, flags=re.I).strip()

    hm = _parse_hour_minute(rest)
    if hm is None:
        raise ValueError(f"unrecognized time format: {time_str!r}")

    hour, minute = hm
    base_date = now.date()
    if use_tomorrow:
        base_date = base_date + timedelta(days=1)

    dt = _combine_utc(base_date, hour, minute)
    while dt <= now:
        dt += timedelta(days=1)
    return dt
