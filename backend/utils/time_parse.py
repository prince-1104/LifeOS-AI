"""Parse orchestrator time strings into UTC datetimes (wall-clock + relative durations)."""

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


def _parse_relative_duration(s: str) -> timedelta | None:
    """Parse relative duration strings into timedelta.

    Supports formats like:
      - "2 minutes", "5 min", "30m", "+10min"
      - "1 hour", "2 hours", "1.5h", "+2hr"
      - "30 seconds", "45 sec", "90s"
      - "1 hour 30 minutes", "1h 30m", "1h30m"
      - "+2m", "+1h", "+30s"
      - "in 5 minutes", "after 10 min"
    """
    s = s.strip().lower()

    # Strip common prefixes
    s = re.sub(r"^(in|after|for)\s+", "", s)
    s = s.lstrip("+").strip()

    total_seconds = 0
    found = False

    # Match patterns like "1 hour 30 minutes" or "2h30m" or "5 min"
    # Hours
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b", s)
    if m:
        total_seconds += float(m.group(1)) * 3600
        found = True

    # Minutes
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b", s)
    if m:
        total_seconds += float(m.group(1)) * 60
        found = True

    # Seconds
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b", s)
    if m:
        total_seconds += float(m.group(1))
        found = True

    # Days
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:days?|d)\b", s)
    if m:
        total_seconds += float(m.group(1)) * 86400
        found = True

    if found and total_seconds > 0:
        return timedelta(seconds=total_seconds)

    # Try bare number — if just a number, assume minutes
    m = re.match(r"^(\d+)$", s)
    if m:
        return timedelta(minutes=int(m.group(1)))

    return None


def parse_time(
    time_str: str,
    *,
    now: datetime | None = None,
    user_tz: ZoneInfo | None = None,
) -> datetime:
    """
    Interpret time_str as a reminder instant in UTC.

    Supports both:
      - Absolute wall-clock: "7pm", "19:00", "tomorrow 6:30am"
      - Relative durations: "2 minutes", "1 hour", "in 30m", "+5min"

    With ``user_tz``, "today" / "tomorrow" use that zone's calendar; wall-clock is local
    then converted to UTC. Without it, behavior matches legacy UTC calendar logic.
    """
    if not time_str or not str(time_str).strip():
        raise ValueError("empty time string")

    raw = str(time_str).strip()

    # ── Try relative duration first ──────────────────────────────────
    delta = _parse_relative_duration(raw)
    if delta is not None:
        now_utc = now if now is not None else datetime.now(timezone.utc)
        if now_utc.tzinfo is None:
            now_utc = now_utc.replace(tzinfo=timezone.utc)
        else:
            now_utc = now_utc.astimezone(timezone.utc)
        return now_utc + delta

    # ── Otherwise parse as absolute wall-clock ───────────────────────
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
