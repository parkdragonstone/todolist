// Design Ref: §5.4 Calendar Grid — 7×6(일요일 시작). 일요일·공휴일 날짜는 빨강(primary), 토요일은 청록(toggle),
// 이번 달 외는 흐리게, 오늘은 primary 테두리, 선택일은 indigo, 지난 할일이 있는 날은 연한 빨간 원,
// 프로젝트 색 점 최대 3개 + "+N"
import type { CalendarDay } from '@/api/types'
import {
  CALENDAR_WEEKDAY_LABELS,
  formatDayTitle,
  formatMonthTitle,
  inMonth,
  monthGrid,
  toISODate,
} from '@/lib/date'

interface CalendarMonthProps {
  month: Date
  days: Record<string, CalendarDay>
  holidays: Record<string, string[]>
  selected: string
  today: string
  onSelect: (isoDate: string) => void
}

const SUNDAY = 0
const SATURDAY = 6

/** 요일 줄: 일요일 빨강, 토요일 청록 */
const WEEKDAY_CLASS = ['text-primary', '', '', '', '', '', 'text-toggle']

function dayColorClass(dayOfWeek: number, isHoliday: boolean): string {
  if (isHoliday || dayOfWeek === SUNDAY) return 'text-primary'
  if (dayOfWeek === SATURDAY) return 'text-toggle'
  return 'text-ink'
}

export function CalendarMonth({ month, days, holidays, selected, today, onSelect }: CalendarMonthProps) {
  const cells = monthGrid(month)

  return (
    <div className="mt-4">
      <div aria-hidden className="grid grid-cols-7 text-center text-meta font-semibold text-ink-sub">
        {CALENDAR_WEEKDAY_LABELS.map((label, index) => (
          <span key={label} className={`py-2 ${WEEKDAY_CLASS[index]}`}>
            {label}
          </span>
        ))}
      </div>

      <div role="group" aria-label={formatMonthTitle(month)} className="grid grid-cols-7 gap-y-1">
        {cells.map((date) => {
          const iso = toISODate(date)
          const info = days[iso]
          const holidayNames = holidays[iso] ?? []
          const isHoliday = holidayNames.length > 0
          const isSelected = iso === selected
          const isToday = iso === today
          const outside = !inMonth(date, month)
          const hasOverdue = (info?.overdue ?? 0) > 0
          const extra = info ? Math.max(0, info.open - info.colors.length) : 0
          const total = info ? info.open + info.done : 0

          const numberClass = isSelected
            ? 'bg-indigo text-ink'
            : [
                dayColorClass(date.getDay(), isHoliday),
                isToday ? 'border-2 border-primary' : '',
                hasOverdue ? 'bg-primary/15' : '',
                outside ? 'opacity-40' : '',
              ].join(' ')

          const label = [
            formatDayTitle(date),
            isHoliday ? holidayNames.join(', ') : '',
            total > 0 ? `할일 ${total}개` : '',
          ]
            .filter(Boolean)
            .join(', ')

          return (
            <button
              key={iso}
              type="button"
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={label}
              onClick={() => onSelect(iso)}
              className="flex min-h-14 flex-col items-center gap-1 rounded-button py-1 active:bg-surface"
            >
              <span className={`grid size-8 place-items-center rounded-full text-body font-semibold ${numberClass}`}>
                {date.getDate()}
              </span>
              <span aria-hidden className="flex h-2 items-center gap-0.5">
                {info?.colors.map((color) => (
                  <span key={color} className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
                ))}
                {extra > 0 && <span className="text-[9px] leading-none text-ink-sub">+{extra}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
