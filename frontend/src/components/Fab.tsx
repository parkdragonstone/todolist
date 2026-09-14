// Design Ref: §5.3 Fab, §5.2 시트 상태 — 할일·프로젝트 상세·달력 화면의 + 버튼.
// 현재 문맥(프로젝트 id, 달력 선택일 ?date=)을 유지한 채 ?new=1 을 붙여 TaskSheet를 연다.
import { Plus } from 'lucide-react'
import { useLocation, useMatch } from 'react-router'

import { useSheetParams } from '@/hooks/useSheetParams'

export function Fab() {
  const location = useLocation()
  const projectMatch = useMatch('/projects/:projectId')
  const { openSheet } = useSheetParams()

  const visible = location.pathname === '/' || location.pathname === '/calendar' || projectMatch !== null
  if (!visible) return null

  const openNewTask = () => {
    const projectId = projectMatch?.params.projectId
    openSheet(projectId ? { new: '1', project: projectId } : { new: '1' })
  }

  return (
    <button
      type="button"
      aria-label="할일 추가"
      onClick={openNewTask}
      className="fixed z-40 grid size-[var(--fab-size)] place-items-center rounded-full bg-primary text-ink shadow-lg shadow-primary/30 transition-transform active:scale-95 active:bg-primary-press"
      style={{
        right: 'max(20px, calc((100vw - var(--content-max)) / 2 + 20px))',
        bottom: 'calc(var(--tabbar-height) + var(--safe-bottom) + 16px)',
      }}
    >
      <Plus size={28} strokeWidth={2.5} aria-hidden />
    </button>
  )
}
