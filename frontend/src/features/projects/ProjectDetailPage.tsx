// Design Ref: §5.4 Project Detail — 헤더(⋯ 메뉴: 수정/보관/삭제), 정렬(프로젝트별 기억), 우선순위·태그 필터, 완료 항목 보기
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  Ellipsis,
  Flag,
  FolderX,
  ListChecks,
  type LucideIcon,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { useDeleteProject, useProjects, useTags, useTasks, useUpdateProject } from '@/api/queries'
import type { TaskSort } from '@/api/types'
import { BottomSheet } from '@/components/BottomSheet'
import { ConfirmSheet } from '@/components/ConfirmSheet'
import { EmptyState } from '@/components/EmptyState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { SectionHeader } from '@/components/SectionHeader'
import { Segmented } from '@/components/Segmented'
import { Chip, TagChip } from '@/components/TagChip'
import { TaskItem } from '@/components/TaskItem'
import { useToast } from '@/components/Toast'
import { Toggle } from '@/components/Toggle'
import { useNow } from '@/hooks/useNow'
import { useSheetParams } from '@/hooks/useSheetParams'
import { useTaskToggle } from '@/hooks/useTaskToggle'
import { toggleId } from '@/lib/task'

import { ProjectSheet } from './ProjectSheet'

const SORT_OPTIONS: ReadonlyArray<{ value: TaskSort; label: string }> = [
  { value: 'due', label: '마감순' },
  { value: 'priority', label: '우선순위' },
  { value: 'created', label: '생성순' },
]

const sortStorageKey = (projectId: number) => `todo.sort.${projectId}`

function readSort(projectId: number): TaskSort {
  try {
    const stored = localStorage.getItem(sortStorageKey(projectId))
    return stored === 'priority' || stored === 'created' ? stored : 'due'
  } catch {
    return 'due'
  }
}

interface MenuButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

