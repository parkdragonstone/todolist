# Design Ref: §3.4 — 모든 날짜·시각은 설정된 타임존(기본 Asia/Seoul) 로컬 기준
from collections.abc import Callable
from datetime import date, datetime
from zoneinfo import ZoneInfo

_zone = ZoneInfo("Asia/Seoul")
_clock: Callable[[], datetime] | None = None


def configure(tz_name: str) -> None:
    global _zone
    _zone = ZoneInfo(tz_name)


def set_clock(clock: Callable[[], datetime] | None) -> None:
    """테스트에서 현재 시각을 고정할 때 사용한다."""
    global _clock
    _clock = clock


def zone() -> ZoneInfo:
    return _zone


def now() -> datetime:
    current = _clock() if _clock else datetime.now(_zone)
    return current.astimezone(_zone).replace(microsecond=0)


def today() -> date:
    return now().date()


def now_iso() -> str:
    return now().isoformat()
