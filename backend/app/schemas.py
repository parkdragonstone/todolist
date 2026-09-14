# Design Ref: §3.1, §4 — 요청 검증 스키마와 응답 직렬화
import re
from datetime import date
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field, StringConstraints, model_validator

from app.models import Project, Tag, Task
from app.services.recurrence import parse_weekdays

HEX_COLOR = r"^#[0-9A-Fa-f]{6}$"
_TIME_RE = re.compile(r"([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?")


def _check_date(value: str) -> str:
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise ValueError("YYYY-MM-DD 형식이어야 해요") from exc


def _check_time(value: str) -> str:
    if not _TIME_RE.fullmatch(value):
        raise ValueError("HH:MM 형식이어야 해요")
    return value[:5]


IsoDate = Annotated[str, AfterValidator(_check_date)]
HHMM = Annotated[str, AfterValidator(_check_time)]
Color = Annotated[str, Field(pattern=HEX_COLOR)]
ProjectName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
TagName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]
TaskTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Priority = Annotated[int, Field(ge=0, le=3)]
Weekday = Annotated[int, Field(ge=0, le=6)]
RepeatFreq = Literal["daily", "weekly", "monthly", "yearly"]


# ── 요청 ────────────────────────────────────────────────────────────────────
class LoginIn(BaseModel):
    password: str = Field(min_length=1, max_length=200)


class ProjectIn(BaseModel):
    name: ProjectName
    color: Color = "#F23D52"


class ProjectPatch(BaseModel):
    name: ProjectName | None = None
    color: Color | None = None
    archived: bool | None = None


class ProjectOrderIn(BaseModel):
    ids: list[int]


class TagIn(BaseModel):
    name: TagName
    color: Color = "#2FB4E0"


class TagPatch(BaseModel):
    name: TagName | None = None
    color: Color | None = None


class RepeatIn(BaseModel):
    freq: RepeatFreq
    interval: int = Field(1, ge=1, le=99)
    weekdays: list[Weekday] | None = None

    @model_validator(mode="after")
    def _check_weekdays(self):
        if self.weekdays:
            if self.freq != "weekly":
                raise ValueError("요일은 매주 반복에서만 지정할 수 있어요")
            if len(set(self.weekdays)) != len(self.weekdays):
                raise ValueError("요일이 중복됐어요")
            self.weekdays = sorted(self.weekdays)
        else:
            self.weekdays = None
        return self


class TaskIn(BaseModel):
    project_id: int
    title: TaskTitle
    memo: str = Field("", max_length=5000)
    due_date: IsoDate | None = None
    due_time: HHMM | None = None
    priority: Priority = 0
    tag_ids: list[int] = Field(default_factory=list)
    repeat: RepeatIn | None = None


class TaskPatch(BaseModel):
    project_id: int | None = None
    title: TaskTitle | None = None
    memo: str | None = Field(None, max_length=5000)
    due_date: IsoDate | None = None
    due_time: HHMM | None = None
    priority: Priority | None = None
    tag_ids: list[int] | None = None
    repeat: RepeatIn | None = None

    @model_validator(mode="after")
    def _reject_null_for_required(self):
        for name in ("project_id", "title", "memo", "priority", "tag_ids"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} 값은 비울 수 없어요")
        return self


# ── export / import ────────────────────────────────────────────────────────
class ExportProject(BaseModel):
    id: int
    name: str
    color: str
    sort_order: int
    archived: bool
    created_at: str
    updated_at: str


class ExportTag(BaseModel):
    id: int
    name: str
    color: str
    created_at: str


class ExportTask(BaseModel):
    id: int
    project_id: int
    title: str
    memo: str = ""
    due_date: str | None = None
    due_time: str | None = None
    priority: int = 0
    repeat_freq: str | None = None
    repeat_interval: int = 1
    repeat_weekdays: str | None = None
    repeat_anchor_day: int | None = None
    completed_at: str | None = None
    spawned_task_id: int | None = None
    created_at: str
    updated_at: str
    tag_ids: list[int] = Field(default_factory=list)


class ImportFile(BaseModel):
    format: Literal["todolist-export"]
    version: Literal[1]
    exported_at: str | None = None
    projects: list[ExportProject]
    tags: list[ExportTag]
    tasks: list[ExportTask]


# ── 응답 직렬화 ─────────────────────────────────────────────────────────────
def project_out(project: Project, open_count: int = 0, overdue_count: int = 0) -> dict:
    return {
        "id": project.id,
        "name": project.name,
        "color": project.color,
        "sort_order": project.sort_order,
        "archived": bool(project.archived),
        "open_count": open_count,
        "overdue_count": overdue_count,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
    }


def tag_brief(tag: Tag) -> dict:
    return {"id": tag.id, "name": tag.name, "color": tag.color}


def tag_out(tag: Tag, task_count: int = 0) -> dict:
    return {**tag_brief(tag), "task_count": task_count}


def repeat_out(task: Task) -> dict | None:
    if not task.repeat_freq:
        return None
    return {
        "freq": task.repeat_freq,
        "interval": task.repeat_interval,
        "weekdays": parse_weekdays(task.repeat_weekdays),
        "anchor_day": task.repeat_anchor_day,
    }


def task_out(task: Task) -> dict:
    return {
        "id": task.id,
        "project_id": task.project_id,
        "project_name": task.project.name,
        "project_color": task.project.color,
        "title": task.title,
        "memo": task.memo,
        "due_date": task.due_date,
        "due_time": task.due_time,
        "priority": task.priority,
        "tags": [tag_brief(tag) for tag in task.tags],
        "repeat": repeat_out(task),
        "completed_at": task.completed_at,
        "spawned_task_id": task.spawned_task_id,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }
