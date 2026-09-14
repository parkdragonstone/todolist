// Design Ref: §5.3 CheckCircle — 26px 원형 체크, 완료 시 노랑 채움 + pop 애니메이션, 터치 영역 44px
import { Check } from 'lucide-react'

interface CheckCircleProps {
  checked: boolean
  label: string
  onToggle: () => void
  disabled?: boolean
}

export function CheckCircle({ checked, label, onToggle, disabled = false }: CheckCircleProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className="grid size-11 shrink-0 place-items-center disabled:opacity-50"
    >
      <span
        className={`grid size-[26px] place-items-center rounded-full border-2 transition-colors ${
          checked ? 'animate-check-pop border-success bg-success text-bg' : 'border-ink-dim'
        }`}
      >
        {checked && <Check size={16} strokeWidth={3.5} aria-hidden />}
      </span>
    </button>
  )
}
