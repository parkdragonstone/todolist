# Design Ref: §4.2 POST/PATCH /api/tasks — 필드 적용, 교차 검증, anchor_day 자동 설정
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import timeutil
from app.errors import not_found, validation_error
from app.models import Project, Tag, Task
from app.services.recurrence import clear_repeat, format_weekdays

SIMPLE_FIELDS = ("title", "memo", "priority")


def get_task(db: Session, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise not_found()
    return task


def _apply(db: Session, task: Task, data: dict[str, Any]) -> None:
    errors: dict[str, str] = {}

    # 부분 적용 중간 상태가 CHECK 제약에 걸려 flush되지 않도록 autoflush를 막는다.
    with db.no_autoflush:
        if "project_id" in data:
            if db.get(Project, data["project_id"]) is None:
                errors["project_id"] = "존재하지 않는 프로젝트예요"
            else:
                task.project_id = data["project_id"]

        for field in SIMPLE_FIELDS:
            if field in data:
                setattr(task, field, data[field])

        if "due_date" in data:
            task.due_date = data["due_date"]
            if task.due_date is None:
                task.due_time = None
                clear_repeat(task)
        if "due_time" in data:
            task.due_time = data["due_time"]

        if "repeat" in data:
            repeat = data["repeat"]
            if repeat is None:
                clear_repeat(task)
            else:
                task.repeat_freq = repeat["freq"]
                task.repeat_interval = repeat["interval"]
                task.repeat_weekdays = format_weekdays(repeat.get("weekdays"))

        if "tag_ids" in data:
            ids = list(dict.fromkeys(data["tag_ids"]))
            tags = list(db.scalars(select(Tag).where(Tag.id.in_(ids)))) if ids else []
            if len(tags) != len(ids):
                errors["tag_ids"] = "존재하지 않는 태그가 있어요"
            else:
                task.tags = sorted(tags, key=lambda t: t.name.lower())

    if task.due_time and not task.due_date:
        errors["due_time"] = "마감 날짜 없이 시간만 지정할 수 없어요"
    if task.repeat_freq and not task.due_date:
        errors["repeat"] = "반복하려면 마감 날짜가 필요해요"
    if errors:
        raise validation_error(errors)

    if not task.repeat_freq:
        task.repeat_anchor_day = None
    elif "due_date" in data or "repeat" in data:
        task.repeat_anchor_day = date.fromisoformat(task.due_date).day


def create_task(db: Session, data: dict[str, Any]) -> Task:
    now = timeutil.now_iso()
    task = Task(memo="", priority=0, repeat_interval=1, created_at=now, updated_at=now)
    _apply(db, task, data)
    db.add(task)
    db.commit()
    return task


def update_task(db: Session, task: Task, data: dict[str, Any]) -> Task:
    _apply(db, task, data)
    task.updated_at = timeutil.now_iso()
    db.commit()
    return task


def delete_task(db: Session, task: Task) -> None:
    db.delete(task)
    db.commit()
