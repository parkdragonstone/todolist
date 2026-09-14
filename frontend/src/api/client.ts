// Design Ref: §5.6 — same-origin fetch, 오류를 ApiError로 정규화, 401 발생 시 전역 핸들러 호출
import type { ApiErrorBody } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: Record<string, string>
  readonly retryAfter: number | null

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors: Record<string, string> = {},
    retryAfter: number | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
    this.retryAfter = retryAfter
  }
}

type QueryValue = string | number | boolean | null | undefined | Array<string | number>
export type Query = Record<string, QueryValue>
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestOptions {
  method?: Method
  body?: unknown
  query?: Query
  /** true면 401이어도 전역 로그아웃 처리를 하지 않는다 (로그인 상태 확인용) */
  skipAuthRedirect?: boolean
}

let onUnauthorized: () => void = () => {}

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

export function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach((item) => params.append(key, String(item)))
    else params.append(key, String(value))
  }
  const qs = params.toString()
  return `/api${path}${qs ? `?${qs}` : ''}`
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, skipAuthRedirect = false } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', '네트워크에 연결할 수 없어요')
  }

  if (response.status === 204) return undefined as T
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const error = (payload as ApiErrorBody | null)?.error
    const retryHeader = response.headers.get('Retry-After')
    const apiError = new ApiError(
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? '문제가 생겼어요',
      error?.details?.field_errors ?? {},
      retryHeader ? Number(retryHeader) : (error?.details?.retry_after ?? null),
    )
    if (response.status === 401 && !skipAuthRedirect) onUnauthorized()
    throw apiError
  }
  return payload as T
}

/** `{ data: T }` envelope를 벗겨서 반환 */
export async function apiData<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const envelope = await apiFetch<{ data: T }>(path, options)
  return envelope.data
}
