from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app import timeutil
from app.auth import hash_password
from app.config import Settings
from app.main import create_app

PASSWORD = "correct-horse-battery"
KST = ZoneInfo("Asia/Seoul")
# 2026-09-16 (수) 10:00 KST
FIXED_NOW = datetime(2026, 9, 16, 10, 0, tzinfo=KST)


class Clock:
    def __init__(self, now: datetime):
        self.now = now

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **kwargs) -> None:
        self.now += timedelta(**kwargs)


@pytest.fixture(scope="session")
def password() -> str:
    return PASSWORD


@pytest.fixture(scope="session")
def password_hash() -> str:
    return hash_password(PASSWORD)


@pytest.fixture
def clock():
    c = Clock(FIXED_NOW)
    timeutil.set_clock(c)
    yield c
    timeutil.set_clock(None)


@pytest.fixture
def settings(tmp_path, password_hash) -> Settings:
    return Settings(
        app_password_hash=password_hash,
        database_path=str(tmp_path / "todo.db"),
        backup_dir=str(tmp_path / "backups"),
        static_dir=str(tmp_path / "static"),
        cookie_secure=False,
        backup_check_interval=0,
        tz="Asia/Seoul",
    )


@pytest.fixture
def app(settings, clock):
    return create_app(settings)


@pytest.fixture
def client(app):
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_client(client, password):
    r = client.post("/api/auth/login", json={"password": password})
    assert r.status_code == 200, r.text
    return client


@pytest.fixture
def make_project(auth_client):
    def _make(name: str = "회사", color: str = "#F23D52") -> dict:
        r = auth_client.post("/api/projects", json={"name": name, "color": color})
        assert r.status_code == 201, r.text
        return r.json()["data"]

    return _make


@pytest.fixture
def make_task(auth_client):
    def _make(project_id: int, title: str = "할일", **fields) -> dict:
        r = auth_client.post(
            "/api/tasks", json={"project_id": project_id, "title": title, **fields}
        )
        assert r.status_code == 201, r.text
        return r.json()["data"]

    return _make
