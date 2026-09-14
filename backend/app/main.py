# Design Ref: §2.1 — 단일 앱 컨테이너: /api 라우터 + 정적 PWA(SPA fallback) + lifespan
import asyncio
import logging
import mimetypes
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from sqlalchemy.orm import sessionmaker

from app import timeutil
from app.auth import LoginRateLimiter, origin_guard
from app.config import Settings, get_settings
from app.db import create_db_engine, run_migrations
from app.errors import install_error_handlers, not_found
from app.routers import auth, backup, calendar, projects, tags, tasks
from app.services.backup import ensure_daily_backup

logger = logging.getLogger("app")

mimetypes.add_type("application/manifest+json", ".webmanifest")
NO_CACHE = {"Cache-Control": "no-cache"}
IMMUTABLE = {"Cache-Control": "public, max-age=31536000, immutable"}


async def _daily_backup_loop(settings: Settings) -> None:
    """Plan SC: 일일 자동 백업 — 주기적으로 오늘 백업 존재 여부를 확인한다."""
    while True:
        try:
            await asyncio.to_thread(
                ensure_daily_backup,
                settings.database_path,
                settings.backup_dir,
                settings.backup_keep,
            )
        except Exception:
            logger.exception("daily backup failed")
        await asyncio.sleep(settings.backup_check_interval)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    timeutil.configure(settings.tz)
    engine = create_db_engine(settings.database_path)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        run_migrations(settings.database_path)
        if not settings.app_password_hash:
            logger.warning("APP_PASSWORD_HASH is not set: login is disabled")
        backup_task = None
        if settings.backup_check_interval > 0:
            backup_task = asyncio.create_task(_daily_backup_loop(settings))
        yield
        if backup_task:
            backup_task.cancel()
            with suppress(asyncio.CancelledError):
                await backup_task
        engine.dispose()

    app = FastAPI(
        title="todolist",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.enable_docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.enable_docs else None,
    )
    app.state.settings = settings
    app.state.session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    app.state.login_limiter = LoginRateLimiter()

    install_error_handlers(app)
    app.middleware("http")(origin_guard)

    @app.get("/api/health", include_in_schema=False)
    def health():
        return {"status": "ok"}

    for module in (auth, projects, tasks, tags, calendar, backup):
        app.include_router(module.router)
    _mount_spa(app, Path(settings.static_dir))
    return app


def _mount_spa(app: FastAPI, static_dir: Path) -> None:
    """Design Ref: §5.5 — 해시된 assets는 immutable, 그 외(index.html, sw.js 등)는 no-cache."""

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise not_found()
        root = static_dir.resolve()
        if full_path:
            candidate = (root / full_path).resolve()
            if candidate.is_file() and candidate.is_relative_to(root):
                headers = IMMUTABLE if full_path.startswith("assets/") else NO_CACHE
                return FileResponse(candidate, headers=headers)
        index = root / "index.html"
        if index.is_file():
            return FileResponse(index, headers=NO_CACHE)
        raise not_found()


app = create_app()
