from pathlib import Path

from app.routers import backup as backup_router
from app.services.backup import create_backup, ensure_daily_backup, prune_backups


def test_manual_backup_is_created_and_listed(auth_client, settings):
    r = auth_client.post("/api/backups")
    assert r.status_code == 201
    name = r.json()["data"]["name"]
    assert name.endswith("-manual.db")
    assert (Path(settings.backup_dir) / name).exists()

    listed = [b["name"] for b in auth_client.get("/api/backups").json()["data"]]
    assert name in listed


def test_export_import_round_trip(auth_client, make_project, make_task):
    project = make_project()
    tag = auth_client.post("/api/tags", json={"name": "업무"}).json()["data"]
    task = make_task(
        project["id"],
        "주간 보고서",
        due_date="2026-09-18",
        tag_ids=[tag["id"]],
        repeat={"freq": "weekly", "weekdays": [4]},
    )
    spawned = auth_client.post(f"/api/tasks/{task['id']}/complete").json()["data"]["spawned_task"]

    exported = auth_client.get("/api/export")
    assert exported.status_code == 200
    assert "attachment" in exported.headers["content-disposition"]
    payload = exported.json()
    assert payload["format"] == "todolist-export"

    auth_client.delete(f"/api/projects/{project['id']}")
    assert auth_client.get("/api/tasks", params={"status": "all"}).json()["data"] == []

    r = auth_client.post("/api/import", json=payload)
    assert r.status_code == 200, r.text
    result = r.json()["data"]
    assert (result["projects"], result["tags"], result["tasks"]) == (1, 1, 2)
    assert result["backup"].endswith("-preimport.db")

    restored = auth_client.get(f"/api/tasks/{task['id']}").json()["data"]
    assert restored["spawned_task_id"] == spawned["id"]
    assert [t["name"] for t in restored["tags"]] == ["업무"]


def test_import_invalid_format_keeps_data(auth_client, make_project):
    make_project()
    r = auth_client.post(
        "/api/import",
        json={"format": "other", "version": 1, "projects": [], "tags": [], "tasks": []},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_IMPORT"
    assert len(auth_client.get("/api/projects").json()["data"]) == 1


def test_import_integrity_error_rolls_back(auth_client, make_project):
    make_project()
    stamp = "2026-09-16T10:00:00+09:00"
    payload = {
        "format": "todolist-export",
        "version": 1,
        "projects": [],
        "tags": [],
        "tasks": [
            {"id": 1, "project_id": 999, "title": "고아", "created_at": stamp, "updated_at": stamp}
        ],
    }
    r = auth_client.post("/api/import", json=payload)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_IMPORT"
    assert len(auth_client.get("/api/projects").json()["data"]) == 1


def test_import_requires_json(auth_client):
    r = auth_client.post("/api/import", content="not json", headers={"content-type": "text/plain"})
    assert r.status_code == 400
    r = auth_client.post(
        "/api/import", content="{broken", headers={"content-type": "application/json"}
    )
    assert r.status_code == 400


def test_import_too_large(auth_client, monkeypatch):
    monkeypatch.setattr(backup_router, "MAX_IMPORT_BYTES", 10)
    r = auth_client.post("/api/import", json={"format": "todolist-export", "version": 1})
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_ensure_daily_backup_keeps_latest_fourteen(client, settings, clock):
    backup_dir = Path(settings.backup_dir)
    for _ in range(16):
        clock.advance(days=1)
        assert ensure_daily_backup(settings.database_path, str(backup_dir), keep=14)

    autos = sorted(p.name for p in backup_dir.glob("todo-????????.db"))
    assert len(autos) == 14
    assert autos[-1] == f"todo-{clock.now:%Y%m%d}.db"
    assert ensure_daily_backup(settings.database_path, str(backup_dir), keep=14) is None


def test_labeled_backups_pruned_to_five(client, settings, clock):
    for _ in range(7):
        clock.advance(seconds=1)
        create_backup(settings.database_path, settings.backup_dir, label="manual")
    removed = prune_backups(settings.backup_dir, keep=14)
    assert len(removed) == 2
    assert len(list(Path(settings.backup_dir).glob("*-manual.db"))) == 5


def test_ensure_daily_backup_without_database(tmp_path):
    assert ensure_daily_backup(str(tmp_path / "missing.db"), str(tmp_path / "b"), keep=14) is None
