# Design Ref: §4.0, §7 — argon2 비밀번호, 서버 저장 세션 토큰(sha256), 레이트리밋, Origin 검사
import hashlib
import math
import secrets
import threading
import time
from collections.abc import Callable
from datetime import datetime, timedelta
from urllib.parse import urlsplit

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, Request, Response
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app import timeutil
from app.config import Settings
from app.db import get_db
from app.errors import error_response, unauthorized
from app.models import SessionRecord

COOKIE_NAME = "todo_session"
MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
LAST_SEEN_UPDATE_SECONDS = 60

_hasher = PasswordHasher()


# ── 비밀번호 ────────────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


# ── 레이트리밋 (단일 워커 in-memory) ─────────────────────────────────────────
class LoginRateLimiter:
    """IP별 5회/15분, 전체 30회/1시간 실패 시 15분 잠금."""

    def __init__(
        self,
        per_ip_limit: int = 5,
        per_ip_window: int = 900,
        global_limit: int = 30,
        global_window: int = 3600,
        lock_seconds: int = 900,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.per_ip_limit = per_ip_limit
        self.per_ip_window = per_ip_window
        self.global_limit = global_limit
        self.global_window = global_window
        self.lock_seconds = lock_seconds
        self._clock = clock
        self._lock = threading.Lock()
        self._failures: dict[str, list[float]] = {}
        self._global_failures: list[float] = []
        self._locked_until: dict[str, float] = {}
        self._global_locked_until = 0.0

    def retry_after(self, ip: str) -> int:
        with self._lock:
            now = self._clock()
            until = max(self._locked_until.get(ip, 0.0), self._global_locked_until)
            return math.ceil(until - now) if until > now else 0

    def record_failure(self, ip: str) -> None:
        with self._lock:
            now = self._clock()
            ip_failures = [t for t in self._failures.get(ip, []) if now - t < self.per_ip_window]
            ip_failures.append(now)
            self._global_failures = [
                t for t in self._global_failures if now - t < self.global_window
            ] + [now]

            if len(ip_failures) >= self.per_ip_limit:
                self._locked_until[ip] = now + self.lock_seconds
                ip_failures = []
            if len(self._global_failures) >= self.global_limit:
                self._global_locked_until = now + self.lock_seconds
                self._global_failures = []
            self._failures[ip] = ip_failures

    def reset(self, ip: str) -> None:
        with self._lock:
            self._failures.pop(ip, None)
            self._locked_until.pop(ip, None)


# ── 세션 ────────────────────────────────────────────────────────────────────
def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user_agent: str, days: int) -> str:
    token = secrets.token_urlsafe(32)
    now = timeutil.now()
    db.execute(delete(SessionRecord).where(SessionRecord.expires_at < now.isoformat()))
    db.add(
        SessionRecord(
            token_hash=hash_token(token),
            created_at=now.isoformat(),
            expires_at=(now + timedelta(days=days)).isoformat(),
            last_seen_at=now.isoformat(),
            user_agent=user_agent[:200],
        )
    )
    db.commit()
    return token


def validate_session(db: Session, token: str, days: int) -> tuple[SessionRecord | None, bool]:
    """(세션, 만료 연장 여부)를 반환한다. 남은 기간이 절반 이하이면 만료를 연장한다(sliding)."""
    record = db.get(SessionRecord, hash_token(token))
    if record is None:
        return None, False

    now = timeutil.now()
    expires_at = datetime.fromisoformat(record.expires_at)
    if expires_at <= now:
        db.delete(record)
        db.commit()
        return None, False

    extended = False
    changed = False
    if expires_at - now < timedelta(days=days) / 2:
        record.expires_at = (now + timedelta(days=days)).isoformat()
        extended = changed = True
    last_seen = datetime.fromisoformat(record.last_seen_at)
    if (now - last_seen).total_seconds() >= LAST_SEEN_UPDATE_SECONDS:
        record.last_seen_at = now.isoformat()
        changed = True
    if changed:
        db.commit()
    return record, extended


def delete_session(db: Session, token: str) -> None:
    db.execute(delete(SessionRecord).where(SessionRecord.token_hash == hash_token(token)))
    db.commit()


def set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=settings.session_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def require_auth(request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise unauthorized()
    settings: Settings = request.app.state.settings
    record, extended = validate_session(db, token, settings.session_days)
    if record is None:
        raise unauthorized()
    if extended:
        set_session_cookie(response, token, settings)


# ── CSRF: Origin 검사 ───────────────────────────────────────────────────────
def is_same_origin(origin: str, host: str | None) -> bool:
    return bool(host) and urlsplit(origin).netloc.lower() == host.lower()


async def origin_guard(request: Request, call_next):
    if request.method in MUTATING_METHODS and request.url.path.startswith("/api/"):
        origin = request.headers.get("origin")
        if origin and not is_same_origin(origin, request.headers.get("host")):
            return error_response(403, "FORBIDDEN_ORIGIN", "허용되지 않은 요청이에요")
    return await call_next(request)
