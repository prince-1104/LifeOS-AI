"""Parse orchestrator time strings into UTC datetimes.

Handles:
  - Relative durations: "2 minutes", "1 hour", "in 30m", "+5min"
  - Simple wall-clock: "7pm", "19:00", "10:30am"
  - Tomorrow: "tomorrow 6:30am", "kal 5pm"
  - Date of month: "28th 10:30am", "28th at 14:00", "on 15th at 2pm"
  - Day names: "Monday 10am", "next friday 3pm"
  - Full dates: "May 5 at 2pm", "April 28 10:30am"
  - Hindi time-of-day: "subah 7" (morning 7am), "sham 5" (evening 5pm)
  - Hindi day words: "kal" (tomorrow), "parso" (day after tomorrow)
"""

import re
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

_DAY_NAMES = {
    "monday": 0, "mon": 0,
    "tuesday": 1, "tue": 1, "tues": 1,
    "wednesday": 2, "wed": 2,
    "thursday": 3, "thu": 3, "thur": 3, "thurs": 3,
    "friday": 4, "fri": 4,
    "saturday": 5, "sat": 5,
    "sunday": 6, "sun": 6,
}

_MONTH_NAMES = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}

# Hindi time-of-day words → (start_hour, end_hour) range for AM/PM inference.
# When the user says "subah 7", we know it's 7 AM (morning range).
# When the user says "sham 5", we know it's 5 PM (evening range).
_HINDI_TOD_MORNING = frozenset({
    "subah", "suabh", "subh", "sbh", "savere", "sawere",
    "morning", "pratah",
})
_HINDI_TOD_AFTERNOON = frozenset({
    "dopahar", "dopaher", "dopair", "dupair", "dooper", "doper",
    "dhoper", "dhopahar", "dupahar", "dupher",
    "afternoon",
})
_HINDI_TOD_EVENING = frozenset({
    "sham", "shaam", "sam", "saam", "sayam",
    "evening",
})
_HINDI_TOD_NIGHT = frozenset({
    "raat", "rat", "raatko", "ratko", "night",
})

# Hindi day words
_HINDI_TOMORROW = frozenset({"kal", "kal", "kl"})
_HINDI_DAY_AFTER = frozenset({"parso", "parson", "parsu"})
_HINDI_TODAY = frozenset({"aaj", "aaz", "aj"})


def _detect_hindi_tod(text: str) -> str | None:
    """Detect Hindi time-of-day from text. Returns 'morning'/'afternoon'/'evening'/'night' or None."""
    words = text.lower().split()
    for w in words:
        if w in _HINDI_TOD_MORNING:
            return "morning"
        if w in _HINDI_TOD_AFTERNOON:
            return "afternoon"
        if w in _HINDI_TOD_EVENING:
            return "evening"
        if w in _HINDI_TOD_NIGHT:
            return "night"
    return None


def _strip_hindi_tod(text: str) -> str:
    """Remove Hindi time-of-day words from text."""
    all_tod = _HINDI_TOD_MORNING | _HINDI_TOD_AFTERNOON | _HINDI_TOD_EVENING | _HINDI_TOD_NIGHT
    words = text.split()
    return " ".join(w for w in words if w.lower() not in all_tod).strip()


def _strip_hindi_day_words(text: str) -> str:
    """Remove Hindi day words from text."""
    all_days = _HINDI_TOMORROW | _HINDI_DAY_AFTER | _HINDI_TODAY
    words = text.split()
    return " ".join(w for w in words if w.lower() not in all_days).strip()


def _apply_tod_to_hour(hour: int, tod: str | None) -> int:
    """Adjust hour based on time-of-day context when no AM/PM was specified.

    morning (subah)    → 5-11 (keep as-is if 1-11, treat as AM)
    afternoon (dopahar) → 12-16 (add 12 if hour < 12)
    evening (sham)     → 16-20 (add 12 if hour < 12)
    night (raat)       → 20-23 or 0-4 (add 12 if hour < 12 and hour > 4)
    """
    if tod is None:
        return hour
    if tod == "morning":
        # morning: hours should be AM (no adjustment needed for 1-11)
        return hour
    if tod == "afternoon":
        if hour < 12:
            return hour + 12
        return hour
    if tod == "evening":
        if hour < 12:
            return hour + 12
        return hour
    if tod == "night":
        if 1 <= hour <= 4:
            # Late night: keep as-is (1am-4am)
            return hour
        if hour < 12:
            return hour + 12
        return hour
    return hour


