// Design Ref: §5.4 TaskSheet/반복 — [안 함|매일|매주|매월|매년], 간격 스테퍼(1..99), 매주 요일 칩, 날짜 없으면 비활성
import { Minus, Plus } from 'lucide-react'

import type { RepeatFreq, RepeatInput } from '@/api/types'
import { Segmented } from '@/components/Segmented'
import { WEEKDAY_LABELS } from '@/lib/date'
import { REPEAT_FREQ_LABELS, repeatLabel, toggleId } from '@/lib/task'

type FreqOption = RepeatFreq | 'none'

const FREQ_OPTIONS: ReadonlyArray<{ value: FreqOption; label: string }> = [
  { value: 'none', label: '안 함' },
  ...(Object.entries(REPEAT_FREQ_LABELS) as Array<[RepeatFreq, string]>).map(([value, label]) => ({
    value,
    label,
  })),
]
const MAX_INTERVAL = 99

interface RepeatPickerProps {
  value: RepeatInput | null
  onChange: (value: RepeatInput | null) => void
  disabled?: boolean
  /** 매주를 처음 고를 때 기본으로 켤 요일 (마감일의 요일, 월=0) */
  defaultWeekday?: number
}

export function RepeatPicker({ value, onChange, disabled = false, defaultWeekday }: RepeatPickerProps) {
  const interval = value?.interval ?? 1

  const changeFreq = (freq: FreqOption) => {
    if (freq === 'none') {
      onChange(null)
      return
    }
    const fallbackWeekdays = defaultWeekday !== undefined ? [defaultWeekday] : null
    const weekdays = freq === 'weekly' ? (value?.weekdays ?? fallbackWeekdays) : null
    onChange({ freq, interval, weekdays })
  }

  const changeInterval = (next: number) => {
    if (!value) return
    onChange({ ...value, interval: Math.min(MAX_INTERVAL, Math.max(1, next)) })
  }

  const toggleWeekday = (day: number) => {
    if (!value) return
    const next = toggleId(value.weekdays ?? [], day).sort((a, b) => a - b)
    onChange({ ...value, weekdays: next.length > 0 ? next : null })
  }

  return (
    <div>
      <Segmented
        label="반복 주기"
        value={value?.freq ?? 'none'}
        options={FREQ_OPTIONS}
        onChange={changeFreq}
        disabled={disabled}
      />
      {disabled && <p className="mt-2 text-meta text-ink-dim">반복하려면 먼저 마감 날짜를 정해주세요</p>}

      {value && !disabled && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-card bg-surface-2 py-1.5 pr-1.5 pl-4">
            <span className="text-body text-ink">{repeatLabel(value)}</span>
            <div role="group" aria-label="반복 간격" className="flex items-center">
              <button
                type="button"
                aria-label="간격 줄이기"
                disabled={interval <= 1}
                onClick={() => changeInterval(interval - 1)}
                className="grid size-10 place-items-center rounded-full text-ink active:bg-surface disabled:opacity-30"
              >
                <Minus size={18} aria-hidden />
              </button>
              <span className="w-8 text-center text-body font-semibold" aria-live="polite">
                {interval}
              </span>
              <button
                type="button"
                aria-label="간격 늘리기"
                disabled={interval >= MAX_INTERVAL}
                onClick={() => changeInterval(interval + 1)}
                className="grid size-10 place-items-center rounded-full text-ink active:bg-surface disabled:opacity-30"
              >
                <Plus size={18} aria-hidden />
              </button>
            </div>
          </div>

          {value.freq === 'weekly' && (
            <div role="group" aria-label="반복 요일" className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_LABELS.map((label, day) => {
                const selected = value.weekdays?.includes(day) ?? false
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleWeekday(day)}
                    className={`min-h-10 rounded-button text-body font-semibold transition-colors ${
                      selected ? 'bg-toggle text-bg' : 'bg-surface-2 text-ink-sub'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
