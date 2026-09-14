// Design Ref: §5.3 TagChip — #이름 칩(표시형/선택형)과 필터용 일반 칩
import type { ReactNode } from 'react'

import type { TagBrief } from '@/api/types'

/** 선택형 칩 스타일. 버튼이 아닌 요소(날짜 선택 칩 등)도 같은 모양을 쓸 수 있게 공개한다 */
export function chipClass(selected: boolean) {
  const base = 'inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-body transition-colors'
  return `${base} ${selected ? 'border-toggle bg-toggle/15 text-ink' : 'border-line bg-surface text-ink-sub'}`
}

interface ChipProps {
  selected: boolean
  onClick: () => void
  children: ReactNode
}

export function Chip({ selected, onClick, children }: ChipProps) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={chipClass(selected)}>
      {children}
    </button>
  )
}

interface TagChipProps {
  tag: TagBrief
  selected?: boolean
  onClick?: () => void
}

export function TagChip({ tag, selected = false, onClick }: TagChipProps) {
  const content = (
    <>
      <span aria-hidden style={{ color: tag.color }}>
        #
      </span>
      {tag.name}
    </>
  )

  if (!onClick) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-meta text-ink-sub">
        {content}
      </span>
    )
  }

  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={chipClass(selected)}>
      {content}
    </button>
  )
}
