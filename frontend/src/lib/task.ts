// Design Ref: §5.3·§5.4 — 할일·목록 표시용 순수 함수 (React 비의존)
import type { Priority, RepeatFreq, RepeatInput } from '@/api/types'

import { WEEKDAY_LABELS } from './date'

export const REPEAT_FREQ_LABELS: Record<RepeatFreq, string> = {
  daily: '매일',
  weekly: '매주',
  monthly: '매월',
  yearly: '매년',
}

const REPEAT_UNITS: Record<RepeatFreq, string> = {
  daily: '일',
  weekly: '주',
  monthly: '개월',
  yearly: '년',
}

export const PRIORITY_OPTIONS: ReadonlyArray<{ value: Priority; label: string }> = [
  { value: 0, label: '없음' },
  { value: 1, label: '낮음' },
  { value: 2, label: '보통' },
  { value: 3, label: '높음' },
]

/** "매주 · 금", "2주마다 · 월·수", "3개월마다", 반복 없음이면 "안 함" */
export function repeatLabel(repeat: RepeatInput | null | undefined): string {
  if (!repeat) return '안 함'
  const interval = repeat.interval ?? 1
  const base = interval === 1 ? REPEAT_FREQ_LABELS[repeat.freq] : `${interval}${REPEAT_UNITS[repeat.freq]}마다`
  if (repeat.freq === 'weekly' && repeat.weekdays && repeat.weekdays.length > 0) {
    return `${base} · ${repeat.weekdays.map((day) => WEEKDAY_LABELS[day]).join('·')}`
  }
  return base
}

/** 월요일=0 … 일요일=6 (백엔드 weekdays 규칙) */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

export function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]
}

export function moveItem<T>(items: readonly T[], index: number, delta: number): T[] {
  const target = index + delta
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items]
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
