// Design Ref: §3.1, §4 — 백엔드 응답과 1:1로 맞춘 타입 (필드는 snake_case 그대로, 변환 계층 없음)
export type ISODate = string
export type HHMM = string
export type Timestamp = string

export type Priority = 0 | 1 | 2 | 3
export type RepeatFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type TaskStatus = 'open' | 'done' | 'all'
export type TaskSort = 'due' | 'priority' | 'created'
export type GroupKey = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later' | 'no_due'

export const GROUP_KEYS: readonly GroupKey[] = [
  'overdue',
  'today',
  'tomorrow',
  'this_week',
  'later',
  'no_due',
]

export interface Project {
  id: number
  name: string
  color: string
  sort_order: number
  archived: boolean
  open_count: number
  overdue_count: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ProjectInput {
  name: string
  color?: string
}

export interface ProjectPatch {
  name?: string
  color?: string
  archived?: boolean
}

export interface TagBrief {
  id: number
  name: string
  color: string
}

export interface Tag extends TagBrief {
  task_count: number
}

export interface TagInput {
  name: string
  color?: string
}

export interface Repeat {
  freq: RepeatFreq
  interval: number
  weekdays: number[] | null
  anchor_day: number | null
}

export interface RepeatInput {
  freq: RepeatFreq
  interval?: number
  weekdays?: number[] | null
}

export interface Task {
  id: number
  project_id: number
  project_name: string
  project_color: string
  title: string
  memo: string
  due_date: ISODate | null
  due_time: HHMM | null
  priority: Priority
  tags: TagBrief[]
  repeat: Repeat | null
  completed_at: Timestamp | null
  spawned_task_id: number | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface TaskInput {
  project_id: number
  title: string
  memo?: string
  due_date?: ISODate | null
  due_time?: HHMM | null
  priority?: Priority
  tag_ids?: number[]
  repeat?: RepeatInput | null
}

export type TaskPatch = Partial<TaskInput>

export interface TaskFilters {
  project_id?: number
  status?: TaskStatus
  tag_id?: number[]
  priority?: number
  due_from?: ISODate
  due_to?: ISODate
  sort?: TaskSort
}

export interface UpcomingFilters {
  project_id?: number
  tag_id?: number[]
  priority?: number
}

export interface Upcoming {
  today: ISODate
  groups: Record<GroupKey, Task[]>
  counts: Record<GroupKey, number>
}

export interface CompleteResult {
  task: Task
  spawned_task: Task | null
}

export interface UncompleteResult {
  task: Task
  removed_spawned_task_id: number | null
}

export interface CalendarDay {
  open: number
  done: number
  overdue: number
  colors: string[]
  tasks: Task[]
}

export interface CalendarData {
  from: ISODate
  to: ISODate
  days: Record<ISODate, CalendarDay>
  /** 한국 공휴일 (날짜 → 이름 목록) */
  holidays: Record<ISODate, string[]>
}

export interface BackupInfo {
  name: string
  size: number
  created_at: Timestamp
}

export interface ImportResult {
  projects: number
  tags: number
  tasks: number
  backup: string
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: {
      field_errors?: Record<string, string>
      retry_after?: number
    }
  }
}
