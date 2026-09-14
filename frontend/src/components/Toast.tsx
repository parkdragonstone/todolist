// Design Ref: §5.3 Toast — 하단 토스트 + 액션 버튼(실행 취소). 한 번에 하나만 표시한다.
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_DURATION_MS = 3000

export interface ToastOptions {
  message: string
  actionLabel?: string
  onAction?: () => void
  durationMs?: number
  tone?: 'default' | 'error'
}

interface ToastState extends ToastOptions {
  id: number
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void
  dismissToast: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const nextId = useRef(0)

  const dismissToast = useCallback(() => setToast(null), [])
  const showToast = useCallback((options: ToastOptions) => {
    nextId.current += 1
    setToast({ ...options, id: nextId.current })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(
      () => setToast((current) => (current?.id === toast.id ? null : current)),
      toast.durationMs ?? DEFAULT_DURATION_MS,
    )
    return () => window.clearTimeout(timer)
  }, [toast])

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast])

  return (
    <ToastContext value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="screen-x pointer-events-none fixed inset-x-0 z-[60] flex justify-center"
        style={{ bottom: 'calc(var(--tabbar-height) + var(--safe-bottom) + var(--fab-size) + 28px)' }}
      >
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-[var(--content-max)] animate-toast-in items-center gap-3 rounded-card bg-surface-2 py-2 pr-2 pl-4 shadow-lg shadow-black/40"
          >
            <span className={`flex-1 text-body ${toast.tone === 'error' ? 'text-primary' : 'text-ink'}`}>
              {toast.message}
            </span>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                className="min-h-11 rounded-button px-3 text-body font-semibold text-toggle active:bg-surface"
                onClick={() => {
                  toast.onAction?.()
                  setToast(null)
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
