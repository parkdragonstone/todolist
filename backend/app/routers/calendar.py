# Design Ref: §4.2 GET /api/calendar — 기간(최대 62일) 내 날짜별 할일 집계
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import timeutil
from app.auth import require_auth
from app.db import get_db
from app.errors import validation_error
from app.schemas import task_out
from app.services.due_groups import is_overdue
from app.services.task_query import list_tasks

router = APIRouter(prefix="/api/calendar", tags=["calendar"], dependencies=[Depends(require_auth)])

MAX_RANGE_DAYS = 62
MAX_COLORS = 3


@router.get("")
def get_calendar(
    from_: date = Query(alias="from"),
    to: date = Query(),
    include_done: bool = True,
    db: Session = Depends(get_db),
):
    if to < from_ or (to - from_).days > MAX_RANGE_DAYS:
        raise validation_error({"to": f"조회 기간은 시작일부터 {MAX_RANGE_DAYS}일 이내여야 해요"})

    now = timeutil.now()
    tasks = list_tasks(
        db, status="all" if include_done else "open", due_from=from_, due_to=to, sort="due"
    )

    days: dict[str, dict] = {}
    for task in tasks:
        day = days.setdefault(
            task.due_date, {"open": 0, "done": 0, "overdue": 0, "colors": [], "tasks": []}
        )
        if task.completed_at:
            day["done"] += 1
        else:
            day["open"] += 1
            if is_overdue(task, now):
                day["overdue"] += 1
            color = task.project.color
            if color not in day["colors"] and len(day["colors"]) < MAX_COLORS:
                day["colors"].append(color)
        day["tasks"].append(task_out(task))

    return {"data": {"from": from_.isoformat(), "to": to.isoformat(), "days": days}}
