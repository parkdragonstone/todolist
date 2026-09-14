// Design Ref: §5.4 TaskSheet — 할일 생성·수정·삭제 폼. ?new=1(&project=&date=) 또는 ?task=ID 로 열린다.
import { CalendarDays, ChevronDown, Clock, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { ApiError } from '@/api/client'
import { useCreateTask, useDeleteTask, useProjects, useTask, useUpdateTask } from '@/api/queries'
import type { Priority, RepeatInput, Task, TaskInput } from '@/api/types'
import { BottomSheet } from '@/components/BottomSheet'
import { ConfirmSheet } from '@/components/ConfirmSheet'
import { Field } from '@/components/Field'
import { Segmented } from '@/components/Segmented'
import { Chip, chipClass } from '@/components/TagChip'
import { useToast } from '@/components/Toast'
import { useNow } from '@/hooks/useNow'
import { useSheetParams } from '@/hooks/useSheetParams'
import { parseISODate, quickDueDates } from '@/lib/date'
import { formatShortDate } from '@/lib/format'
import { mondayIndex, PRIORITY_OPTIONS } from '@/lib/task'

import { RepeatPicker } from './RepeatPicker'
import { TagPicker } from './TagPicker'

const LAST_PROJECT_KEY = 'todo.lastProjectId'
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function parseId(value: string | null): number | null {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function readLastProjectId(): number | null {
  try {
    return parseId(localStorage.getItem(LAST_PROJECT_KEY))
  } catch {
    return null
  }
}

function saveLastProjectId(id: number) {
  try {
    localStorage.setItem(LAST_PROJECT_KEY, String(id))
  } catch {
    // 저장소를 쓸 수 없는 환경(사파리 개인정보 보호 모드 등)이면 기억하지 않는다
  }
}

interface SheetSession {
  key: string
  taskId: number | null
  projectId: number | null
  date: string | null
}

export function TaskSheetHost() {
  const { searchParams, closeSheet } = useSheetParams()
  const taskId = parseId(searchParams.get('task'))
  const open = taskId !== null || searchParams.get('new') === '1'
  const projectId = parseId(searchParams.get('project'))
  const dateParam = searchParams.get('date')
  const date = dateParam && ISO_DATE.test(dateParam) ? dateParam : null
  const key = taskId !== null ? `task-${taskId}` : `new-${projectId ?? ''}-${date ?? ''}`

  // 닫히는 애니메이션 동안에도 마지막 내용을 유지한다
  const [session, setSession] = useState<SheetSession | null>(null)
  if (open && session?.key !== key) setSession({ key, taskId, projectId, date })

  return (
    <BottomSheet open={open} onClose={closeSheet} title={session?.taskId ? '할일 수정' : '새 할일'}>
      {session && <TaskSheetBody key={session.key} session={session} onDone={closeSheet} />}
    </BottomSheet>
  )
}

function TaskSheetBody({ session, onDone }: { session: SheetSession; onDone: () => void }) {
  const task = useTask(session.taskId)

  if (session.taskId !== null) {
    if (task.isPending) return <p className="py-12 text-center text-body text-ink-sub">불러오는 중…</p>
    if (!task.data) return <p className="py-12 text-center text-body text-ink-sub">할일을 찾을 수 없어요</p>
  }

  return (
    <TaskForm
      task={task.data ?? null}
      defaultProjectId={session.projectId}
      defaultDate={session.date}
      onDone={onDone}
    />
  )
}

interface TaskFormProps {
  task: Task | null
  defaultProjectId: number | null
  defaultDate: string | null
  onDone: () => void
}

function TaskForm({ task, defaultProjectId, defaultDate, onDone }: TaskFormProps) {
  const projects = useProjects()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const { showToast } = useToast()
  const now = useNow()
  const quick = quickDueDates(now)

  const [title, setTitle] = useState(task?.title ?? '')
  const [projectId, setProjectId] = useState<number | null>(
    () => task?.project_id ?? defaultProjectId ?? readLastProjectId(),
  )
  const [dueDate, setDueDate] = useState<string | null>(task?.due_date ?? defaultDate)
  const [dueTime, setDueTime] = useState<string | null>(task?.due_time ?? null)
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 0)
  const [tagIds, setTagIds] = useState<number[]>(() => task?.tags.map((tag) => tag.id) ?? [])
  const [repeat, setRepeat] = useState<RepeatInput | null>(() =>
    task?.repeat ? { freq: task.repeat.freq, interval: task.repeat.interval, weekdays: task.repeat.weekdays } : null,
  )
  const [memo, setMemo] = useState(task?.memo ?? '')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const projectOptions = projects.data ?? []
  const isOption = (id: number | null) => id !== null && projectOptions.some((p) => p.id === id)
  const selectedProjectId = isOption(projectId) ? projectId : (task?.project_id ?? projectOptions[0]?.id ?? null)
  const selectedColor = projectOptions.find((p) => p.id === selectedProjectId)?.color ?? task?.project_color
  const noProjects = projects.isSuccess && projectOptions.length === 0 && !task

  const pending = createTask.isPending || updateTask.isPending
  const canSave = title.trim().length > 0 && selectedProjectId !== null && !pending
  const isQuickDate = dueDate === quick.today || dueDate === quick.tomorrow || dueDate === quick.nextMonday
  const errorFor = (field: string) =>
    Object.entries(fieldErrors).find(([key]) => key === field || key.startsWith(`${field}.`))?.[1]

  const changeDueDate = (value: string | null) => {
    setDueDate(value)
    if (value === null) {
      setDueTime(null)
      setRepeat(null)
    }
  }

  const handleError = (error: unknown) => {
    if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
      setFieldErrors(error.fieldErrors)
      return
    }
    showToast({ message: error instanceof ApiError ? error.message : '저장에 실패했어요', tone: 'error' })
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSave || selectedProjectId === null) return

    const payload: TaskInput = {
      project_id: selectedProjectId,
      title: title.trim(),
      memo,
      due_date: dueDate,
      due_time: dueDate ? dueTime : null,
      priority,
      tag_ids: tagIds,
      repeat: dueDate ? repeat : null,
    }
    saveLastProjectId(selectedProjectId)
    setFieldErrors({})

    const onSuccess = (message: string) => () => {
      showToast({ message })
      onDone()
    }
    if (task) {
      updateTask.mutate({ id: task.id, patch: payload }, { onSuccess: onSuccess('저장했어요'), onError: handleError })
    } else {
      createTask.mutate(payload, { onSuccess: onSuccess('할일을 추가했어요'), onError: handleError })
    }
  }

  const onDelete = () => {
    if (!task) return
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        setConfirmDelete(false)
        showToast({ message: '삭제했어요' })
        onDone()
      },
      onError: () => showToast({ message: '삭제하지 못했어요', tone: 'error' }),
    })
  }

  const clearButtonClass = 'grid size-9 place-items-center rounded-full text-ink-sub active:bg-surface-2'

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div>
        <input
          data-autofocus={task ? undefined : true}
          aria-label="할일 제목"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder="할일 제목을 입력하세요"
          enterKeyHint="done"
          autoComplete="off"
          className="w-full bg-transparent py-1 text-[20px] font-bold text-ink placeholder:text-ink-dim focus:outline-none"
        />
        {errorFor('title') && (
          <p role="alert" className="mt-1.5 text-meta text-primary">
            {errorFor('title')}
          </p>
        )}
      </div>

      <Field label="프로젝트" htmlFor="task-project" error={errorFor('project_id')}>
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-2.5 -translate-y-1/2 rounded-full"
            style={{ backgroundColor: selectedColor }}
          />
          <select
            id="task-project"
            value={selectedProjectId ?? ''}
            onChange={(event) => setProjectId(parseId(event.target.value))}
            disabled={noProjects}
            className="h-12 w-full appearance-none rounded-card bg-surface-2 pr-10 pl-10 text-ink disabled:opacity-50"
          >
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
            {task && !isOption(task.project_id) && <option value={task.project_id}>{task.project_name}</option>}
            {noProjects && <option value="">프로젝트가 없어요</option>}
          </select>
          <ChevronDown
            size={18}
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-sub"
          />
        </div>
        {noProjects && <p className="mt-1.5 text-meta text-ink-sub">프로젝트 탭에서 먼저 프로젝트를 만들어주세요</p>}
      </Field>

      <Field label="마감" error={errorFor('due_date') ?? errorFor('due_time')}>
        <div className="flex flex-wrap items-center gap-2">
          <Chip selected={dueDate === quick.today} onClick={() => changeDueDate(quick.today)}>
            오늘
          </Chip>
          <Chip selected={dueDate === quick.tomorrow} onClick={() => changeDueDate(quick.tomorrow)}>
            내일
          </Chip>
          <Chip selected={dueDate === quick.nextMonday} onClick={() => changeDueDate(quick.nextMonday)}>
            다음 주 월
          </Chip>
          <span className={`relative ${chipClass(dueDate !== null && !isQuickDate)}`}>
            <CalendarDays size={16} aria-hidden />
            {dueDate && !isQuickDate ? formatShortDate(dueDate) : '날짜 선택'}
            <input
              type="date"
              aria-label="마감 날짜 선택"
              value={dueDate ?? ''}
              onChange={(event) => changeDueDate(event.target.value || null)}
              onClick={(event) => {
                try {
                  event.currentTarget.showPicker()
                } catch {
                  // showPicker를 지원하지 않는 브라우저는 기본 동작으로 연다
                }
              }}
              className="picker-overlay absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </span>
          {dueDate && (
            <button type="button" aria-label="마감 지우기" onClick={() => changeDueDate(null)} className={clearButtonClass}>
              <X size={18} aria-hidden />
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Clock size={18} aria-hidden className="text-ink-sub" />
          <input
            type="time"
            aria-label="마감 시간"
            value={dueTime ?? ''}
            disabled={!dueDate}
            onChange={(event) => setDueTime(event.target.value || null)}
            className="h-11 rounded-button bg-surface-2 px-3 text-ink disabled:opacity-40"
          />
          {dueTime && (
            <button type="button" aria-label="시간 지우기" onClick={() => setDueTime(null)} className={clearButtonClass}>
              <X size={18} aria-hidden />
            </button>
          )}
          {!dueDate && <span className="text-meta text-ink-dim">날짜를 정하면 시간을 넣을 수 있어요</span>}
        </div>
      </Field>

      <Field label="우선순위">
        <Segmented label="우선순위" value={priority} options={PRIORITY_OPTIONS} onChange={setPriority} />
      </Field>

      <Field label="태그" error={errorFor('tag_ids')}>
        <TagPicker selectedIds={tagIds} onChange={setTagIds} />
      </Field>

      <Field label="반복" error={errorFor('repeat')}>
        <RepeatPicker
          value={repeat}
          onChange={setRepeat}
          disabled={!dueDate}
          defaultWeekday={dueDate ? mondayIndex(parseISODate(dueDate)) : undefined}
        />
      </Field>

      <Field label="메모" htmlFor="task-memo" error={errorFor('memo')}>
        <textarea
          id="task-memo"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          maxLength={5000}
          rows={3}
          placeholder="메모를 입력하세요"
          className="w-full resize-none rounded-card bg-surface-2 px-4 py-3 text-ink placeholder:text-ink-dim focus:outline-none focus-visible:outline-2 focus-visible:outline-toggle"
        />
      </Field>

      <div className="sticky bottom-0 -mx-5 flex gap-3 border-t border-line bg-surface px-5 pt-3 pb-1">
        {task && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="min-h-12 rounded-button bg-surface-2 px-5 text-body font-semibold text-primary active:bg-line"
          >
            삭제
          </button>
        )}
        <button
          type="submit"
          disabled={!canSave}
          className="min-h-12 flex-1 rounded-button bg-primary text-[16px] font-semibold text-ink active:bg-primary-press disabled:opacity-50"
        >
          {pending ? '저장 중…' : '저장'}
        </button>
      </div>

      {task && (
        <ConfirmSheet
          open={confirmDelete}
          title="할일을 삭제할까요?"
          message={task.repeat ? '반복 설정도 함께 사라져요. 삭제한 할일은 되돌릴 수 없어요.' : '삭제한 할일은 되돌릴 수 없어요.'}
          confirmLabel="삭제"
          pending={deleteTask.isPending}
          onConfirm={onDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </form>
  )
}
