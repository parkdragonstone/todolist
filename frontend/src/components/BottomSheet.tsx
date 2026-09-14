// Design Ref: §5.3 BottomSheet — 딤, 슬라이드업, 드래그 핸들, ESC/딤 탭 닫기, 포커스 트랩·복원, 스크롤 잠금
import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

const DURATION_MS = 220
const DRAG_CLOSE_PX = 96
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** 중첩 시트(예: 편집 시트 위 확인 시트)에서 가장 위 시트만 ESC/Tab을 처리한다 */
const openSheets: string[] = []

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
}

function useMountTransition(open: boolean) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  if (open && !mounted) setMounted(true)

  useEffect(() => {
    if (!mounted) return
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setVisible(open))
    })
    const timer = open ? 0 : window.setTimeout(() => setMounted(false), DURATION_MS)
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
      window.clearTimeout(timer)
    }
  }, [open, mounted])

  return { mounted, visible }
}

export function BottomSheet({ open, onClose, title, children, footer }: BottomSheetProps) {
  const { mounted, visible } = useMountTransition(open)
  const sheetId = useId()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const handleClose = useEffectEvent(onClose)

  useEffect(() => {
    if (!open) return
    openSheets.push(sheetId)
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current
      const target = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel
      target?.focus()
    }, 60)

    const onKeyDown = (event: KeyboardEvent) => {
      if (openSheets[openSheets.length - 1] !== sheetId) return
      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      openSheets.splice(openSheets.indexOf(sheetId), 1)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [open, sheetId])

  if (!mounted) return null

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStart.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return
    setDragY(Math.max(0, event.clientY - dragStart.current))
  }
  const onPointerUp = () => {
    if (dragY > DRAG_CLOSE_PX) onClose()
    dragStart.current = null
    setDragY(0)
  }

  const dragging = dragY > 0
  const bottomPadding = 'calc(var(--safe-bottom) + 16px)'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        aria-hidden
        className={`absolute inset-0 bg-dim transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full max-w-[var(--content-max)] flex-col rounded-t-sheet bg-surface outline-none"
        style={{
          transform: visible ? `translateY(${dragY}px)` : 'translateY(100%)',
          transition: dragging ? 'none' : `transform var(--sheet-duration) ease-out`,
        }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pt-3 pb-2"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>
        {title && (
          <h2 id={titleId} className="screen-x shrink-0 pb-3 text-section font-bold">
            {title}
          </h2>
        )}
        <div
          className="screen-x flex-1 overflow-y-auto overscroll-contain pb-4"
          style={footer ? undefined : { paddingBottom: bottomPadding }}
        >
          {children}
        </div>
        {footer && (
          <div className="screen-x flex shrink-0 gap-3 border-t border-line pt-3" style={{ paddingBottom: bottomPadding }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
