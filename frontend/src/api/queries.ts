// Design Ref: §5.6 — 서버 상태 훅과 캐시 무효화 규칙. 화면은 client.ts를 직접 호출하지 않고 이 훅만 쓴다.
import {
  keepPreviousData,
  type QueryClient,
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { ApiError, apiData, apiFetch } from './client'
import type {
  BackupInfo,
  CalendarData,
  CompleteResult,
  ImportResult,
  Project,
  ProjectInput,
  ProjectPatch,
  Tag,
  TagInput,
  Task,
  TaskFilters,
  TaskInput,
  TaskPatch,
  UncompleteResult,
  Upcoming,
  UpcomingFilters,
} from './types'

export const EXPORT_URL = '/api/export'

export const queryKeys = {
  me: ['me'] as const,
  projects: (includeArchived = false) => ['projects', { includeArchived }] as const,
  tasks: (filters: TaskFilters = {}) => ['tasks', filters] as const,
  task: (id: number) => ['task', id] as const,
  upcoming: (filters: UpcomingFilters = {}) => ['upcoming', filters] as const,
  calendar: (from: string, to: string) => ['calendar', from, to] as const,
  tags: ['tags'] as const,
  backups: ['backups'] as const,
}

/** 할일이 바뀌면 다시 불러와야 하는 화면 데이터 (프로젝트 카운트 포함) */
const TASK_VIEW_KEYS: QueryKey[] = [['tasks'], ['task'], ['upcoming'], ['calendar'], ['projects'], ['tags']]
const OPTIMISTIC_KEYS: QueryKey[] = [['tasks'], ['task'], ['upcoming'], ['calendar']]

function invalidate(qc: QueryClient, keys: QueryKey[]) {
  return Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })))
}

/**
 * 로그아웃 상태로 전환한다. queryClient.clear()를 먼저 부르면 화면이 구독 중인 ['me'] 쿼리 객체가
 * 캐시에서 사라져 이후 setQueryData가 구독자에게 전달되지 않으므로, ['me']는 남긴 채 값만 바꾸고
 * 나머지 쿼리만 지운다. (E2E L3-4에서 발견)
 */
export function resetToLoggedOut(qc: QueryClient) {
  qc.setQueryData(queryKeys.me, false)
  qc.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.me[0] })
}

// ── 인증 ────────────────────────────────────────────────────────────────────
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      try {
        await apiFetch('/auth/me', { skipAuthRedirect: true })
        return true
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return false
        throw error
      }
    },
    staleTime: 60_000,
    retry: false,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (password: string) =>
      apiData<{ authenticated: boolean }>('/auth/login', {
        method: 'POST',
        body: { password },
        skipAuthRedirect: true,
      }),
    onSuccess: () => qc.setQueryData(queryKeys.me, true),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST', skipAuthRedirect: true }),
    onSettled: () => resetToLoggedOut(qc),
  })
}

// ── 프로젝트 ────────────────────────────────────────────────────────────────
export function useProjects(includeArchived = false) {
  return useQuery({
    queryKey: queryKeys.projects(includeArchived),
    queryFn: () => apiData<Project[]>('/projects', { query: { include_archived: includeArchived } }),
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ProjectInput) => apiData<Project>('/projects', { method: 'POST', body: input }),
    onSuccess: () => invalidate(qc, [['projects']]),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: ProjectPatch }) =>
      apiData<Project>(`/projects/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => invalidate(qc, TASK_VIEW_KEYS),
  })
}

export function useReorderProjects() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) => apiData<Project[]>('/projects/order', { method: 'PUT', body: { ids } }),
    onSuccess: (projects) => {
      qc.setQueryData(queryKeys.projects(false), projects)
      return invalidate(qc, [['projects']])
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(qc, TASK_VIEW_KEYS),
  })
}

// ── 할일 ────────────────────────────────────────────────────────────────────
export function useTasks(filters: TaskFilters = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tasks(filters),
    queryFn: () => apiData<Task[]>('/tasks', { query: { ...filters } }),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useUpcoming(filters: UpcomingFilters = {}) {
  return useQuery({
    queryKey: queryKeys.upcoming(filters),
    queryFn: () => apiData<Upcoming>('/tasks/upcoming', { query: { ...filters } }),
    placeholderData: keepPreviousData,
  })
}

export function useTask(id: number | null) {
  return useQuery({
    queryKey: queryKeys.task(id ?? 0),
    queryFn: () => apiData<Task>(`/tasks/${id}`),
    enabled: id !== null,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskInput) => apiData<Task>('/tasks', { method: 'POST', body: input }),
    onSuccess: () => invalidate(qc, TASK_VIEW_KEYS),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: TaskPatch }) =>
      apiData<Task>(`/tasks/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => invalidate(qc, TASK_VIEW_KEYS),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(qc, TASK_VIEW_KEYS),
  })
}