function MenuButton({ icon: Icon, label, onClick, danger = false, disabled = false }: MenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-13 w-full items-center gap-3 rounded-card bg-surface-2 px-4 text-left text-body font-semibold active:bg-line disabled:opacity-50 ${
        danger ? 'text-primary' : 'text-ink'
      }`}
    >
      <Icon size={20} aria-hidden />
      {label}
    </button>
  )
}

function BackLink() {
  return (
    <Link to="/projects" aria-label="프로젝트 목록으로" className="-ml-3 grid size-11 shrink-0 place-items-center text-ink-sub">
      <ChevronLeft size={26} aria-hidden />
    </Link>
  )
}

export function ProjectDetailPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const validId = Number.isInteger(projectId) && projectId > 0
  const navigate = useNavigate()
  const now = useNow()
  const toggle = useTaskToggle()
  const { openSheet } = useSheetParams()
  const { showToast } = useToast()

  const projects = useProjects(true)
  const tags = useTags()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()

  const [sortState, setSortState] = useState(() => ({ projectId, sort: readSort(projectId) }))
  if (sortState.projectId !== projectId) setSortState({ projectId, sort: readSort(projectId) })
  const [highOnly, setHighOnly] = useState(false)
  const [tagIds, setTagIds] = useState<number[]>([])
  const [showDone, setShowDone] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const filters = {
    project_id: projectId,
    priority: highOnly ? 3 : undefined,
    tag_id: tagIds.length > 0 ? tagIds : undefined,
  }
  const openTasks = useTasks({ ...filters, status: 'open', sort: sortState.sort }, validId)
  const doneTasks = useTasks({ ...filters, status: 'done' }, validId && showDone)
  const project = projects.data?.find((p) => p.id === projectId)

  if (!validId || (projects.isSuccess && !project)) {
    return (
      <section className="screen-x">
        <BackLink />
        <EmptyState
          icon={FolderX}
          title="프로젝트를 찾을 수 없어요"
          action={
            <Link to="/projects" className="inline-flex min-h-12 items-center rounded-button bg-surface-2 px-6 text-body font-semibold">
              프로젝트 목록으로
            </Link>
          }
        />
      </section>
    )
  }

  const changeSort = (sort: TaskSort) => {
    setSortState({ projectId, sort })
    try {
      localStorage.setItem(sortStorageKey(projectId), sort)
    } catch {
      // 저장소를 쓸 수 없으면 이번 화면에서만 적용한다
    }
  }

  const toggleArchive = () => {
    if (!project) return
    const archiving = !project.archived
    updateProject.mutate(
      { id: project.id, patch: { archived: archiving } },
      {
        onSuccess: () => {
          setMenuOpen(false)
          showToast({ message: archiving ? '프로젝트를 보관했어요' : '보관을 해제했어요' })
          if (archiving) navigate('/projects')
        },
        onError: () => showToast({ message: '저장하지 못했어요', tone: 'error' }),
      },
    )
  }

  const removeProject = () => {
    if (!project) return
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        setConfirmDelete(false)
        showToast({ message: '프로젝트를 삭제했어요' })
        navigate('/projects', { replace: true })
      },
      onError: () => showToast({ message: '삭제하지 못했어요', tone: 'error' }),
    })
  }

  const filtered = highOnly || tagIds.length > 0
  const openList = openTasks.data ?? []

  return (
    <section className="screen-x">
      <header className="flex items-center gap-1">
        <BackLink />
        <h1 className="flex min-w-0 flex-1 items-center gap-2 text-title font-bold">
          <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: project?.color }} />
          <span className="truncate">{project?.name ?? '프로젝트'}</span>
        </h1>
        <button
          type="button"
          aria-label="프로젝트 메뉴"
          onClick={() => setMenuOpen(true)}
          disabled={!project}
          className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-sub active:bg-surface"
        >
          <Ellipsis size={24} aria-hidden />
        </button>
      </header>
      {project && (
        <p className="mt-1 text-body text-ink-sub">
          미완료 {project.open_count} ·{' '}
          <span className={project.overdue_count > 0 ? 'text-primary' : ''}>지남 {project.overdue_count}</span>
          {project.archived && ' · 보관됨'}
        </p>
      )}

      <div className="mt-5">
        <Segmented label="정렬" value={sortState.sort} options={SORT_OPTIONS} onChange={changeSort} />
      </div>
      <div role="group" aria-label="필터" className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        <Chip selected={highOnly} onClick={() => setHighOnly((value) => !value)}>
          <Flag size={14} aria-hidden className="fill-current text-prio-high" />
          높음
        </Chip>
        {tags.data?.map((tag) => (
          <TagChip
            key={tag.id}
            tag={tag}
            selected={tagIds.includes(tag.id)}
            onClick={() => setTagIds((ids) => toggleId(ids, tag.id))}
          />
        ))}
      </div>
      <div className="mt-2">
        <Toggle label="완료 항목 보기" checked={showDone} onChange={setShowDone} />
      </div>

      {openTasks.isPending ? (
        <ListSkeleton />
      ) : openList.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={filtered ? '조건에 맞는 할일이 없어요' : '할일이 없어요'}
          description={filtered ? undefined : '+ 버튼으로 할일을 추가해보세요'}
        />
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {openList.map((task) => (
            <TaskItem key={task.id} task={task} now={now} onToggle={toggle} showProject={false} />
          ))}
        </ul>
      )}

      {showDone && (
        <>
          <SectionHeader title="완료" count={doneTasks.data?.length} />
          {doneTasks.data?.length === 0 && <p className="text-body text-ink-sub">완료한 할일이 없어요</p>}
          <ul className="flex flex-col gap-2">
            {doneTasks.data?.map((task) => (
              <TaskItem key={task.id} task={task} now={now} onToggle={toggle} showProject={false} />
            ))}
          </ul>
        </>
      )}

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title={project?.name}>
        <div className="flex flex-col gap-2">
          <MenuButton
            icon={Pencil}
            label="수정"
            onClick={() => {
              setMenuOpen(false)
              openSheet({ 'project-edit': String(projectId) })
            }}
          />
          <MenuButton
            icon={project?.archived ? ArchiveRestore : Archive}
            label={project?.archived ? '보관 해제' : '보관'}
            onClick={toggleArchive}
            disabled={updateProject.isPending}
          />
          <MenuButton
            icon={Trash2}
            label="삭제"
            danger
            onClick={() => {
              setMenuOpen(false)
              setConfirmDelete(true)
            }}
          />
        </div>
      </BottomSheet>

      <ConfirmSheet
        open={confirmDelete}
        title="프로젝트를 삭제할까요?"
        message={`미완료 ${project?.open_count ?? 0}개를 포함해 이 프로젝트의 할일이 모두 함께 삭제돼요. 되돌릴 수 없어요.`}
        confirmLabel="삭제"
        pending={deleteProject.isPending}
        onConfirm={removeProject}
        onClose={() => setConfirmDelete(false)}
      />
      <ProjectSheet />
    </section>
  )
}
