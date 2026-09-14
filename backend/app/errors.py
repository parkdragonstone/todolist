# Design Ref: §6 — 모든 오류를 { "error": { code, message, details } } 형식으로 변환
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("app")


class AppError(Exception):
    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        details: dict | None = None,
        headers: dict[str, str] | None = None,
    ):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details or {}
        self.headers = headers


def not_found() -> AppError:
    return AppError(404, "NOT_FOUND", "항목을 찾을 수 없어요")


def unauthorized() -> AppError:
    return AppError(401, "UNAUTHORIZED", "로그인이 필요해요")


def validation_error(field_errors: dict[str, str]) -> AppError:
    return AppError(
        400, "VALIDATION_ERROR", "입력값을 확인해주세요", {"field_errors": field_errors}
    )


def error_response(
    status: int,
    code: str,
    message: str,
    details: dict | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    body = {"error": {"code": code, "message": message, "details": details or {}}}
    return JSONResponse(status_code=status, content=body, headers=headers)


_HTTP_CODES = {
    404: ("NOT_FOUND", "항목을 찾을 수 없어요"),
    405: ("METHOD_NOT_ALLOWED", "허용되지 않은 요청이에요"),
}


def _field_key(loc: tuple) -> str:
    parts = [str(p) for p in loc]
    if parts and parts[0] in {"body", "query", "path", "header", "cookie"}:
        parts = parts[1:]
    return ".".join(parts) or "body"


def _clean_message(msg: str) -> str:
    return msg.removeprefix("Value error, ")


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_request: Request, exc: AppError):
        return error_response(exc.status, exc.code, exc.message, exc.details, exc.headers)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_request: Request, exc: RequestValidationError):
        field_errors: dict[str, str] = {}
        for err in exc.errors():
            field_errors.setdefault(
                _field_key(tuple(err.get("loc", ()))), _clean_message(err["msg"])
            )
        return error_response(
            400, "VALIDATION_ERROR", "입력값을 확인해주세요", {"field_errors": field_errors}
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_request: Request, exc: StarletteHTTPException):
        code, message = _HTTP_CODES.get(exc.status_code, ("HTTP_ERROR", str(exc.detail)))
        return error_response(exc.status_code, code, message, headers=exc.headers)

    @app.exception_handler(Exception)
    async def _unhandled(_request: Request, exc: Exception):
        logger.exception("unhandled error", exc_info=exc)
        return error_response(500, "INTERNAL_ERROR", "문제가 생겼어요")
