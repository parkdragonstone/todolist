// Design Ref: §5.3 AppShell — 인증 가드, Outlet, Fab, TabBar, TaskSheet 호스트
import { Check, WifiOff } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { useMe } from '@/api/queries'
import { TaskSheetHost } from '@/features/tasks/TaskSheet'

import { Fab } from './Fab'
import { TabBar } from './TabBar'

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="불러오는 중">
      <div className="grid size-16 animate-pulse place-items-center rounded-full bg-primary">
        <Check size={32} strokeWidth={3} className="text-ink" aria-hidden />
      </div>
    </div>
  )
}

function ConnectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="screen-x grid min-h-dvh place-items-center text-center">
      <div>
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-surface text-ink-sub">
          <WifiOff size={28} aria-hidden />
        </div>
        <p className="text-section font-semibold">서버에 연결할 수 없어요</p>
        <p className="mt-2 text-body text-ink-sub">네트워크 상태를 확인한 뒤 다시 시도해주세요</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 min-h-12 rounded-button bg-surface-2 px-6 text-body font-semibold active:bg-line"
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}

export function AppShell() {
  const me = useMe()
  const location = useLocation()

  if (me.isPending) return <Splash />
  if (me.isError) return <ConnectionError onRetry={() => void me.refetch()} />
  if (!me.data) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[var(--content-max)]">
      <main className="pt-safe pb-tabbar">
        <Outlet />
      </main>
      <Fab />
      <TabBar />
      <TaskSheetHost />
    </div>
  )
}
