// Design Ref: §5.3 EmptyState — 빈 목록 안내
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 grid size-16 place-items-center rounded-full bg-surface text-ink-sub">
          <Icon size={28} aria-hidden />
        </div>
      )}
      <p className="text-section font-semibold">{title}</p>
      {description && <p className="mt-2 text-body text-ink-sub">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
