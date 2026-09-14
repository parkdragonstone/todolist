# Design Ref: §3.4.1 — 할일 필터와 정렬 규칙
from collections.abc import Iterable, Sequence
from datetime import date
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session, contains_eager

from app.models import Project, Tag, Task

SortKey = Literal["due", "priority", "created"]
StatusKey = Literal["open", "done", "all"]


def due_sort_key(task: Task) -> tuple:
    """마감일 ASC(NULL 마지막) → 같은 날 시간 있는 항목 먼저 → 우선순위 DESC → 생성순."""
    return (
        task.due_date is None,
        task.due_date or "",
        task.due_time is None,
        task.due_time or "",
        -task.priority,
        task.created_at,
        task.id,
    )


def sort_tasks(tasks: Iterable[Task], sort: SortKey = "due") -> list[Task]:
    if sort == "priority":
        return sorted(tasks, key=lambda t: (-t.priority, *due_sort_key(t)))
    if sort == "created":
        return sorted(tasks, key=lambda t: (t.created_at, t.id), reverse=True)
    return sorted(tasks, key=due_sort_key)


def list_tasks(
    db: Session,
    *,
    project_id: int | None = None,
    status: StatusKey = "open",
    tag_ids: Sequence[int] = (),
    priority: int | None = None,
    due_from: date | None = None,
    due_to: date | None = None,
    sort: SortKey = "due",
) -> list[Task]:
    """project_id를 지정하지 않으면 보관된 프로젝트의 할일은 제외한다."""
    stmt = select(Task).join(Task.project).options(contains_eager(Task.project))

    if project_id is not None:
        stmt = stmt.where(Task.project_id == project_id)
    else:
        stmt = stmt.where(Project.archived.is_(False))

    if status == "open":
        stmt = stmt.where(Task.completed_at.is_(None))
    elif status == "done":
        stmt = stmt.where(Task.completed_at.is_not(None))

    for tag_id in dict.fromkeys(tag_ids):
        stmt = stmt.where(Task.tags.any(Tag.id == tag_id))
    if priority is not None:
        stmt = stmt.where(Task.priority >= priority)
    if due_from is not None:
        stmt = stmt.where(Task.due_date >= due_from.isoformat())
    if due_to is not None:
        stmt = stmt.where(Task.due_date <= due_to.isoformat())

    tasks = list(db.scalars(stmt).unique())
    if status == "done":
        return sorted(tasks, key=lambda t: (t.completed_at or "", t.id), reverse=True)
    return sort_tasks(tasks, sort)
