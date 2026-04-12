"""Parse orchestrator time strings into UTC datetimes (wall-clock + roll-forward if past)."""

import re
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo


def _combine_utc(d: date, hour: int, minute: int) -> datetime:
    return datetime.combine(d, time(hour, minute), tzinfo=timezone.utc)


def _parse_hour_minute(s: str) -> tuple[int, int] | None:
    s = s.strip().lower()
    s = re.sub(r"\s+", " ", s)

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


def parse_time(
    time_str: str,
    *,
    now: datetime | None = None,
    user_tz: ZoneInfo | None = None,
) -> datetime:
    """
    Interpret time_str as a reminder instant in UTC.

    With ``user_tz``, "today" / "tomorrow" use that zone's calendar; wall-clock is local
    then converted to UTC. Without it, behavior matches legacy UTC calendar logic.
    """
    if not time_str or not str(time_str).strip():
        raise ValueError("empty time string")

    raw = str(time_str).strip()
    low = raw.lower()
    use_tomorrow = "tomorrow" in low
    rest = re.sub(r"\bto-?morrow\b", " ", low, flags=re.I).strip()

    hm = _parse_hour_minute(rest)
    if hm is None:
        raise ValueError(f"unrecognized time format: {time_str!r}")

    hour, minute = hm

    if user_tz is None:
        now_utc = now if now is not None else datetime.now(timezone.utc)
        if now_utc.tzinfo is None:
            now_utc = now_utc.replace(tzinfo=timezone.utc)
        else:
            now_utc = now_utc.astimezone(timezone.utc)

        base_date = now_utc.date()
        if use_tomorrow:
            base_date = base_date + timedelta(days=1)

        dt = _combine_utc(base_date, hour, minute)
        while dt <= now_utc:
            dt += timedelta(days=1)
        return dt

    now_utc = now if now is not None else datetime.now(timezone.utc)
    if now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=timezone.utc)
    else:
        now_utc = now_utc.astimezone(timezone.utc)

    now_local = now_utc.astimezone(user_tz)
    base_date = now_local.date()
    if use_tomorrow:
        base_date = base_date + timedelta(days=1)

    local_dt = datetime.combine(
        base_date,
        time(hour, minute),
        tzinfo=user_tz,
    )
    dt_utc = local_dt.astimezone(timezone.utc)
    while dt_utc <= now_utc:
        dt_utc += timedelta(days=1)
    return dt_utc
