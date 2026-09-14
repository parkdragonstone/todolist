from datetime import date

from app.services.holidays import korean_holidays


def test_lunar_and_substitute_holidays_2026():
    result = korean_holidays(date(2026, 9, 20), date(2026, 10, 10))
    assert result["2026-09-25"] == ["추석"]
    assert "2026-09-24" in result and "2026-09-26" in result
    assert result["2026-10-03"] == ["개천절"]
    assert result["2026-10-05"] == ["개천절 대체 휴일"]
    assert result["2026-10-09"] == ["한글날"]
    assert "2026-10-04" not in result
    assert list(result) == sorted(result)


def test_range_across_year_boundary():
    result = korean_holidays(date(2026, 12, 20), date(2027, 1, 5))
    assert "2026-12-25" in result
    assert "2027-01-01" in result
    assert all("2026-12-20" <= day <= "2027-01-05" for day in result)


def test_range_without_holidays():
    assert korean_holidays(date(2026, 11, 2), date(2026, 11, 6)) == {}
