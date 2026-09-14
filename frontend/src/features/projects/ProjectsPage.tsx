// Design Ref: §5.4 Projects — 카드 목록(색 바, 미완료·지남), 순서 편집(↑↓), 새 프로젝트 시트
import { ChevronDown, ChevronRight, ChevronUp, FolderKanban, Plus } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'

import { useProjects, useReorderProjects } from '@/api/queries'
import type { Project } from '@/api/types'
import { EmptyState } from '@/components/EmptyState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { useToast } from '@/components/Toast'
import { useSheetParams } from '@/hooks/useSheetParams'
import { moveItem } from '@/lib/task'

import { ProjectSheet } from './ProjectSheet'

function MoveButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full bg-surface-2 text-ink active:bg-line disabled:opacity-30"
    >
      {children}
    </button>
  )
}

export function ProjectsPage() {
  const projects = useProjects()
  const reorder = useReorderProjects()
  const { showToast } = useToast()
  const { openSheet } = useSheetParams()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Project[]>([])

  const list = editing ? draft : (projects.data ?? [])
  const openNewProject = () => openSheet({ 'project-edit': 'new' })

  const startEditing = () => {
    setDraft(projects.data ?? [])
    setEditing(true)
  }

  const finishEditing = () => {
    const ids = draft.map((p) => p.id)
    const unchanged = ids.join(',') === (projects.data ?? []).map((p) => p.id).join(',')
    if (unchanged) {
      setEditing(false)
      return
    }
    reorder.mutate(ids, {
      onSuccess: () => setEditing(false),
      onError: () => showToast({ message: '순서를 저장하지 못했어요', tone: 'error' }),
    })
  }

  return (
    <section className="screen-x">
      <header className="flex items-center justify-between">
        <h1 className="text-title font-bold">프로젝트</h1>
        {(projects.data?.length ?? 0) > 1 && (
          <button
            type="button"
            onClick={editing ? finishEditing : startEditing}
            disabled={reorder.isPending}
            className="-mr-2 min-h-11 px-2 text-body font-semibold text-toggle"
          >
            {editing ? (reorder.isPending ? '저장 중…' : '완료') : '순서 편집'}
          </button>
        )}
      </header>

      {projects.isPending && <ListSkeleton />}
      {projects.isError && <p className="mt-6 text-body text-primary">프로젝트를 불러오지 못했어요</p>}

      {projects.data?.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          title="첫 프로젝트를 만들어보세요"
          description="프로젝트별로 할일을 모아서 관리할 수 있어요"
          action={
            <button
              type="button"
              onClick={openNewProject}
              className="min-h-12 rounded-button bg-primary px-6 text-body font-semibold text-ink active:bg-primary-press"
            >
              프로젝트 만들기
            </button>
          }
        />
      )}

      {list.length > 0 && (
        <ul className="mt-5 flex flex-col gap-2">
          {list.map((project, index) => (
            <li key={project.id} className="flex items-stretch overflow-hidden rounded-card bg-surface">
              <span aria-hidden className="w-1.5 shrink-0" style={{ backgroundColor: project.color }} />
              {editing ? (
                <div className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3 pl-4">
                  <span className="min-w-0 flex-1 truncate text-body font-semibold">{project.name}</span>
                  <MoveButton label={`${project.name} 위로`} disabled={index === 0} onClick={() => setDraft((d) => moveItem(d, index, -1))}>
                    <ChevronUp size={20} aria-hidden />
                  </MoveButton>
                  <MoveButton
                    label={`${project.name} 아래로`}
                    disabled={index === list.length - 1}
                    onClick={() => setDraft((d) => moveItem(d, index, 1))}
                  >
                    <ChevronDown size={20} aria-hidden />
                  </MoveButton>
                </div>
              ) : (
                <Link to={`/projects/${project.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-4 pr-3 pl-4 active:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-semibold">{project.name}</p>
                    <p className="mt-1 text-meta text-ink-sub">
                      미완료 {project.open_count} ·{' '}
                      <span className={project.overdue_count > 0 ? 'text-primary' : ''}>지남 {project.overdue_count}</span>
                    </p>
                  </div>
                  <ChevronRight size={20} aria-hidden className="shrink-0 text-ink-dim" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {!editing && (projects.data?.length ?? 0) > 0 && (
        <button
          type="button"
          onClick={openNewProject}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-card border border-dashed border-line text-body font-semibold text-ink-sub active:bg-surface"
        >
          <Plus size={18} aria-hidden />새 프로젝트
        </button>
      )}

      <ProjectSheet />
    </section>
  )
}
