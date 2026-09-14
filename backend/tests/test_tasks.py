def _ids(response) -> list[int]:
    return [t["id"] for t in response.json()["data"]]


def _field_errors(response) -> dict:
    assert response.status_code == 400, response.text
    return response.json()["error"]["details"]["field_errors"]


# ── 생성·검증 ────────────────────────────────────────────────────────────────
def test_create_task_with_tags_and_repeat(auth_client, make_project):
    project = make_project()
    tag = auth_client.post("/api/tags", json={"name": "업무"}).json()["data"]
    r = auth_client.post(
        "/api/tasks",
        json={
            "project_id": project["id"],
            "title": "  주간 보고서  ",
            "due_date": "2026-09-18",
            "due_time": "17:00:00",
            "priority": 3,
            "tag_ids": [tag["id"]],
            "repeat": {"freq": "weekly", "interval": 1, "weekdays": [4]},
        },
    )
    assert r.status_code == 201
    data = r.json()["data"]
    assert data["title"] == "주간 보고서"
    assert data["due_time"] == "17:00"
    assert data["project_name"] == "회사"
    assert [t["id"] for t in data["tags"]] == [tag["id"]]
    assert data["repeat"] == {"freq": "weekly", "interval": 1, "weekdays": [4], "anchor_day": 18}


def test_due_time_requires_due_date(auth_client, make_project):
    project = make_project()
    r = auth_client.post(
        "/api/tasks", json={"project_id": project["id"], "title": "x", "due_time": "10:00"}
    )
    assert "due_time" in _field_errors(r)


def test_repeat_requires_due_date(auth_client, make_project):
    project = make_project()
    r = auth_client.post(
        "/api/tasks",
        json={"project_id": project["id"], "title": "x", "repeat": {"freq": "daily"}},
    )
    assert "repeat" in _field_errors(r)


def test_weekdays_only_allowed_for_weekly(auth_client, make_project):
    project = make_project()
    r = auth_client.post(
        "/api/tasks",
        json={
            "project_id": project["id"],
            "title": "x",
            "due_date": "2026-09-18",
            "repeat": {"freq": "monthly", "weekdays": [1]},
        },
    )
    assert any(key.startswith("repeat") for key in _field_errors(r))


def test_unknown_project_or_tag_rejected(auth_client, make_project):
    r = auth_client.post("/api/tasks", json={"project_id": 999, "title": "x"})
    assert "project_id" in _field_errors(r)

    project = make_project()
    r = auth_client.post(
        "/api/tasks", json={"project_id": project["id"], "title": "x", "tag_ids": [999]}
    )
    assert "tag_ids" in _field_errors(r)


def test_invalid_date_format_rejected(auth_client, make_project):
    project = make_project()
    r = auth_client.post(
        "/api/tasks", json={"project_id": project["id"], "title": "x", "due_date": "2026/09/18"}
    )
    assert "due_date" in _field_errors(r)


def test_invalid_query_param_rejected(auth_client):
    r = auth_client.get("/api/tasks", params={"status": "foo"})
    assert "status" in _field_errors(r)


# ── 목록·정렬·필터 ───────────────────────────────────────────────────────────
def test_sort_by_due(auth_client, make_project, make_task):
    p = make_project()["id"]
    no_due = make_task(p, "기한 없음")
    untimed = make_task(p, "17일", due_date="2026-09-17")
    timed = make_task(p, "17일 09시", due_date="2026-09-17", due_time="09:00")
    earliest = make_task(p, "16일", due_date="2026-09-16")

    r = auth_client.get("/api/tasks")
    assert _ids(r) == [earliest["id"], timed["id"], untimed["id"], no_due["id"]]


def test_sort_by_priority_and_created(auth_client, make_project, make_task):
    p = make_project()["id"]
    low = make_task(p, "낮음", due_date="2026-09-16", priority=1)
    high = make_task(p, "높음", due_date="2026-09-20", priority=3)

    assert _ids(auth_client.get("/api/tasks", params={"sort": "priority"})) == [
        high["id"],
        low["id"],
    ]
    assert _ids(auth_client.get("/api/tasks", params={"sort": "created"})) == [
        high["id"],
        low["id"],
    ]


