# Design Ref: §10.3 — 환경변수 기반 설정
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    app_password_hash: str = ""
    session_days: int = 90
    cookie_secure: bool = True
    database_path: str = "/data/todo.db"
    backup_dir: str = "/data/backups"
    backup_keep: int = 14
    tz: str = "Asia/Seoul"
    enable_docs: bool = False
    static_dir: str = "static"
    # 일일 백업 존재 여부 확인 주기(초). 0이면 백그라운드 백업 비활성(테스트용)
    backup_check_interval: int = 3600


@lru_cache
def get_settings() -> Settings:
    return Settings()
