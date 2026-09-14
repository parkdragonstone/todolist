// Design Ref: §5.4 Login — 비밀번호 입력, 401/429 오류 문구, 성공 시 원래 화면으로 이동
import { Check, LoaderCircle } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { ApiError } from '@/api/client'
import { useLogin, useMe } from '@/api/queries'

function loginErrorMessage(error: unknown): string | null {
  if (!error) return null
  if (error instanceof ApiError) {
    if (error.status === 401) return '비밀번호가 맞지 않아요'
    if (error.status === 429) {
      const minutes = Math.max(1, Math.ceil((error.retryAfter ?? 60) / 60))
      return `잠시 후 다시 시도해주세요 (${minutes}분)`
    }
    return error.message
  }
  return '문제가 생겼어요'
}

export function LoginPage() {
  const me = useMe()
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const [password, setPassword] = useState('')

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (me.data) return <Navigate to={from} replace />

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!password || login.isPending) return
    login.mutate(password, { onSuccess: () => navigate(from, { replace: true }) })
  }

  const message = loginErrorMessage(login.error)

  return (
    <main className="screen-x mx-auto flex min-h-dvh w-full max-w-[400px] flex-col justify-center pt-safe pb-10">
      <div className="mb-10 flex flex-col items-center text-center">
        <div className="mb-5 grid size-20 place-items-center rounded-full bg-primary shadow-xl shadow-primary/25">
          <Check size={40} strokeWidth={3} className="text-ink" aria-hidden />
        </div>
        <h1 className="text-title font-bold">Todo</h1>
        <p className="mt-2 text-body text-ink-sub">프로젝트별 할일과 마감을 한눈에</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <label htmlFor="password" className="sr-only">
          비밀번호
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          placeholder="비밀번호"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? 'login-error' : undefined}
          className="h-14 rounded-card border border-transparent bg-surface px-4 text-ink placeholder:text-ink-dim focus:border-toggle focus:outline-none aria-[invalid=true]:border-primary"
        />
        {message && (
          <p id="login-error" role="alert" className="px-1 text-meta text-primary">
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={!password || login.isPending}
          className="mt-2 flex h-14 items-center justify-center gap-2 rounded-button bg-primary text-[16px] font-semibold text-ink active:bg-primary-press disabled:opacity-50"
        >
          {login.isPending && <LoaderCircle size={20} className="animate-spin" aria-hidden />}
          로그인
        </button>
      </form>
    </main>
  )
}
