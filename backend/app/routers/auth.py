# Design Ref: §4.2 POST /api/auth/login, /logout, GET /me
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.auth import (
    COOKIE_NAME,
    create_session,
    delete_session,
    require_auth,
    set_session_cookie,
    verify_password,
)
from app.config import Settings
from app.db import get_db
from app.errors import AppError
from app.schemas import LoginIn

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    settings: Settings = request.app.state.settings
    limiter = request.app.state.login_limiter
    ip = request.client.host if request.client else "unknown"

    wait = limiter.retry_after(ip)
    if wait:
        raise AppError(
            429,
            "TOO_MANY_ATTEMPTS",
            "잠시 후 다시 시도해주세요",
            {"retry_after": wait},
            headers={"Retry-After": str(wait)},
        )

    if not verify_password(payload.password, settings.app_password_hash):
        limiter.record_failure(ip)
        raise AppError(401, "INVALID_PASSWORD", "비밀번호가 맞지 않아요")

    limiter.reset(ip)
    token = create_session(db, request.headers.get("user-agent", ""), settings.session_days)
    set_session_cookie(response, token, settings)
    return {"data": {"authenticated": True}}


@router.post("/logout", status_code=204, dependencies=[Depends(require_auth)])
def logout(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        delete_session(db, token)
    response = Response(status_code=204)
    response.delete_cookie(COOKIE_NAME, path="/")
    return response


@router.get("/me", dependencies=[Depends(require_auth)])
def me():
    return {"data": {"authenticated": True}}
