// Design Ref: §5.3 DueChip, §5.4 Calendar, §3.4.2 — 날짜 표시용 순수 함수 (React·fetch 비의존)
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ko } from 'date-fns/locale'

/** 주 시작 = 월요일 (백엔드 due_groups 규칙과 동일) */
export const WEEK_STARTS_ON = 1
export const CALENDAR_CELLS = 42

export type DueTone = 'overdue' | 'today' | 'soon' | 'normal'

export interface DueLabel {
  text: string
  tone: DueTone
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function parseISODate(value: string): Date {
  return parseISO(value)
}

/** D-day 라벨: 지남은 D+N(또는 오늘 HH:MM), 오늘/내일은 시간 포함, 그 외 D-N · M/d(요일) */
export function dueLabel(dueDate: string | null, dueTime: string | null, now: Date): DueLabel | null {
  if (!dueDate) return null
  const diff = differenceInCalendarDays(parseISO(dueDate), startOfDay(now))
  const timeSuffix = dueTime ? ` ${dueTime}` : ''

  if (diff < 0) return { text: `D+${-diff}`, tone: 'overdue' }
  if (diff === 0) {
    const passed = dueTime !== null && dueTime < format(now, 'HH:mm')
    return { text: `오늘${timeSuffix}`, tone: passed ? 'overdue' : 'today' }
  }
  if (diff === 1) return { text: `내일${timeSuffix}`, tone: 'soon' }
  return { text: `D-${diff} · ${format(parseISO(dueDate), 'M/d(EEE)', { locale: ko })}`, tone: 'normal' }
}

/** 월간 달력 7×6 그리드 (월요일 시작) */
export function monthGrid(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: WEEK_STARTS_ON })
  return Array.from({ length: CALENDAR_CELLS }, (_, i) => addDays(start, i))
}

export function monthGridRange(month: Date): { from: string; to: string } {
  const cells = monthGrid(month)
  return { from: toISODate(cells[0]), to: toISODate(cells[cells.length - 1]) }
}

export function shiftMonth(month: Date, delta: number): Date {
  return startOfMonth(addMonths(month, delta))
}

export function inMonth(date: Date, month: Date): boolean {
  return isSameMonth(date, month)
}

/** 빠른 마감 선택 칩: 오늘 / 내일 / 다음 주 월요일 */
export function quickDueDates(now: Date): { today: string; tomorrow: string; nextMonday: string } {
  const nextMonday = addDays(startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }), 7)
  return {
    today: toISODate(now),
    tomorrow: toISODate(addDays(now, 1)),
    nextMonday: toISODate(nextMonday),
  }
}

export const formatHeaderDate = (date: Date) => format(date, 'M월 d일 EEEE', { locale: ko })
export const formatMonthTitle = (date: Date) => format(date, 'yyyy년 M월')
export const formatDayTitle = (date: Date) => format(date, 'M월 d일 (EEE)', { locale: ko })
export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const