// 낙관적 업데이트: 캐시에 들어 있는 모든 형태(Task[], Task, Upcoming, CalendarData)에서 해당 할일만 교체
type Snapshot = Array<[QueryKey, unknown]>

function isTask(value: unknown): value is Task {
  return typeof value === 'object' && value !== null && 'project_id' in value && 'title' in value
}

function patchTasksDeep(value: unknown, id: number, update: (task: Task) => Task): unknown {
  if (Array.isArray(value)) return value.map((item) => patchTasksDeep(item, id, update))
  if (isTask(value)) return value.id === id ? update(value) : value
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, patchTasksDeep(item, id, update)]),
    )
  }
  return value
}

async function applyOptimistic(qc: QueryClient, id: number, update: (task: Task) => Task): Promise<Snapshot> {
  await Promise.all(OPTIMISTIC_KEYS.map((queryKey) => qc.cancelQueries({ queryKey })))
  const snapshot: Snapshot = []
  for (const queryKey of OPTIMISTIC_KEYS) {
    for (const [key, data] of qc.getQueriesData({ queryKey })) {
      snapshot.push([key, data])
      if (data !== undefined) qc.setQueryData(key, patchTasksDeep(data, id, update))
    }
  }
  return snapshot
}

function restore(qc: QueryClient, snapshot: Snapshot | undefined) {
  snapshot?.forEach(([key, data]) => qc.setQueryData(key, data))
}

export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiData<CompleteResult>(`/tasks/${id}/complete`, { method: 'POST' }),
    onMutate: (id: number) =>
      applyOptimistic(qc, id, (task) => ({ ...task, completed_at: task.completed_at ?? new Date().toISOString() })),
    onError: (_error, _id, snapshot) => restore(qc, snapshot),
    onSettled: () => invalidate(qc, TASK_VIEW_KEYS),
  })
}

export function useUncompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiData<UncompleteResult>(`/tasks/${id}/uncomplete`, { method: 'POST' }),
    onMutate: (id: number) => applyOptimistic(qc, id, (task) => ({ ...task, completed_at: null })),
    onError: (_error, _id, snapshot) => restore(qc, snapshot),
    onSettled: () => invalidate(qc, TASK_VIEW_KEYS),
  })
}

// ── 태그 ────────────────────────────────────────────────────────────────────
export function useTags() {
  return useQuery({ queryKey: queryKeys.tags, queryFn: () => apiData<Tag[]>('/tags') })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TagInput) => apiData<Tag>('/tags', { method: 'POST', body: input }),
    onSuccess: () => invalidate(qc, [['tags']]),
  })
}

export function useUpdateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<TagInput> }) =>
      apiData<Tag>(`/tags/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => invalidate(qc, TASK_VIEW_KEYS),
  })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(qc, TASK_VIEW_KEYS),
  })
}

// ── 달력 ────────────────────────────────────────────────────────────────────
export function useCalendar(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.calendar(from, to),
    queryFn: () => apiData<CalendarData>('/calendar', { query: { from, to, include_done: true } }),
    placeholderData: keepPreviousData,
  })
}

// ── 백업 ────────────────────────────────────────────────────────────────────
export function useBackups(enabled = true) {
  return useQuery({
    queryKey: queryKeys.backups,
    queryFn: () => apiData<BackupInfo[]>('/backups'),
    enabled,
  })
}

export function useCreateBackup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiData<BackupInfo>('/backups', { method: 'POST' }),
    onSuccess: () => invalidate(qc, [['backups']]),
  })
}

export function useImportData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: unknown) => apiData<ImportResult>('/import', { method: 'POST', body: payload }),
    onSuccess: () => qc.invalidateQueries(),
  })
}
