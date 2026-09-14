# Design Ref: §4.2 GET /api/calendar — 한국 공휴일
# python-holidays 로 서버 안에서 계산한다 (음력 설날·추석, 대체공휴일 포함, API 키·외부 요청 없음).
# 임시공휴일(선거일 등)은 라이브러리 업데이트 시 반영된다.
from datetime import date
from functools import lru_cache

import holidays

COUNTRY = "KR"
NAME_SEPARATOR = "; "  # 같은 날짜에 공휴일이 여러 개면 python-holidays 가 이 구분자로 이어 붙인다


@lru_cache(maxsize=16)
def _holidays_for_year(year: int) -> dict[date, str]:
    return dict(holidays.country_holidays(COUNTRY, years=year, language="ko"))


def korean_holidays(start: date, end: date) -> dict[str, list[str]]:
    """start~end(포함) 사이의 공휴일을 {"YYYY-MM-DD": [이름, ...]} 형태로 반환한다."""
    result: dict[str, list[str]] = {}
    for year in range(start.year, end.year + 1):
        for day, names in _holidays_for_year(year).items():
            if start <= day <= end:
                result[day.isoformat()] = names.split(NAME_SEPARATOR)
    return dict(sorted(result.items()))
