// Design Ref: §5.3 ColorPicker — 프리셋 8색 원형 선택
import { Check } from 'lucide-react'

import { PRESET_COLORS } from '@/lib/colors'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  label?: string
}

export function ColorPicker({ value, onChange, label = '색상' }: ColorPickerProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-3">
      {PRESET_COLORS.map((color) => {
        const selected = color.toLowerCase() === value.toLowerCase()
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color}
            onClick={() => onChange(color)}
            className={`grid size-10 place-items-center rounded-full ring-offset-2 ring-offset-surface ${
              selected ? 'ring-2 ring-ink' : ''
            }`}
            style={{ backgroundColor: color }}
          >
            {selected && <Check size={18} strokeWidth={3} className="text-ink" aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}
