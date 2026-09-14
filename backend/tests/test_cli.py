import io

import pytest
from sqlalchemy.orm import Session

from app import timeutil
from app.auth import verify_password
from app.cli import main, seed_demo
from app.config import get_settings
from app.db import create_db_engine
from app.services.due_groups import group_tasks
from app.services.task_query import list_tasks


def test_seed_demo_fills_every_due_group(client, settings, clock):
    engine = create_db_engine(settings.database_path)
    try:
        with Session(engine) as db:
            assert seed_demo(db) == {"projects": 3, "tags": 3, "tasks": 14}
            assert seed_demo(db)["projects"] == 0
            groups = group_tasks(list_tasks(db), timeutil.now())
            assert {key: len(items) for key, items in groups.items()} == {
                "overdue": 2, "today": 3, "tomorrow": 2, "this_week": 2, "later": 2, "no_due": 2,
            }  # fmt: skip
    finally:
        engine.dispose()


def test_seed_command_skips_when_data_exists(tmp_path, monkeypatch, capsys, clock):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "cli.db"))
    get_settings.cache_clear()
    try:
        main(["seed"])
        assert "seed 완료" in capsys.readouterr().out
        main(["seed"])
        assert "건너뛰었어요" in capsys.readouterr().out
    finally:
        get_settings.cache_clear()


def test_hash_password_command(monkeypatch, capsys):
    monkeypatch.setattr("sys.stdin", io.StringIO("long-enough-pass\n"))
    main(["hash-password"])
    captured = capsys.readouterr()
    hashed = captured.out.strip().splitlines()[0]
    assert verify_password("long-enough-pass", hashed)
    assert "APP_PASSWORD_HASH='" in captured.err


def test_hash_password_rejects_short_password(monkeypatch):
    monkeypatch.setattr("sys.stdin", io.StringIO("short\n"))
    with pytest.raises(SystemExit):
        main(["hash-password"])
