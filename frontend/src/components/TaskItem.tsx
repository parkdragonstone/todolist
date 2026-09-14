// Design Ref: §5.3 TaskItem — 체크, 제목, 메타(프로젝트 점·이름, DueChip, PriorityFlag, 반복 아이콘, 태그)
import { Repeat2, StickyNote } from 'lucide-react'

import type { Task } from '@/api/types'
import { useSheetParams } from '@/hooks/useSheetParams'
import { repeatLabel } from '@/lib/task'

import { CheckCircle } from './CheckCircle'
import { DueChip } from './DueChip'
import { PriorityFlag } from './PriorityFlag'
import { TagChip } from './TagChip'

interface TaskItemProps {
  task: Task
  now: Date
  onToggle: (task: Task) => void
  showProject?: boolean
}

export function TaskItem({ task, now, onToggle, showProject = true }: TaskItemProps) {
  const { openSheet } = useSheetParams()
  const done = task.completed_at !== null

  return (
    <li className={`flex items-start gap-1 rounded-card bg-surface pr-4 pl-1.5 transition-opacity ${done ? 'opacity-60' : ''}`}>
      <CheckCircle
        checked={done}
        label={done ? `${task.title} 완료 취소` : `${task.title} 완료`}
        onToggle={() => onToggle(task)}
      />
      <button
        type="button"
        onClick={() => openSheet({ task: String(task.id) })}
        className="min-w-0 flex-1 py-3 text-left"
      >
        <p className={`text-body font-semibold break-words ${done ? 'text-ink-sub line-through' : 'text-ink'}`}>
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-sub">
          {showProject && (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: task.project_color }} />
              {task.project_name}
            </span>
          )}
          <DueChip dueDate={task.due_date} dueTime={task.due_time} now={now} done={done} />
          <PriorityFlag priority={task.priority} />
          {task.repeat && <Repeat2 size={14} role="img" aria-label={`반복: ${repeatLabel(task.repeat)}`} />}
          {task.memo && <StickyNote size={13} role="img" aria-label="메모 있음" />}
          {task.tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
        </div>
      </button>
    </li>
  )
}
