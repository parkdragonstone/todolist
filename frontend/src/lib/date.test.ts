import { describe, expect, it } from 'vitest'

import {
  dueLabel,
  formatDayTitle,
  formatHeaderDate,
  formatMonthTitle,
  monthGrid,
  monthGridRange,
  quickDueDates,
  shiftMonth,
  toISODate,
} from './date'

// 2026-09-16 (수) 10:00 로컬
const WED_10AM = new Date(2026, 8, 16, 10, 0)

describe('dueLabel', () => {
  it('returns null without a due date', () => {
    expect(dueLabel(null, null, WED_10AM)).toBeNull()
  })

  it('marks past dates as overdue with D+N', () => {
    expect(dueLabel('2026-09-14', null, WED_10AM)).toEqual({ text: 'D+2', tone: 'overdue' })
  })

  it('marks today with a passed time as overdue', () => {
    expect(dueLabel('2026-09-16', '09:00', WED_10AM)).toEqual({ text: '오늘 09:00', tone: 'overdue' })
  })

  it('shows today with and without time', () => {
    expect(dueLabel('2026-09-16', '17:00', WED_10AM)).toEqual({ text: '오늘 17:00', tone: 'today' })
    expect(dueLabel('2026-09-16', null, WED_10AM)).toEqual({ text: '오늘', tone: 'today' })
  })

  it('shows tomorrow as soon', () => {
    expect(dueLabel('2026-09-17', null, WED_10AM)).toEqual({ text: '내일', tone: 'soon' })
  })

  it('shows D-N with weekday for later dates', () => {
    expect(dueLabel('2026-09-19', null, WED_10AM)).toEqual({ text: 'D-3 · 9/19(토)', tone: 'normal' })
  })
})

describe('monthGrid', () => {
  it('has 42 cells starting on Monday', () => {
    const cells = monthGrid(new Date(2026, 8, 1))
    expect(cells).toHaveLength(42)
    expect(cells[0].getDay()).toBe(1)
    expect(toISODate(cells[0])).toBe('2026-08-31')
  })

  it('returns the grid range for the calendar API', () => {
    expect(monthGridRange(new Date(2026, 8, 20))).toEqual({ from: '2026-08-31', to: '2026-10-11' })
  })

  it('starts on the 1st when the month begins on Monday', () => {
    expect(toISODate(monthGrid(new Date(2026, 5, 10))[0])).toBe('2026-06-01')
  })
})

describe('helpers', () => {
  it('builds quick due dates', () => {
    expect(quickDueDates(WED_10AM)).toEqual({
      today: '2026-09-16',
      tomorrow: '2026-09-17',
      nextMonday: '2026-09-21',
    })
    expect(quickDueDates(new Date(2026, 8, 20)).nextMonday).toBe('2026-09-21')
  })

  it('shifts months across a year boundary', () => {
    expect(toISODate(shiftMonth(new Date(2026, 11, 15), 1))).toBe('2027-01-01')
  })

  it('formats Korean titles', () => {
    expect(formatHeaderDate(WED_10AM)).toBe('9월 16일 수요일')
    expect(formatMonthTitle(WED_10AM)).toBe('2026년 9월')
    expect(formatDayTitle(WED_10AM)).toBe('9월 16일 (수)')
  })
})
