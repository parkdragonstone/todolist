# Design Ref: §4.1~4.2 /api/tasks — 목록·마감 그룹·상세·생성·수정·완료/완료 취소·삭제
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app import timeutil
from app.auth import require_auth
from app.db import get_db
from app.schemas import TaskIn, TaskPatch, task_out
from app.services.due_groups import group_tasks
from app.services.recurrence import complete_task, uncomplete_task
from app.services.task_mutation import create_task, delete_task, get_task, update_task
from app.services.task_query import list_tasks

router = APIRouter(prefix="/api/tasks", tags=["tasks"], dependencies=[Depends(require_auth)])


@router.get("")
def get_tasks(
    project_id: int | None = None,
    status: Literal["open", "done", "all"] = "open",
    tag_id: list[int] = Query([]),
    priority: int | None = Query(None, ge=0, le=3),
    due_from: date | None = None,
    due_to: date | None = None,
    sort: Literal["due", "priority", "created"] = "due",
    db: Session = Depends(get_db),
):
    tasks = list_tasks(
        db,
        project_id=project_id,
        status=status,
        tag_ids=tag_id,
        priority=priority,
        due_from=due_from,
        due_to=due_to,
        sort=sort,
    )
    return {"data": [task_out(t) for t in tasks]}


@router.get("/upcoming")
def get_upcoming(
    project_id: int | None = None,
    tag_id: list[int] = Query([]),
    priority: int | None = Query(None, ge=0, le=3),
    db: Session = Depends(get_db),
):
    now = timeutil.now()
    tasks = list_tasks(db, project_id=project_id, status="open", tag_ids=tag_id, priority=priority)
    groups = group_tasks(tasks, now)
    return {
        "data": {
            "today": now.date().isoformat(),
            "groups": {key: [task_out(t) for t in items] for key, items in groups.items()},
            "counts": {key: len(items) for key, items in groups.items()},
        }
    }


@router.get("/{task_id}")
def get_task_detail(task_id: int, db: Session = Depends(get_db)):
    return {"data": task_out(get_task(db, task_id))}


@router.post("", status_code=201)
def post_task(payload: TaskIn, db: Session = Depends(get_db)):
    return {"data": task_out(create_task(db, payload.model_dump()))}


@router.patch("/{task_id}")
def patch_task(task_id: int, payload: TaskPatch, db: Session = Depends(get_db)):
    task = update_task(db, get_task(db, task_id), payload.model_dump(exclude_unset=True))
    return {"data": task_out(task)}


@router.post("/{task_id}/complete")
def post_complete(task_id: int, db: Session = Depends(get_db)):
    task, spawned = complete_task(db, get_task(db, task_id))
    return {
        "data": {"task": task_out(task), "spawned_task": task_out(spawned) if spawned else None}
    }


@router.post("/{task_id}/uncomplete")
def post_uncomplete(task_id: int, db: Session = Depends(get_db)):
    task, removed_id = uncomplete_task(db, get_task(db, task_id))
    return {"data": {"task": task_out(task), "removed_spawned_task_id": removed_id}}


@router.delete("/{task_id}", status_code=204)
def remove_task(task_id: int, db: Session = Depends(get_db)):
    delete_task(db, get_task(db, task_id))
    return Response(status_code=204)
