# Design Ref: §4.2 /api/backups, /api/export, /api/import — sqlite3 backup API 기반 백업과 JSON 왕복
import re
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import delete, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import timeutil
from app.errors import AppError
from app.models import Project, Tag, Task, task_tags

EXPORT_FORMAT = "todolist-export"
EXPORT_VERSION = 1
KEEP_LABELED = 5

AUTO_BACKUP_RE = re.compile(r"^todo-\d{8}\.db$")
LABELED_BACKUP_RE = re.compile(r"^todo-\d{8}-\d{6}-[a-z]+\.db$")

PROJECT_COLUMNS = ("id", "name", "color", "sort_order", "archived", "created_at", "updated_at")
TAG_COLUMNS = ("id", "name", "color", "created_at")
TASK_COLUMNS = (
    "id", "project_id", "title", "memo", "due_date", "due_time", "priority",
    "repeat_freq", "repeat_interval", "repeat_weekdays", "repeat_anchor_day",
    "completed_at", "spawned_task_id", "created_at", "updated_at",
)  # fmt: skip


# ── 파일 백업 ───────────────────────────────────────────────────────────────
def _copy_database(src: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".tmp")
    source = sqlite3.connect(src)
    target = sqlite3.connect(tmp)
    try:
        source.backup(target)
    finally:
        target.close()
        source.close()
    tmp.replace(dest)


def backup_info(path: Path) -> dict:
    stat = path.stat()
    created = datetime.fromtimestamp(stat.st_mtime, timeutil.zone()).replace(microsecond=0)
    return {"name": path.name, "size": stat.st_size, "created_at": created.isoformat()}


def create_backup(database_path: str, backup_dir: str, label: str | None = None) -> dict:
    now = timeutil.now()
    name = f"todo-{now:%Y%m%d-%H%M%S}-{label}.db" if label else f"todo-{now:%Y%m%d}.db"
    dest = Path(backup_dir) / name
    _copy_database(database_path, dest)
    return backup_info(dest)


def _backup_files(backup_dir: str, pattern: re.Pattern) -> list[Path]:
    root = Path(backup_dir)
    if not root.is_dir():
        return []
    return sorted((p for p in root.iterdir() if pattern.match(p.name)), key=lambda p: p.name)


def list_backups(backup_dir: str) -> list[dict]:
    files = _backup_files(backup_dir, AUTO_BACKUP_RE) + _backup_files(backup_dir, LABELED_BACKUP_RE)
    files.sort(key=lambda p: (p.stat().st_mtime, p.name), reverse=True)
    return [backup_info(p) for p in files]


def prune_backups(backup_dir: str, keep: int, keep_labeled: int = KEEP_LABELED) -> list[str]:
    removed = []
    autos = _backup_files(backup_dir, AUTO_BACKUP_RE)[::-1]
    labeled = _backup_files(backup_dir, LABELED_BACKUP_RE)[::-1]
    for path in autos[keep:] + labeled[keep_labeled:]:
        path.unlink(missing_ok=True)
        removed.append(path.name)
    return removed


def ensure_daily_backup(database_path: str, backup_dir: str, keep: int) -> str | None:
    """오늘 자동 백업이 없으면 만들고, 보관 개수를 넘는 오래된 백업을 정리한다."""
    if not Path(database_path).exists():
        return None
    created = None
    if not (Path(backup_dir) / f"todo-{timeutil.today():%Y%m%d}.db").exists():
        created = create_backup(database_path, backup_dir)["name"]
    prune_backups(backup_dir, keep)
    return created


# ── JSON export / import ────────────────────────────────────────────────────
def export_data(db: Session) -> dict[str, Any]:
    projects = db.scalars(select(Project).order_by(Project.id)).all()
    tags = db.scalars(select(Tag).order_by(Tag.id)).all()
    tasks = db.scalars(select(Task).order_by(Task.id)).all()
    return {
        "format": EXPORT_FORMAT,
        "version": EXPORT_VERSION,
        "exported_at": timeutil.now_iso(),
        "projects": [
            {**{c: getattr(p, c) for c in PROJECT_COLUMNS}, "archived": bool(p.archived)}
            for p in projects
        ],
        "tags": [{c: getattr(t, c) for c in TAG_COLUMNS} for t in tags],
        "tasks": [
            {**{c: getattr(t, c) for c in TASK_COLUMNS}, "tag_ids": sorted(g.id for g in t.tags)}
            for t in tasks
        ],
    }


def import_data(
    db: Session, data: dict[str, Any], database_path: str, backup_dir: str
) -> dict[str, Any]:
    """검증된 export 데이터로 전체를 교체한다. 실행 전 preimport 백업을 만든다."""
    backup = create_backup(database_path, backup_dir, label="preimport")
    projects, tags, tasks = data["projects"], data["tags"], data["tasks"]
    try:
        db.execute(delete(task_tags))
        db.execute(delete(Task))
        db.execute(delete(Tag))
        db.execute(delete(Project))

        if projects:
            db.execute(insert(Project), [{c: p[c] for c in PROJECT_COLUMNS} for p in projects])
        if tags:
            db.execute(insert(Tag), [{c: t[c] for c in TAG_COLUMNS} for t in tags])
        if tasks:
            # spawned_task_id는 뒤쪽 행을 가리킬 수 있으므로 삽입 후 따로 채운다.
            rows = [{**{c: t[c] for c in TASK_COLUMNS}, "spawned_task_id": None} for t in tasks]
            db.execute(insert(Task), rows)
        links = [
            {"task_id": t["id"], "tag_id": tag_id}
            for t in tasks
            for tag_id in dict.fromkeys(t["tag_ids"])
        ]
        if links:
            db.execute(insert(task_tags), links)
        for t in tasks:
            if t["spawned_task_id"] is not None:
                db.execute(
                    update(Task)
                    .where(Task.id == t["id"])
                    .values(spawned_task_id=t["spawned_task_id"])
                )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError(
            400,
            "INVALID_IMPORT",
            "가져오기 파일 형식이 올바르지 않아요",
            {"reason": str(exc.orig)},
        ) from exc

    return {
        "projects": len(projects),
        "tags": len(tags),
        "tasks": len(tasks),
        "backup": backup["name"],
    }
