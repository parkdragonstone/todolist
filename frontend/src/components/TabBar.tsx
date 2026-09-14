// Design Ref: §5.3 TabBar — 하단 4탭(할일/프로젝트/달력/설정), 활성 탭은 밝은 pill, safe-area 대응
import { CalendarDays, FolderKanban, ListChecks, type LucideIcon, Settings } from 'lucide-react'
import { NavLink } from 'react-router'

const TABS: ReadonlyArray<{ to: string; label: string; icon: LucideIcon; end?: boolean }> = [
  { to: '/', label: '할일', icon: ListChecks, end: true },
  { to: '/projects', label: '프로젝트', icon: FolderKanban },
  { to: '/calendar', label: '달력', icon: CalendarDays },
  { to: '/settings', label: '설정', icon: Settings },
]

export function TabBar() {
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-bg/95 backdrop-blur"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="mx-auto grid h-[var(--tabbar-height)] max-w-[var(--content-max)] grid-cols-4 px-2">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex">
            <NavLink to={to} end={end} className="flex flex-1 items-center justify-center">
              {({ isActive }) => (
                <span
                  className={`flex min-w-16 flex-col items-center gap-0.5 rounded-button px-3 py-1.5 transition-colors ${
                    isActive ? 'bg-surface-2 text-ink' : 'text-ink-dim'
                  }`}
                >
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                  <span className="text-[11px] font-medium">{label}</span>
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
