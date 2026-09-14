// Design Ref: §5.3 ConfirmSheet — 파괴적 작업 확인 (취소 / 확인(primary))
import type { ReactNode } from 'react'

import { BottomSheet } from './BottomSheet'

interface ConfirmSheetProps {
  open: boolean
  title: string
  message?: ReactNode
  confirmLabel?: string
  pending?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel = '확인',
  pending = false,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            type="button"
            className="min-h-12 flex-1 rounded-button bg-surface-2 text-body font-semibold text-ink active:bg-line"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            data-autofocus
            className="min-h-12 flex-1 rounded-button bg-primary text-body font-semibold text-ink active:bg-primary-press disabled:opacity-60"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? '처리 중…' : confirmLabel}
          </button>
        </>
      }
    >
      {message && <p className="text-body leading-relaxed text-ink-sub">{message}</p>}
    </BottomSheet>
  )
}
