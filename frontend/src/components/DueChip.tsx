// Design Ref: §5.3 DueChip — D-3 / 오늘 17:00 / 내일 / D+2(지남, primary)
import { dueLabel, type DueTone } from '@/lib/date'

const TONE_CLASS: Record<DueTone, string> = {
  overdue: 'bg-primary/15 text-primary',
  today: 'bg-toggle/15 text-toggle',
  soon: 'bg-surface-2 text-ink',
  normal: 'text-ink-sub',
}

interface DueChipProps {
  dueDate: string | null
  dueTime: string | null
  now: Date
  done?: boolean
}

export function DueChip({ dueDate, dueTime, now, done = false }: DueChipProps) {
  const label = dueLabel(dueDate, dueTime, now)
  if (!label) return null
  const tone = done ? 'text-ink-dim' : TONE_CLASS[label.tone]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-meta font-semibold ${tone}`}>
      {label.text}
    </span>
  )
}
