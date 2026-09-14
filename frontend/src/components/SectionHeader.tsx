// Design Ref: §5.3 SectionHeader — 그룹 제목 + 개수 (지남은 primary 색)
import type { ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  count?: number
  tone?: 'default' | 'danger'
  action?: ReactNode
}

export function SectionHeader({ title, count, tone = 'default', action }: SectionHeaderProps) {
  return (
    <div className="flex min-h-11 items-end justify-between pt-6 pb-2">
      <h2 className={`text-section font-bold ${tone === 'danger' ? 'text-primary' : 'text-ink'}`}>
        {title}
        {count !== undefined && <span className="ml-1.5 text-body font-semibold text-ink-sub">{count}</span>}
      </h2>
      {action}
    </div>
  )
}
