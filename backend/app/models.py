# Design Ref: §3.1~3.3 — ORM 매핑 (스키마 생성은 migrations/*.sql 이 담당)
from sqlalchemy import Column, ForeignKey, Table
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


task_tags = Table(
    "task_tags",
    Base.metadata,
    Column("task_id", ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    color: Mapped[str]
    sort_order: Mapped[int] = mapped_column(default=0)
    archived: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[str]
    updated_at: Mapped[str]

    tasks: Mapped[list["Task"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True
    )


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    color: Mapped[str]
    created_at: Mapped[str]


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    title: Mapped[str]
    memo: Mapped[str] = mapped_column(default="")
    due_date: Mapped[str | None]
    due_time: Mapped[str | None]
    priority: Mapped[int] = mapped_column(default=0)
    repeat_freq: Mapped[str | None]
    repeat_interval: Mapped[int] = mapped_column(default=1)
    repeat_weekdays: Mapped[str | None]
    repeat_anchor_day: Mapped[int | None]
    completed_at: Mapped[str | None]
    spawned_task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"))
    created_at: Mapped[str]
    updated_at: Mapped[str]

    project: Mapped[Project] = relationship(back_populates="tasks")
    tags: Mapped[list[Tag]] = relationship(secondary=task_tags, order_by=Tag.name, lazy="selectin")


class SessionRecord(Base):
    __tablename__ = "sessions"

    token_hash: Mapped[str] = mapped_column(primary_key=True)
    created_at: Mapped[str]
    expires_at: Mapped[str]
    last_seen_at: Mapped[str]
    user_agent: Mapped[str] = mapped_column(default="")
