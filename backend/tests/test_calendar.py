def test_calendar_range_validation(auth_client):
    r = auth_client.get("/api/calendar", params={"from": "2026-09-01", "to": "2026-11-03"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"

    r = auth_client.get("/api/calendar", params={"from": "2026-09-10", "to": "2026-09-01"})
    assert r.status_code == 400

    r = auth_client.get("/api/calendar", params={"to": "2026-09-30"})
    assert "from" in r.json()["error"]["details"]["field_errors"]


def test_calendar_aggregates_days(auth_client, make_project, make_task):
    work = make_project("회사", "#F23D52")["id"]
    side = make_project("사이드", "#5157E6")["id"]
    personal = make_project("개인", "#3DD68C")["id"]
    extra = make_project("기타", "#FF8A3D")["id"]

    make_task(work, "지난 할일", due_date="2026-09-15")
    done = make_task(side, "끝낸 할일", due_date="2026-09-15")
    auth_client.post(f"/api/tasks/{done['id']}/complete")
    for project_id in (work, side, personal, extra):
        make_task(project_id, "18일", due_date="2026-09-18")
    make_task(work, "범위 밖", due_date="2026-10-20")

    params = {"from": "2026-08-31", "to": "2026-10-11"}
    data = auth_client.get("/api/calendar", params=params).json()["data"]
    assert data["from"] == "2026-08-31"

    day15 = data["days"]["2026-09-15"]
    assert (day15["open"], day15["done"], day15["overdue"]) == (1, 1, 1)
    assert day15["colors"] == ["#F23D52"]
    assert len(day15["tasks"]) == 2

    day18 = data["days"]["2026-09-18"]
    assert day18["open"] == 4
    assert day18["colors"] == ["#F23D52", "#5157E6", "#3DD68C"]
    assert "2026-10-20" not in data["days"]


def test_calendar_can_exclude_done(auth_client, make_project, make_task):
    project = make_project()["id"]
    make_task(project, "열림", due_date="2026-09-15")
    done = make_task(project, "완료", due_date="2026-09-15")
    auth_client.post(f"/api/tasks/{done['id']}/complete")

    params = {"from": "2026-09-01", "to": "2026-09-30", "include_done": "false"}
    day = auth_client.get("/api/calendar", params=params).json()["data"]["days"]["2026-09-15"]
    assert day["done"] == 0
    assert [t["title"] for t in day["tasks"]] == ["열림"]
