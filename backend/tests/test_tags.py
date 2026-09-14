def test_create_and_list_tags(auth_client):
    r = auth_client.post("/api/tags", json={"name": "업무"})
    assert r.status_code == 201
    tag = r.json()["data"]
    assert tag["color"] == "#2FB4E0"
    assert tag["task_count"] == 0

    auth_client.post("/api/tags", json={"name": "개인", "color": "#3DD68C"})
    names = [t["name"] for t in auth_client.get("/api/tags").json()["data"]]
    assert names == sorted(names)
    assert len(names) == 2


def test_duplicate_tag_name_is_case_insensitive(auth_client):
    assert auth_client.post("/api/tags", json={"name": "Work"}).status_code == 201
    r = auth_client.post("/api/tags", json={"name": "work"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "DUPLICATE"


def test_rename_tag(auth_client):
    auth_client.post("/api/tags", json={"name": "A"})
    b = auth_client.post("/api/tags", json={"name": "B"}).json()["data"]

    r = auth_client.patch(f"/api/tags/{b['id']}", json={"name": "a"})
    assert r.status_code == 409

    r = auth_client.patch(f"/api/tags/{b['id']}", json={"name": "C", "color": "#5157E6"})
    assert r.status_code == 200
    assert r.json()["data"]["name"] == "C"
    assert r.json()["data"]["color"] == "#5157E6"


def test_tag_task_count_and_delete_detaches(auth_client, make_project, make_task):
    tag = auth_client.post("/api/tags", json={"name": "중요"}).json()["data"]
    project = make_project()
    task = make_task(project["id"], tag_ids=[tag["id"]])
    assert auth_client.get("/api/tags").json()["data"][0]["task_count"] == 1

    assert auth_client.delete(f"/api/tags/{tag['id']}").status_code == 204
    assert auth_client.get(f"/api/tasks/{task['id']}").json()["data"]["tags"] == []


def test_missing_tag_returns_404(auth_client):
    assert auth_client.delete("/api/tags/999").status_code == 404
    assert auth_client.patch("/api/tags/999", json={"name": "x"}).status_code == 404
