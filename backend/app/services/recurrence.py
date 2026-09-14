# Design Ref: §3.4.3 — 반복 다음 회차 계산, 완료 시 회차 생성 / 완료 취소 시 회수
import calendar
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app import timeutil
from app.models import Task

REPEAT_FIELDS = ("repeat_freq", "repeat_interval", "repeat_weekdays", "repeat_anchor_day")


def parse_weekdays(value: str | None) -> list[int] | None:
    if not value:
        return None
    return [int(part) for part in value.split(",")]


def format_weekdays(days: list[int] | None) -> str | None:
    return ",".join(str(d) for d in sorted(set(days))) if days else None


def clear_repeat(task: Task) -> None:
    task.repeat_freq = None
    task.repeat_interval = 1
    task.repeat_weekdays = None
    task.repeat_anchor_day = None


def _copy_repeat(src: Task, dst: Task) -> None:
    for attr in REPEAT_FIELDS:
        setattr(dst, attr, getattr(src, attr))


def _add_months(d: date, months: int, anchor_day: int) -> date:
    total = d.year * 12 + (d.month - 1) + months
    year, month0 = divmod(total, 12)
    month = month0 + 1
    return date(year, month, min(anchor_day, calendar.monthrange(year, month)[1]))


def _step(due: date, freq: str, interval: int, weekdays: list[int] | None, anchor_day: int) -> date:
    if freq == "daily":
        return due + timedelta(days=interval)
    if freq == "weekly":
        if not weekdays:
            return due + timedelta(weeks=interval)
        base_monday = due - timedelta(days=due.weekday())
        for offset in range(1, 7 * interval + 8):
            candidate = due + timedelta(days=offset)
            candidate_monday = candidate - timedelta(days=candidate.weekday())
            weeks_apart = (candidate_monday - base_monday).days // 7
            if candidate.weekday() in weekdays and weeks_apart % interval == 0:
                return candidate
        raise ValueError("weekly repeat has no valid weekday")
    if freq == "monthly":
        return _add_months(due, interval, anchor_day)
    if freq == "yearly":
        return _add_months(due, 12 * interval, anchor_day)
    raise ValueError(f"unknown repeat frequency: {freq}")


def next_due(
    due: date,
    freq: str,
    interval: int = 1,
    weekdays: list[int] | None = None,
    anchor_day: int | None = None,
    today: date | None = None,
) -> date:
    """다음 회차 날짜. today를 주면 결과가 today 이상이 될 때까지 따라잡는다."""
    anchor = anchor_day or due.day
    result = _step(due, freq, interval, weekdays, anchor)
    if today is not None:
        while result < today:
            result = _step(result, freq, interval, weekdays, anchor)
    return result


def complete_task(db: Session, task: Task) -> tuple[Task, Task | None]:
    if task.completed_at:
        return task, None

    now = timeutil.now()
    task.completed_at = now.isoformat()
    task.updated_at = now.isoformat()

    spawned = None
    if task.repeat_freq and task.due_date:
        due = next_due(
            date.fromisoformat(task.due_date),
            task.repeat_freq,
            task.repeat_interval,
            parse_weekdays(task.repeat_weekdays),
            task.repeat_anchor_day,
            today=now.date(),
        )
        spawned = Task(
            project_id=task.project_id,
            title=task.title,
            memo=task.memo,
            due_date=due.isoformat(),
            due_time=task.due_time,
            priority=task.priority,
            created_at=now.isoformat(),
            updated_at=now.isoformat(),
        )
        _copy_repeat(task, spawned)
        spawned.tags = list(task.tags)
        db.add(spawned)
        db.flush()
        task.spawned_task_id = spawned.id
        clear_repeat(task)

    db.commit()
    return task, spawned


def uncomplete_task(db: Session, task: Task) -> tuple[Task, int | None]:
    if not task.completed_at:
        return task, None

    task.completed_at = None
    task.updated_at = timeutil.now_iso()

    removed_id = None
    if task.spawned_task_id is not None:
        spawned = db.get(Task, task.spawned_task_id)
        if spawned is None:
            task.spawned_task_id = None
        elif spawned.completed_at is None:
            _copy_repeat(spawned, task)
            removed_id = spawned.id
            task.spawned_task_id = None
            db.flush()
            db.delete(spawned)

    db.commit()
    return task, removed_id
