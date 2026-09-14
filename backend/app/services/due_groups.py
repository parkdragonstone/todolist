# Design Ref: §3.4.2 — 마감 그룹 분류 (주 시작 = 월요일)
from collections.abc import Iterable
from datetime import date, datetime, timedelta
from typing import Any

GROUP_KEYS = ("overdue", "today", "tomorrow", "this_week", "later", "no_due")


def is_overdue(task: Any, now: datetime) -> bool:
    if task.due_date is None:
        return False
    due = date.fromisoformat(task.due_date)
    today = now.date()
    if due < today:
        return True
    return due == today and task.due_time is not None and task.due_time < now.strftime("%H:%M")


def classify(task: Any, now: datetime) -> str:
    if task.due_date is None:
        return "no_due"
    if is_overdue(task, now):
        return "overdue"
    due = date.fromisoformat(task.due_date)
    today = now.date()
    if due == today:
        return "today"
    if due == today + timedelta(days=1):
        return "tomorrow"
    week_end = today + timedelta(days=6 - today.weekday())
    if due <= week_end:
        return "this_week"
    return "later"


def group_tasks(tasks: Iterable[Any], now: datetime) -> dict[str, list[Any]]:
    groups: dict[str, list[Any]] = {key: [] for key in GROUP_KEYS}
    for task in tasks:
        groups[classify(task, now)].append(task)
    return groups
