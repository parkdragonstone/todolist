// Design Ref: §5.3 PriorityFlag — 우선순위 색 깃발 (없음이면 렌더링하지 않음)
import { Flag } from 'lucide-react'

import type { Priority } from '@/api/types'
import { PRIORITY_LABELS } from '@/lib/colors'

const COLOR_CLASS: Record<Exclude<Priority, 0>, string> = {
  1: 'text-prio-low',
  2: 'text-prio-mid',
  3: 'text-prio-high',
}

export function PriorityFlag({ priority }: { priority: Priority }) {
  if (priority === 0) return null
  return (
    <Flag
      size={14}
      role="img"
      aria-label={`우선순위 ${PRIORITY_LABELS[priority]}`}
      className={`${COLOR_CLASS[priority]} fill-current`}
    />
  )
}
