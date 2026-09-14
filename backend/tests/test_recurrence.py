from datetime import date

import pytest

from app.services.recurrence import format_weekdays, next_due, parse_weekdays

EARLY = date(2000, 1, 1)


def test_monthly_end_of_month_keeps_anchor_day():
    february = next_due(date(2027, 1, 31), "monthly", anchor_day=31, today=EARLY)
    assert february == date(2027, 2, 28)
    assert next_due(february, "monthly", anchor_day=31, today=EARLY) == date(2027, 3, 31)


def test_monthly_leap_year_february():
    assert next_due(date(2028, 1, 31), "monthly", anchor_day=31) == date(2028, 2, 29)


def test_yearly_feb_29_falls_back_and_returns():
    assert next_due(date(2028, 2, 29), "yearly", anchor_day=29) == date(2029, 2, 28)
    assert next_due(date(2031, 2, 28), "yearly", anchor_day=29) == date(2032, 2, 29)


def test_monthly_with_interval_three():
    assert next_due(date(2026, 11, 15), "monthly", 3) == date(2027, 2, 15)


def test_weekly_weekdays_with_interval_two():
    # 2026-09-14 = 월요일
    assert next_due(date(2026, 9, 14), "weekly", 2, [0, 2, 4]) == date(2026, 9, 16)
    assert next_due(date(2026, 9, 18), "weekly", 2, [0, 2, 4]) == date(2026, 9, 28)


def test_weekly_without_weekdays():
    assert next_due(date(2026, 9, 16), "weekly", 1) == date(2026, 9, 23)


def test_daily_interval():
    assert next_due(date(2026, 9, 16), "daily", 3, today=date(2026, 9, 16)) == date(2026, 9, 19)


def test_daily_catches_up_to_today():
    assert next_due(date(2026, 9, 6), "daily", 1, today=date(2026, 9, 16)) == date(2026, 9, 16)


def test_weekly_catch_up_keeps_weekday():
    # 2026-08-03 = 월요일, 오늘(9/16 수) 이후 첫 월요일
    assert next_due(date(2026, 8, 3), "weekly", 1, [0], today=date(2026, 9, 16)) == date(
        2026, 9, 21
    )


def test_unknown_frequency_raises():
    with pytest.raises(ValueError):
        next_due(date(2026, 9, 16), "hourly")


def test_weekday_string_round_trip():
    assert format_weekdays([4, 0, 4]) == "0,4"
    assert format_weekdays([]) is None
    assert parse_weekdays("0,4") == [0, 4]
    assert parse_weekdays(None) is None
