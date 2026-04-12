"""Unit tests for utils.time_parse.parse_time."""

from datetime import datetime, timezone

import pytest

from utils.time_parse import parse_time


def test_parse_hh_mm_same_day():
    now = datetime(2026, 4, 12, 10, 0, tzinfo=timezone.utc)
    dt = parse_time("19:30", now=now)
    assert dt == datetime(2026, 4, 12, 19, 30, tzinfo=timezone.utc)


def test_parse_hh_mm_rolls_to_next_day_when_past():
    now = datetime(2026, 4, 12, 20, 0, tzinfo=timezone.utc)
    dt = parse_time("09:00", now=now)
    assert dt == datetime(2026, 4, 13, 9, 0, tzinfo=timezone.utc)


def test_parse_tomorrow_keyword():
    now = datetime(2026, 4, 12, 10, 0, tzinfo=timezone.utc)
    dt = parse_time("tomorrow 18:00", now=now)
    assert dt == datetime(2026, 4, 13, 18, 0, tzinfo=timezone.utc)


def test_parse_12h_pm():
    now = datetime(2026, 4, 12, 10, 0, tzinfo=timezone.utc)
    dt = parse_time("7pm", now=now)
    assert dt == datetime(2026, 4, 12, 19, 0, tzinfo=timezone.utc)


def test_parse_empty_raises():
    with pytest.raises(ValueError):
        parse_time("", now=datetime.now(timezone.utc))
