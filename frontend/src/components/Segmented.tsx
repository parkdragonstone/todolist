// Design Ref: §5.3 Segmented — 세그먼트 컨트롤 (정렬, 우선순위, 반복 주기)
interface SegmentedProps<T extends string | number> {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
  disabled?: boolean
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} aria-disabled={disabled} className="flex rounded-button bg-surface-2 p-1">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`min-h-9 flex-1 rounded-[8px] px-1 text-body font-semibold transition-colors disabled:opacity-40 ${
              selected ? 'bg-surface text-ink shadow-sm shadow-black/30' : 'text-ink-sub'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
