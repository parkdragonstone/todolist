# Design Ref: §4.1~4.2 /api/tags — 목록(미완료 할일 수), 생성·수정(대소문자 무시 중복 409), 삭제
from fastapi import APIRouter, Depends, Response
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import timeutil
from app.auth import require_auth
from app.db import get_db
from app.errors import AppError, not_found
from app.models import Tag, Task, task_tags
from app.schemas import TagIn, TagPatch, tag_out

router = APIRouter(prefix="/api/tags", tags=["tags"], dependencies=[Depends(require_auth)])

DUPLICATE_MESSAGE = "이미 같은 이름이 있어요"


def _duplicate() -> AppError:
    return AppError(
        409, "DUPLICATE", DUPLICATE_MESSAGE, {"field_errors": {"name": DUPLICATE_MESSAGE}}
    )


def _query_tags(db: Session, tag_id: int | None = None) -> list[dict]:
    stmt = (
        select(Tag, func.count(Task.id))
        .outerjoin(task_tags, task_tags.c.tag_id == Tag.id)
        .outerjoin(Task, and_(Task.id == task_tags.c.task_id, Task.completed_at.is_(None)))
        .group_by(Tag.id)
        .order_by(Tag.name, Tag.id)
    )
    if tag_id is not None:
        stmt = stmt.where(Tag.id == tag_id)
    return [tag_out(tag, count) for tag, count in db.execute(stmt)]


def _ensure_unique(db: Session, name: str, exclude_id: int | None = None) -> None:
    stmt = select(Tag.id).where(func.lower(Tag.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(Tag.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise _duplicate()


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise _duplicate() from exc


def _get_tag(db: Session, tag_id: int) -> Tag:
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise not_found()
    return tag


@router.get("")
def list_tags(db: Session = Depends(get_db)):
    return {"data": _query_tags(db)}


@router.post("", status_code=201)
def create_tag(payload: TagIn, db: Session = Depends(get_db)):
    _ensure_unique(db, payload.name)
    tag = Tag(name=payload.name, color=payload.color, created_at=timeutil.now_iso())
    db.add(tag)
    _commit(db)
    return {"data": tag_out(tag)}


@router.patch("/{tag_id}")
def update_tag(tag_id: int, payload: TagPatch, db: Session = Depends(get_db)):
    tag = _get_tag(db, tag_id)
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    if "name" in changes:
        _ensure_unique(db, changes["name"], exclude_id=tag_id)
    for field, value in changes.items():
        setattr(tag, field, value)
    _commit(db)
    return {"data": _query_tags(db, tag_id)[0]}


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    db.delete(_get_tag(db, tag_id))
    db.commit()
    return Response(status_code=204)