def _has_ampm(s: str) -> bool:
    """Check if the string already contains explicit AM/PM markers."""
    return bool(re.search(r"(?:a\.?m\.?|p\.?m\.?|am|pm)\b", s.lower()))


def _combine_utc(d: date, hour: int, minute: int) -> datetime:
    return datetime.combine(d, time(hour, minute), tzinfo=timezone.utc)


def _parse_hour_minute(s: str) -> tuple[int, int] | None:
    """Extract hour:minute from a time fragment like '10:30am', '7pm', '14:00', '2 pm'."""
    s = s.strip().lower()
    s = re.sub(r"\s+", " ", s)
    # Strip leading "at"
    s = re.sub(r"^at\s+", "", s)

    # "10:30 am", "14:00", "10:30am"
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

    # "7pm", "10am", "2 pm", "10 am"
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

    # Pure 24h: "14:00", "09:30"
    m = re.match(r"^(\d{1,2}):(\d{2})$", s)
    if m:
        h, mn = int(m.group(1)), int(m.group(2))
        if 0 <= h <= 23 and 0 <= mn <= 59:
            return h, mn

    # Bare number: "5", "10" (used with Hindi time-of-day context)
    m = re.match(r"^(\d{1,2})$", s)
    if m:
        h = int(m.group(1))
        if 1 <= h <= 12:
            return h, 0

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


def _extract_date_of_month(s: str) -> tuple[int, str] | None:
    """Extract a day-of-month number and return (day, remaining_string).

    Matches: "28th", "1st", "2nd", "3rd", "15th", "on 28th", "28"
    """
    # "28th at 10:30am" → day=28, rest="10:30am"
    m = re.match(
        r"^(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(?:at\s+)?(.*)$",
        s.strip(),
        re.I,
    )
    if m:
        day = int(m.group(1))
        if 1 <= day <= 31:
            rest = m.group(2).strip()
            return day, rest
    return None


def _extract_day_name(s: str) -> tuple[int, str] | None:
    """Extract a weekday name and return (weekday_number, remaining_string).

    Matches: "Monday 10am", "next friday 3pm", "this wednesday at 2pm"
    """
    low = s.strip().lower()
    # Strip "next" / "this"
    low = re.sub(r"^(?:next|this)\s+", "", low)

    for name, weekday in _DAY_NAMES.items():
        if low.startswith(name):
            rest = low[len(name):].strip()
            rest = re.sub(r"^at\s+", "", rest)
            return weekday, rest
    return None


def _extract_month_day(s: str) -> tuple[int, int, str] | None:
    """Extract 'Month Day' and return (month, day, remaining_string).

    Matches: "May 5 at 2pm", "April 28 10:30am", "jan 15 9am"
    """
    low = s.strip().lower()
    for name, month_num in _MONTH_NAMES.items():
        if low.startswith(name):
            rest = low[len(name):].strip()
            m = re.match(r"^(\d{1,2})(?:st|nd|rd|th)?\s*(?:at\s+)?(.*)$", rest, re.I)
            if m:
                day = int(m.group(1))
                if 1 <= day <= 31:
                    time_rest = m.group(2).strip()
                    return month_num, day, time_rest
    return None


def _get_next_weekday(base_date: date, target_weekday: int) -> date:
    """Get the next occurrence of target_weekday from base_date (inclusive of today)."""
    days_ahead = (target_weekday - base_date.weekday()) % 7
    if days_ahead == 0:
        # Today is the target day; could be today or next week
        # Return next week's occurrence if we need future
        pass
    return base_date + timedelta(days=days_ahead or 7)


