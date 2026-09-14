from datetime import datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest

from app.services.due_groups import GROUP_KEYS, classify, group_tasks

KST = ZoneInfo("Asia/Seoul")
WEDNESDAY = datetime(2026, 9, 16, 10, 0, tzinfo=KST)


def task(due_date=None, due_time=None):
    return SimpleNamespace(due_date=due_date, due_time=due_time)


@pytest.mark.parametrize(
    ("due_date", "due_time", "expected"),
    [
        ("2026-09-15", None, "overdue"),
        ("2026-09-16", "09:00", "overdue"),
        ("2026-09-16", "10:00", "today"),
        ("2026-09-16", None, "today"),
        ("2026-09-17", None, "tomorrow"),
        ("2026-09-18", None, "this_week"),
        ("2026-09-20", None, "this_week"),
        ("2026-09-21", None, "later"),
        (None, None, "no_due"),
    ],
)
def test_classify_on_wednesday(due_date, due_time, expected):
    assert classify(task(due_date, due_time), WEDNESDAY) == expected


def test_saturday_has_no_this_week_group():
    saturday = datetime(2026, 9, 19, 9, 0, tzinfo=KST)
    assert classify(task("2026-09-20"), saturday) == "tomorrow"
    assert classify(task("2026-09-21"), saturday) == "later"


def test_sunday_next_week_is_later():
    sunday = datetime(2026, 9, 20, 9, 0, tzinfo=KST)
    assert classify(task("2026-09-21"), sunday) == "tomorrow"
    assert classify(task("2026-09-22"), sunday) == "later"


def test_group_tasks_returns_every_key():
    groups = group_tasks([task(), task("2026-09-16")], WEDNESDAY)
    assert tuple(groups) == GROUP_KEYS
    assert len(groups["no_due"]) == 1
    assert len(groups["today"]) == 1
