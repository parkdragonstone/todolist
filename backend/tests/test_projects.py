def test_create_project_assigns_increasing_sort_order(auth_client):
    first = auth_client.post("/api/projects", json={"name": "회사", "color": "#F23D52"})
    assert first.status_code == 201
    data = first.json()["data"]
    assert data["id"] > 0
    assert data["sort_order"] == 0
    assert data["open_count"] == 0

    second = auth_client.post("/api/projects", json={"name": "개인"})
    assert second.json()["data"]["sort_order"] == 1
    assert second.json()["data"]["color"] == "#F23D52"


def test_create_project_validation(auth_client):
    r = auth_client.post("/api/projects", json={"name": "   "})
    assert r.status_code == 400
    assert "name" in r.json()["error"]["details"]["field_errors"]

    r = auth_client.post("/api/projects", json={"name": "회사", "color": "red"})
    assert r.status_code == 400
    assert "color" in r.json()["error"]["details"]["field_errors"]


def test_project_open_and_overdue_counts(auth_client, make_project, make_task):
    project = make_project()
    make_task(project["id"], due_date="2026-09-15")
    make_task(project["id"], due_date="2026-09-16", due_time="09:00")
    make_task(project["id"], due_date="2026-09-20")
    done = make_task(project["id"])
    auth_client.post(f"/api/tasks/{done['id']}/complete")

    data = auth_client.get("/api/projects").json()["data"][0]
    assert data["open_count"] == 3
    assert data["overdue_count"] == 2


def test_reorder_requires_exact_active_set(auth_client, make_project):
    a, b, c = make_project("A"), make_project("B"), make_project("C")

    r = auth_client.put("/api/projects/order", json={"ids": [a["id"], b["id"]]})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"

    r = auth_client.put("/api/projects/order", json={"ids": [a["id"], a["id"], b["id"]]})
    assert r.status_code == 400

    r = auth_client.put("/api/projects/order", json={"ids": [c["id"], a["id"], b["id"]]})
    assert r.status_code == 200
    assert [p["id"] for p in r.json()["data"]] == [c["id"], a["id"], b["id"]]


def test_archive_hides_project_unless_requested(auth_client, make_project):
    project = make_project()
    r = auth_client.patch(
        f"/api/projects/{project['id']}", json={"archived": True, "name": "옛 회사"}
    )
    assert r.status_code == 200
    assert r.json()["data"]["archived"] is True
    assert r.json()["data"]["name"] == "옛 회사"

    assert auth_client.get("/api/projects").json()["data"] == []
    archived = auth_client.get("/api/projects", params={"include_archived": "true"}).json()["data"]
    assert [p["id"] for p in archived] == [project["id"]]


def test_archived_project_tasks_hidden_from_upcoming(auth_client, make_project, make_task):
    project = make_project()
    make_task(project["id"], due_date="2026-09-16")
    auth_client.patch(f"/api/projects/{project['id']}", json={"archived": True})

    upcoming = auth_client.get("/api/tasks/upcoming").json()["data"]
    assert upcoming["counts"]["today"] == 0
    tasks = auth_client.get("/api/tasks", params={"project_id": project["id"]}).json()["data"]
    assert len(tasks) == 1


def test_patch_missing_project_returns_404(auth_client):
    r = auth_client.patch("/api/projects/999", json={"name": "없음"})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


def test_delete_project_cascades_tasks(auth_client, make_project, make_task):
    project = make_project()
    task = make_task(project["id"])
    assert auth_client.delete(f"/api/projects/{project['id']}").status_code == 204
    assert auth_client.get(f"/api/tasks/{task['id']}").status_code == 404