def _get_next_month_day(base_date: date, day: int) -> date:
    """Get the next occurrence of 'day' in the current or next month."""
    import calendar

    year, month = base_date.year, base_date.month

    # Try current month
    max_day = calendar.monthrange(year, month)[1]
    if day <= max_day and date(year, month, day) >= base_date:
        return date(year, month, day)

    # Try next month
    if month == 12:
        year += 1
        month = 1
    else:
        month += 1

    max_day = calendar.monthrange(year, month)[1]
    actual_day = min(day, max_day)
    return date(year, month, actual_day)


def parse_time(
    time_str: str,
    *,
    now: datetime | None = None,
    user_tz: ZoneInfo | None = None,
) -> datetime:
    """
    Interpret time_str as a reminder instant in UTC.

    Supports:
      - Relative durations: "2 minutes", "1 hour", "in 30m", "+5min"
      - Absolute wall-clock: "7pm", "19:00", "tomorrow 6:30am"
      - Date of month: "28th 10:30am", "28th at 14:00", "on 15th at 2pm"
      - Day names: "Monday 10am", "next friday 3pm"
      - Month+day: "May 5 at 2pm", "April 28 10:30am"

    With ``user_tz``, times are interpreted as local then converted to UTC.
    """
    if not time_str or not str(time_str).strip():
        raise ValueError("empty time string")

    raw = str(time_str).strip()

    # ── 1. Try relative duration first ────────────────────────────────
    delta = _parse_relative_duration(raw)
    if delta is not None:
        now_utc = _ensure_utc(now)
        return now_utc + delta

    # ── Determine "now" in the appropriate zone ───────────────────────
    now_utc = _ensure_utc(now)

    if user_tz is not None:
        now_local = now_utc.astimezone(user_tz)
    else:
        now_local = now_utc

    base_date = now_local.date()
    tz = user_tz if user_tz else timezone.utc

    low = raw.lower().strip()

    # ── 2. "tomorrow" / "kal" prefix ───────────────────────────────────
    use_tomorrow = "tomorrow" in low
    kal_match = any(w in low.split() for w in _HINDI_TOMORROW)
    parso_match = any(w in low.split() for w in _HINDI_DAY_AFTER)
    aaj_match = any(w in low.split() for w in _HINDI_TODAY)

    if use_tomorrow or kal_match:
        rest = re.sub(r"\bto-?morrow\b", " ", low, flags=re.I).strip()
        rest = _strip_hindi_day_words(rest)
        tod = _detect_hindi_tod(rest)
        rest = _strip_hindi_tod(rest)
        rest = re.sub(r"^(?:at|ko|pe)\s+", "", rest).strip()
        hm = _parse_hour_minute(rest) if rest else None
        if hm is None:
            hm = (9, 0)  # default to 9 AM
        hour = _apply_tod_to_hour(hm[0], tod) if not _has_ampm(rest) else hm[0]
        target_date = base_date + timedelta(days=1)
        return _make_utc(target_date, hour, hm[1], tz, now_utc)

    if parso_match:
        rest = _strip_hindi_day_words(low)
        tod = _detect_hindi_tod(rest)
        rest = _strip_hindi_tod(rest)
        rest = re.sub(r"^(?:at|ko|pe)\s+", "", rest).strip()
        hm = _parse_hour_minute(rest) if rest else None
        if hm is None:
            hm = (9, 0)
        hour = _apply_tod_to_hour(hm[0], tod) if not _has_ampm(rest) else hm[0]
        target_date = base_date + timedelta(days=2)
        return _make_utc(target_date, hour, hm[1], tz, now_utc)

    if aaj_match:
        rest = _strip_hindi_day_words(low)
        tod = _detect_hindi_tod(rest)
        rest = _strip_hindi_tod(rest)
        rest = re.sub(r"^(?:at|ko|pe)\s+", "", rest).strip()
        hm = _parse_hour_minute(rest) if rest else None
        if hm is None:
            hm = (9, 0)
        hour = _apply_tod_to_hour(hm[0], tod) if not _has_ampm(rest) else hm[0]
        target_date = base_date
        dt = _make_utc(target_date, hour, hm[1], tz, now_utc)
        if dt <= now_utc:
            dt = _make_utc(target_date + timedelta(days=1), hour, hm[1], tz, now_utc, skip_past_check=True)
        return dt

    # ── 3. Month + day: "May 5 at 2pm", "April 28 10:30am" ──────────
    md = _extract_month_day(low)
    if md is not None:
        month_num, day, time_rest = md
        hm = _parse_hour_minute(time_rest) if time_rest else None
        if hm is None:
            hm = (9, 0)  # default to 9 AM
        import calendar
        year = now_local.year
        max_day = calendar.monthrange(year, month_num)[1]
        actual_day = min(day, max_day)
        target_date = date(year, month_num, actual_day)
        if target_date < base_date:
            target_date = date(year + 1, month_num, actual_day)
        return _make_utc(target_date, hm[0], hm[1], tz, now_utc)

    # ── 4. Day name: "Monday 10am", "next friday 3pm" ────────────────
    day_result = _extract_day_name(low)
    if day_result is not None:
        weekday, time_rest = day_result
        hm = _parse_hour_minute(time_rest) if time_rest else None
        if hm is None:
            hm = (9, 0)  # default to 9 AM
        target_date = _get_next_weekday(base_date, weekday)
        return _make_utc(target_date, hm[0], hm[1], tz, now_utc)

    # ── 5. Date of month: "28th 10:30am", "on 15th at 2pm" ──────────
    dom = _extract_date_of_month(low)
    if dom is not None:
        day_num, time_rest = dom
        hm = _parse_hour_minute(time_rest) if time_rest else None
        if hm is None:
            hm = (9, 0)  # default to 9 AM
        target_date = _get_next_month_day(base_date, day_num)
        return _make_utc(target_date, hm[0], hm[1], tz, now_utc)

    # ── 6. Hindi time-of-day with bare number: "subah 7", "sham 5" ────
    tod = _detect_hindi_tod(low)
    if tod:
        rest = _strip_hindi_tod(low)
        rest = re.sub(r"^(?:at|ko|pe|ke)\s+", "", rest).strip()
        hm = _parse_hour_minute(rest) if rest else None
        if hm is not None:
            hour = _apply_tod_to_hour(hm[0], tod) if not _has_ampm(rest) else hm[0]
            target_date = base_date
            dt = _make_utc(target_date, hour, hm[1], tz, now_utc)
            if dt <= now_utc:
                dt = _make_utc(target_date + timedelta(days=1), hour, hm[1], tz, now_utc, skip_past_check=True)
            return dt

    # ── 7. Simple wall-clock: "7pm", "10:30am", "19:00" ──────────────
    rest = re.sub(r"^(?:at|ko|pe)\s+", "", low)
    hm = _parse_hour_minute(rest)
    if hm is not None:
        hour, minute = hm
        target_date = base_date
        dt = _make_utc(target_date, hour, minute, tz, now_utc)
        # If already past, push to tomorrow
        if dt <= now_utc:
            dt = _make_utc(target_date + timedelta(days=1), hour, minute, tz, now_utc, skip_past_check=True)
        return dt

    raise ValueError(f"unrecognized time format: {time_str!r}")


def _ensure_utc(now: datetime | None) -> datetime:
    """Ensure we have a timezone-aware UTC datetime."""
    if now is None:
        return datetime.now(timezone.utc)
    if now.tzinfo is None:
        return now.replace(tzinfo=timezone.utc)
    return now.astimezone(timezone.utc)


def _make_utc(
    target_date: date,
    hour: int,
    minute: int,
    tz: ZoneInfo | timezone,
    now_utc: datetime,
    skip_past_check: bool = False,
) -> datetime:
    """Combine date + time in given timezone, return as UTC."""
    local_dt = datetime.combine(target_date, time(hour, minute), tzinfo=tz)
    dt_utc = local_dt.astimezone(timezone.utc)
    return dt_utc