def test_tag_filter_requires_all_tags(auth_client, make_project, make_task):
    p = make_project()["id"]
    x = auth_client.post("/api/tags", json={"name": "x"}).json()["data"]["id"]
    y = auth_client.post("/api/tags", json={"name": "y"}).json()["data"]["id"]
    both = make_task(p, "둘 다", tag_ids=[x, y])
    make_task(p, "x만", tag_ids=[x])

    assert _ids(auth_client.get("/api/tasks", params={"tag_id": [x, y]})) == [both["id"]]
    assert len(_ids(auth_client.get("/api/tasks", params={"tag_id": x}))) == 2


def test_priority_filter_is_minimum(auth_client, make_project, make_task):
    p = make_project()["id"]
    make_task(p, "보통", priority=2)
    high = make_task(p, "높음", priority=3)
    assert _ids(auth_client.get("/api/tasks", params={"priority": 3})) == [high["id"]]


def test_done_list_sorted_by_completed_at(auth_client, clock, make_project, make_task):
    p = make_project()["id"]
    first = make_task(p, "먼저")
    second = make_task(p, "나중")
    auth_client.post(f"/api/tasks/{first['id']}/complete")
    clock.advance(minutes=5)
    auth_client.post(f"/api/tasks/{second['id']}/complete")

    assert _ids(auth_client.get("/api/tasks", params={"status": "done"})) == [
        second["id"],
        first["id"],
    ]
    assert _ids(auth_client.get("/api/tasks")) == []


def test_upcoming_groups(auth_client, make_project, make_task):
    p = make_project()["id"]
    make_task(p, "지남", due_date="2026-09-15")
    make_task(p, "오늘", due_date="2026-09-16", due_time="11:00")
    make_task(p, "내일", due_date="2026-09-17")
    make_task(p, "이번 주", due_date="2026-09-19")
    make_task(p, "이후", due_date="2026-09-25")
    make_task(p, "기한 없음")

    data = auth_client.get("/api/tasks/upcoming").json()["data"]
    assert data["today"] == "2026-09-16"
    assert data["counts"] == {
        "overdue": 1, "today": 1, "tomorrow": 1, "this_week": 1, "later": 1, "no_due": 1,
    }  # fmt: skip
    assert data["groups"]["today"][0]["title"] == "오늘"


# ── 완료 / 반복 ─────────────────────────────────────────────────────────────
def test_complete_simple_task_is_idempotent(auth_client, make_project, make_task):
    task = make_task(make_project()["id"])
    r = auth_client.post(f"/api/tasks/{task['id']}/complete")
    assert r.status_code == 200
    assert r.json()["data"]["spawned_task"] is None
    assert r.json()["data"]["task"]["completed_at"] is not None

    again = auth_client.post(f"/api/tasks/{task['id']}/complete")
    assert again.status_code == 200
    assert again.json()["data"]["spawned_task"] is None


def test_complete_weekly_repeat_spawns_next(auth_client, make_project, make_task):
    p = make_project()["id"]
    tag = auth_client.post("/api/tags", json={"name": "업무"}).json()["data"]
    task = make_task(
        p,
        "주간 보고서",
        due_date="2026-09-18",
        due_time="17:00",
        priority=3,
        tag_ids=[tag["id"]],
        repeat={"freq": "weekly", "weekdays": [4]},
    )

    data = auth_client.post(f"/api/tasks/{task['id']}/complete").json()["data"]
    spawned = data["spawned_task"]
    assert spawned["due_date"] == "2026-09-25"
    assert spawned["due_time"] == "17:00"
    assert spawned["priority"] == 3
    assert [t["id"] for t in spawned["tags"]] == [tag["id"]]
    assert spawned["repeat"]["freq"] == "weekly"
    assert data["task"]["repeat"] is None
    assert data["task"]["spawned_task_id"] == spawned["id"]

    auth_client.post(f"/api/tasks/{task['id']}/complete")
    open_titles = [t["title"] for t in auth_client.get("/api/tasks").json()["data"]]
    assert open_titles.count("주간 보고서") == 1


