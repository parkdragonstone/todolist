// Design Ref: §5.4 Calendar — 월 이동(버튼·좌우 스와이프), 선택일(?date=) 목록, FAB는 선택일을 마감으로 새 할일
import { CalendarDays, ChevronLeft, ChevronRight, PartyPopper } from 'lucide-react'
import { type ReactNode, type TouchEvent, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import { useCalendar } from '@/api/queries'
import { EmptyState } from '@/components/EmptyState'
import { SectionHeader } from '@/components/SectionHeader'
import { TaskItem } from '@/components/TaskItem'
import { useNow } from '@/hooks/useNow'
import { useTaskToggle } from '@/hooks/useTaskToggle'
import { formatDayTitle, formatMonthTitle, inMonth, monthGridRange, parseISODate, shiftMonth, toISODate } from '@/lib/date'

import { CalendarMonth } from './CalendarMonth'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const SWIPE_MIN_PX = 50

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full text-ink-sub active:bg-surface"
    >
      {children}
    </button>
  )
}

export function CalendarPage() {
  const now = useNow()
  const toggle = useTaskToggle()
  const [searchParams, setSearchParams] = useSearchParams()
  const today = toISODate(now)
  const dateParam = searchParams.get('date')
  const selected = dateParam && ISO_DATE.test(dateParam) ? dateParam : today

  const [month, setMonth] = useState(() => shiftMonth(parseISODate(selected), 0))
  const range = monthGridRange(month)
  const calendar = useCalendar(range.from, range.to)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  const selectDate = (isoDate: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('date', isoDate)
        return next
      },
      { replace: true },
    )
    const date = parseISODate(isoDate)
    if (!inMonth(date, month)) setMonth(shiftMonth(date, 0))
  }

  const goToday = () => {
    setMonth(shiftMonth(now, 0))
    selectDate(today)
  }

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    swipeStart.current = { x: touch.clientX, y: touch.clientY }
  }

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      setMonth((current) => shiftMonth(current, dx < 0 ? 1 : -1))
    }
  }

  const day = calendar.data?.days[selected]
  const dayHolidays = calendar.data?.holidays?.[selected] ?? []
  // 미완료를 먼저, 완료(취소선)는 뒤에
  const dayTasks = [...(day?.tasks ?? [])].sort((a, b) => Number(!!a.completed_at) - Number(!!b.completed_at))

  return (
    <section className="screen-x">
      <header className="flex items-center justify-between">
        <h1 className="text-title font-bold" aria-live="polite">
          {formatMonthTitle(month)}
        </h1>
        <div className="-mr-2 flex items-center">
          <NavButton label="이전 달" onClick={() => setMonth((current) => shiftMonth(current, -1))}>
            <ChevronLeft size={24} aria-hidden />
          </NavButton>
          <button
            type="button"
            onClick={goToday}
            className="min-h-11 rounded-button px-3 text-body font-semibold text-toggle active:bg-surface"
          >
            오늘
          </button>
          <NavButton label="다음 달" onClick={() => setMonth((current) => shiftMonth(current, 1))}>
            <ChevronRight size={24} aria-hidden />
          </NavButton>
        </div>
      </header>

      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`touch-pan-y transition-opacity ${calendar.isPlaceholderData ? 'opacity-60' : ''}`}
      >
        <CalendarMonth
          month={month}
          days={calendar.data?.days ?? {}}
          holidays={calendar.data?.holidays ?? {}}
          selected={selected}
          today={today}
          onSelect={selectDate}
        />
      </div>

      <SectionHeader title={formatDayTitle(parseISODate(selected))} count={dayTasks.length} />
      {calendar.isError && <p className="text-body text-primary">일정을 불러오지 못했어요</p>}
      {dayHolidays.length > 0 && (
        <ul aria-label="공휴일" className="mb-2 flex flex-col gap-2">
          {dayHolidays.map((name) => (
            <li
              key={name}
              className="flex min-h-12 items-center gap-2 rounded-card bg-primary/10 px-4 text-body font-semibold text-primary"
            >
              <PartyPopper size={18} aria-hidden />
              {name}
            </li>
          ))}
        </ul>
      )}
      {dayTasks.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {dayTasks.map((task) => (
            <TaskItem key={task.id} task={task} now={now} onToggle={toggle} />
          ))}
        </ul>
      ) : (
        !calendar.isPending &&
        (dayHolidays.length > 0 ? (
          <p className="px-1 py-2 text-body text-ink-sub">등록된 할일은 없어요</p>
        ) : (
          <EmptyState icon={CalendarDays} title="이 날은 일정이 없어요" />
        ))
      )}
    </section>
  )
}
