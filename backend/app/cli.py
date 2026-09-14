# Design Ref: §8.5, §11.4 — 운영 보조 명령 (python -m app.cli hash-password | seed)
import argparse
import getpass
import sys
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import timeutil
from app.models import Project, Tag, Task


def _read_password() -> str:
    if sys.stdin.isatty():
        password = getpass.getpass("새 비밀번호: ")
        if password != getpass.getpass("비밀번호 확인: "):
            raise SystemExit("비밀번호가 일치하지 않아요")
    else:
        password = sys.stdin.readline().rstrip("\n")
    if len(password) < 8:
        raise SystemExit("비밀번호는 8자 이상이어야 해요")
    return password


def cmd_hash_password() -> None:
    from app.auth import hash_password

    hashed = hash_password(_read_password())
    print(hashed)
    print(
        f"\n.env 에 작은따옴표로 감싸서 넣으세요:\nAPP_PASSWORD_HASH='{hashed}'",
        file=sys.stderr,
    )


def seed_demo(db: Session) -> dict[str, int]:
    """비어 있는 DB에만 데모 데이터(프로젝트 3, 태그 3, 할일 14)를 넣는다."""
    if db.scalar(select(func.count(Project.id))):
        return {"projects": 0, "tags": 0, "tasks": 0}

    now = timeutil.now()
    today = now.date()
    stamp = now.isoformat()

    def day(offset: int) -> str:
        return (today + timedelta(days=offset)).isoformat()

    def project(name: str, color: str, order: int) -> Project:
        return Project(
            name=name, color=color, sort_order=order, archived=False,
            created_at=stamp, updated_at=stamp,
        )  # fmt: skip

    work = project("회사", "#F23D52", 0)
    side = project("사이드 프로젝트", "#5157E6", 1)
    personal = project("개인", "#3DD68C", 2)
    tag_work = Tag(name="업무", color="#2FB4E0", created_at=stamp)
    tag_personal = Tag(name="개인", color="#3DD68C", created_at=stamp)
    tag_important = Tag(name="중요", color="#F23D52", created_at=stamp)

    # (프로젝트, 제목, 마감일 오프셋, 시간, 우선순위, 태그, 반복)
    specs = [
        (work, "세금 계산서 발행", -3, None, 3, [tag_work, tag_important], None),
        (personal, "병원 예약", -1, None, 2, [], None),
        (work, "주간 보고서 작성", 0, "23:30", 3, [tag_work], "weekly"),
        (side, "API 설계 문서", 0, None, 2, [], None),
        (personal, "장보기", 0, None, 0, [tag_personal], None),
        (side, "로그인 화면 구현", 1, None, 2, [], None),
        (work, "회의 자료 준비", 1, "14:00", 1, [tag_work], None),
        (side, "DB 스키마 검토", 2, None, 1, [], None),
        (personal, "월세 이체", 4, None, 3, [tag_important], "monthly"),
        (side, "배포 스크립트 정리", 10, None, 1, [], None),
        (work, "분기 목표 정리", 20, None, 2, [tag_work], None),
        (personal, "여행 계획 세우기", None, None, 0, [], None),
        (side, "아이디어 메모 정리", None, None, 1, [], None),
    ]
    tasks = []
    for proj, title, offset, due_time, priority, tag_list, repeat in specs:
        due = day(offset) if offset is not None else None
        task = Task(
            project=proj, title=title, memo="", due_date=due, due_time=due_time,
            priority=priority, repeat_interval=1, created_at=stamp, updated_at=stamp,
        )  # fmt: skip
        task.tags = tag_list
        if repeat and due:
            task.repeat_freq = repeat
            task.repeat_anchor_day = int(due[-2:])
            if repeat == "weekly":
                task.repeat_weekdays = str(today.weekday())
        tasks.append(task)

    done = Task(
        project=side, title="개발 환경 설정", memo="", due_date=day(-2), priority=1,
        repeat_interval=1, completed_at=stamp, created_at=stamp, updated_at=stamp,
    )  # fmt: skip
    tasks.append(done)

    db.add_all([work, side, personal, tag_work, tag_personal, tag_important, *tasks])
    db.commit()
    return {"projects": 3, "tags": 3, "tasks": len(tasks)}


def cmd_seed() -> None:
    from app.config import get_settings
    from app.db import create_db_engine, run_migrations

    settings = get_settings()
    timeutil.configure(settings.tz)
    run_migrations(settings.database_path)
    engine = create_db_engine(settings.database_path)
    try:
        with Session(engine) as db:
            counts = seed_demo(db)
    finally:
        engine.dispose()
    if counts["projects"]:
        summary = f"프로젝트 {counts['projects']}, 태그 {counts['tags']}, 할일 {counts['tasks']}"
        print(f"seed 완료: {summary}")
    else:
        print("이미 데이터가 있어서 seed를 건너뛰었어요")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("hash-password", help="로그인 비밀번호의 argon2 해시를 출력")
    sub.add_parser("seed", help="빈 DB에 데모 데이터를 넣음 (개발·테스트용)")
    args = parser.parse_args(argv)

    if args.command == "hash-password":
        cmd_hash_password()
    elif args.command == "seed":
        cmd_seed()


if __name__ == "__main__":
    main()