def test_uncomplete_removes_open_spawned_task(auth_client, make_project, make_task):
    task = make_task(make_project()["id"], due_date="2026-09-16", repeat={"freq": "monthly"})
    spawned = auth_client.post(f"/api/tasks/{task['id']}/complete").json()["data"]["spawned_task"]
    assert spawned["due_date"] == "2026-10-16"

    data = auth_client.post(f"/api/tasks/{task['id']}/uncomplete").json()["data"]
    assert data["removed_spawned_task_id"] == spawned["id"]
    assert data["task"]["completed_at"] is None
    assert data["task"]["repeat"]["freq"] == "monthly"
    assert auth_client.get(f"/api/tasks/{spawned['id']}").status_code == 404


def test_uncomplete_keeps_chain_when_spawned_done(auth_client, make_project, make_task):
    task = make_task(make_project()["id"], due_date="2026-09-16", repeat={"freq": "daily"})
    spawned = auth_client.post(f"/api/tasks/{task['id']}/complete").json()["data"]["spawned_task"]
    auth_client.post(f"/api/tasks/{spawned['id']}/complete")

    data = auth_client.post(f"/api/tasks/{task['id']}/uncomplete").json()["data"]
    assert data["removed_spawned_task_id"] is None
    assert data["task"]["repeat"] is None
    assert auth_client.get(f"/api/tasks/{spawned['id']}").status_code == 200

    idle = auth_client.post(f"/api/tasks/{task['id']}/uncomplete").json()["data"]
    assert idle["removed_spawned_task_id"] is None


# ── 수정·삭제 ───────────────────────────────────────────────────────────────
def test_patch_clearing_due_date_clears_time_and_repeat(auth_client, make_project, make_task):
    task = make_task(
        make_project()["id"],
        due_date="2026-09-30",
        due_time="09:00",
        repeat={"freq": "monthly"},
    )
    data = auth_client.patch(f"/api/tasks/{task['id']}", json={"due_date": None}).json()["data"]
    assert data["due_date"] is None
    assert data["due_time"] is None
    assert data["repeat"] is None


def test_patch_updates_anchor_day_with_due_date(auth_client, make_project, make_task):
    task = make_task(make_project()["id"], due_date="2026-09-30", repeat={"freq": "monthly"})
    assert task["repeat"]["anchor_day"] == 30
    r = auth_client.patch(f"/api/tasks/{task['id']}", json={"due_date": "2026-10-31"})
    assert r.json()["data"]["repeat"]["anchor_day"] == 31


def test_patch_rejects_null_title(auth_client, make_project, make_task):
    task = make_task(make_project()["id"])
    r = auth_client.patch(f"/api/tasks/{task['id']}", json={"title": None})
    assert r.status_code == 400


def test_patch_validation_does_not_persist(auth_client, make_project, make_task):
    task = make_task(make_project()["id"], due_date="2026-09-20")
    r = auth_client.patch(
        f"/api/tasks/{task['id']}", json={"title": "바뀜", "due_date": None, "due_time": "10:00"}
    )
    assert r.status_code == 400
    assert auth_client.get(f"/api/tasks/{task['id']}").json()["data"]["title"] == "할일"


def test_patch_replaces_tags_and_moves_project(auth_client, make_project, make_task):
    first, second = make_project("A"), make_project("B")
    x = auth_client.post("/api/tags", json={"name": "x"}).json()["data"]["id"]
    y = auth_client.post("/api/tags", json={"name": "y"}).json()["data"]["id"]
    task = make_task(first["id"], tag_ids=[x])

    r = auth_client.patch(
        f"/api/tasks/{task['id']}", json={"tag_ids": [y], "project_id": second["id"]}
    )
    data = r.json()["data"]
    assert [t["id"] for t in data["tags"]] == [y]
    assert data["project_name"] == "B"


def test_delete_task(auth_client, make_project, make_task):
    task = make_task(make_project()["id"])
    assert auth_client.delete(f"/api/tasks/{task['id']}").status_code == 204
    assert auth_client.get(f"/api/tasks/{task['id']}").status_code == 404
    assert auth_client.delete(f"/api/tasks/{task['id']}").status_code == 404
