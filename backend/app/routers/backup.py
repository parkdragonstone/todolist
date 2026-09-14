# Design Ref: §4.2 /api/export, /api/import, /api/backups
import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app import timeutil
from app.auth import require_auth
from app.config import Settings
from app.db import get_db
from app.errors import AppError
from app.schemas import ImportFile
from app.services.backup import create_backup, export_data, import_data, list_backups

router = APIRouter(prefix="/api", tags=["backup"], dependencies=[Depends(require_auth)])

MAX_IMPORT_BYTES = 10 * 1024 * 1024


def _invalid_import(message: str = "가져오기 파일 형식이 올바르지 않아요") -> AppError:
    return AppError(400, "INVALID_IMPORT", message)


def _too_large() -> AppError:
    return AppError(413, "PAYLOAD_TOO_LARGE", "파일이 너무 커요")


@router.get("/export")
def export_json(db: Session = Depends(get_db)):
    filename = f"todolist-{timeutil.now():%Y%m%d-%H%M}.json"
    return JSONResponse(
        export_data(db),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import")
async def import_json(request: Request, db: Session = Depends(get_db)):
    if not request.headers.get("content-type", "").startswith("application/json"):
        raise _invalid_import("JSON 형식으로만 가져올 수 있어요")
    try:
        declared = int(request.headers.get("content-length") or 0)
    except ValueError as exc:
        raise _invalid_import() from exc
    if declared > MAX_IMPORT_BYTES:
        raise _too_large()

    body = await request.body()
    if len(body) > MAX_IMPORT_BYTES:
        raise _too_large()
    try:
        parsed = ImportFile.model_validate(json.loads(body))
    except (ValueError, ValidationError) as exc:
        raise _invalid_import() from exc

    settings: Settings = request.app.state.settings
    result = await run_in_threadpool(
        import_data, db, parsed.model_dump(), settings.database_path, settings.backup_dir
    )
    return {"data": result}


@router.get("/backups")
def get_backups(request: Request):
    settings: Settings = request.app.state.settings
    return {"data": list_backups(settings.backup_dir)}


@router.post("/backups", status_code=201)
def post_backup(request: Request):
    settings: Settings = request.app.state.settings
    return {"data": create_backup(settings.database_path, settings.backup_dir, label="manual")}
