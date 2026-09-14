from fastapi.testclient import TestClient

from app.auth import LoginRateLimiter
from app.db import run_migrations
from app.main import create_app


def test_health_without_auth(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_protected_endpoint_requires_auth(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"


def test_login_sets_httponly_session_cookie(client, password):
    r = client.post("/api/auth/login", json={"password": password})
    assert r.status_code == 200
    assert r.json()["data"]["authenticated"] is True
    cookie = r.headers["set-cookie"]
    assert "todo_session=" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert client.get("/api/auth/me").status_code == 200


def test_login_wrong_password(client):
    r = client.post("/api/auth/login", json={"password": "wrong-password"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "INVALID_PASSWORD"


def test_login_validation_error(client):
    r = client.post("/api/auth/login", json={})
    assert r.status_code == 400
    body = r.json()["error"]
    assert body["code"] == "VALIDATION_ERROR"
    assert "password" in body["details"]["field_errors"]


def test_login_rate_limit_locks_after_five_failures(client, password):
    for _ in range(5):
        assert client.post("/api/auth/login", json={"password": "nope"}).status_code == 401
    r = client.post("/api/auth/login", json={"password": password})
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "TOO_MANY_ATTEMPTS"
    assert int(r.headers["retry-after"]) > 0


def test_logout_invalidates_session(auth_client):
    assert auth_client.post("/api/auth/logout").status_code == 204
    assert auth_client.get("/api/auth/me").status_code == 401


def test_cross_origin_mutation_rejected(auth_client):
    r = auth_client.post("/api/auth/logout", headers={"Origin": "https://evil.example"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "FORBIDDEN_ORIGIN"
    r = auth_client.post("/api/auth/logout", headers={"Origin": "http://testserver"})
    assert r.status_code == 204


def test_session_expires(auth_client, clock):
    clock.advance(days=91)
    assert auth_client.get("/api/auth/me").status_code == 401


def test_session_sliding_extension(auth_client, clock):
    clock.advance(days=50)
    r = auth_client.get("/api/auth/me")
    assert r.status_code == 200
    assert "todo_session=" in r.headers.get("set-cookie", "")
    clock.advance(days=50)
    assert auth_client.get("/api/auth/me").status_code == 200


def test_login_disabled_without_password_hash(settings, clock, password):
    settings.app_password_hash = ""
    with TestClient(create_app(settings)) as c:
        assert c.post("/api/auth/login", json={"password": password}).status_code == 401


def test_rate_limiter_global_lock_and_release():
    now = [0.0]
    limiter = LoginRateLimiter(clock=lambda: now[0])
    for i in range(30):
        limiter.record_failure(f"10.0.0.{i}")
    assert limiter.retry_after("10.9.9.9") > 0
    now[0] += 901
    assert limiter.retry_after("10.9.9.9") == 0


def test_rate_limiter_window_expiry():
    now = [0.0]
    limiter = LoginRateLimiter(clock=lambda: now[0])
    for _ in range(4):
        limiter.record_failure("1.1.1.1")
    now[0] += 901
    limiter.record_failure("1.1.1.1")
    assert limiter.retry_after("1.1.1.1") == 0


def test_spa_serves_static_files_and_fallback(client, settings):
    from pathlib import Path

    static = Path(settings.static_dir)
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text("<html>app</html>")
    (static / "assets" / "app.js").write_text("console.log(1)")

    r = client.get("/calendar")
    assert r.status_code == 200
    assert "app" in r.text
    assert r.headers["cache-control"] == "no-cache"

    r = client.get("/assets/app.js")
    assert r.status_code == 200
    assert "immutable" in r.headers["cache-control"]

    r = client.get("/api/unknown")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


def test_spa_without_build_returns_404(client):
    assert client.get("/").status_code == 404


def test_migrations_are_idempotent(settings):
    assert run_migrations(settings.database_path) == 1
    assert run_migrations(settings.database_path) == 1
