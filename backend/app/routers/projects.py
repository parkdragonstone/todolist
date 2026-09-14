# Design Ref: §4.1~4.2 /api/projects — 목록(미완료·지남 카운트), 생성, 수정, 순서 변경, 삭제
from fastapi import APIRouter, Depends, Response
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app import timeutil
from app.auth import require_auth
from app.db import get_db
from app.errors import not_found, validation_error
from app.models import Project, Task
from app.schemas import ProjectIn, ProjectOrderIn, ProjectPatch, project_out

router = APIRouter(prefix="/api/projects", tags=["projects"], dependencies=[Depends(require_auth)])


def _query_projects(
    db: Session, *, include_archived: bool = True, project_id: int | None = None
) -> list[dict]:
    now = timeutil.now()
    today = now.date().isoformat()
    is_open = Task.completed_at.is_(None)
    # services.due_groups.is_overdue 와 같은 규칙
    overdue = and_(
        is_open,
        Task.due_date.is_not(None),
        or_(
            Task.due_date < today,
            and_(
                Task.due_date == today,
                Task.due_time.is_not(None),
                Task.due_time < now.strftime("%H:%M"),
            ),
        ),
    )
    stmt = (
        select(Project, func.count(Task.id).filter(is_open), func.count(Task.id).filter(overdue))
        .outerjoin(Task, Task.project_id == Project.id)
        .group_by(Project.id)
        .order_by(Project.archived, Project.sort_order, Project.id)
    )
    if not include_archived:
        stmt = stmt.where(Project.archived.is_(False))
    if project_id is not None:
        stmt = stmt.where(Project.id == project_id)
    return [
        project_out(p, open_count, overdue_count)
        for p, open_count, overdue_count in db.execute(stmt)
    ]


def _get_project(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise not_found()
    return project


@router.get("")
def list_projects(include_archived: bool = False, db: Session = Depends(get_db)):
    return {"data": _query_projects(db, include_archived=include_archived)}


@router.post("", status_code=201)
def create_project(payload: ProjectIn, db: Session = Depends(get_db)):
    now = timeutil.now_iso()
    max_order = db.scalar(select(func.max(Project.sort_order)))
    project = Project(
        name=payload.name,
        color=payload.color,
        sort_order=0 if max_order is None else max_order + 1,
        archived=False,
        created_at=now,
        updated_at=now,
    )
    db.add(project)
    db.commit()
    return {"data": project_out(project)}


@router.put("/order")
def reorder_projects(payload: ProjectOrderIn, db: Session = Depends(get_db)):
    active = {p.id: p for p in db.scalars(select(Project).where(Project.archived.is_(False)))}
    if len(payload.ids) != len(set(payload.ids)) or set(payload.ids) != set(active):
        raise validation_error({"ids": "보관되지 않은 프로젝트 전체를 한 번씩 보내야 해요"})
    for index, project_id in enumerate(payload.ids):
        active[project_id].sort_order = index
    db.commit()
    return {"data": _query_projects(db, include_archived=False)}


@router.patch("/{project_id}")
def update_project(project_id: int, payload: ProjectPatch, db: Session = Depends(get_db)):
    project = _get_project(db, project_id)
    for field, value in payload.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(project, field, value)
    project.updated_at = timeutil.now_iso()
    db.commit()
    return {"data": _query_projects(db, project_id=project_id)[0]}


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    db.delete(_get_project(db, project_id))
    db.commit()
    return Response(status_code=204)
