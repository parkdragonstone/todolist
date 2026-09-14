// Design Ref: §5.4 TaskSheet/태그 — 기존 태그 다중 선택 + "새 태그" 인라인 생성
import { Plus } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'

import { ApiError } from '@/api/client'
import { useCreateTag, useTags } from '@/api/queries'
import { TagChip } from '@/components/TagChip'
import { useToast } from '@/components/Toast'
import { PRESET_COLORS } from '@/lib/colors'
import { toggleId } from '@/lib/task'

interface TagPickerProps {
  selectedIds: number[]
  onChange: (ids: number[]) => void
}

export function TagPicker({ selectedIds, onChange }: TagPickerProps) {
  const tags = useTags()
  const createTag = useCreateTag()
  const { showToast } = useToast()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const stopAdding = () => {
    setName('')
    setAdding(false)
  }

  const finishAdding = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      stopAdding()
      return
    }
    if (createTag.isPending) return

    const existing = tags.data?.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      if (!selectedIds.includes(existing.id)) onChange([...selectedIds, existing.id])
      stopAdding()
      return
    }

    const color = PRESET_COLORS[(tags.data?.length ?? 0) % PRESET_COLORS.length]
    createTag.mutate(
      { name: trimmed, color },
      {
        onSuccess: (tag) => {
          onChange([...selectedIds, tag.id])
          stopAdding()
        },
        onError: (error) =>
          showToast({
            message: error instanceof ApiError ? (error.fieldErrors.name ?? error.message) : '태그를 만들지 못했어요',
            tone: 'error',
          }),
      },
    )
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      finishAdding()
    } else if (event.key === 'Escape') {
      // 시트 전체가 닫히지 않도록 입력만 취소한다
      event.preventDefault()
      event.stopPropagation()
      stopAdding()
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.data?.map((tag) => (
        <TagChip
          key={tag.id}
          tag={tag}
          selected={selectedIds.includes(tag.id)}
          onClick={() => onChange(toggleId(selectedIds, tag.id))}
        />
      ))}
      {adding ? (
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={finishAdding}
          maxLength={30}
          placeholder="태그 이름"
          aria-label="새 태그 이름"
          enterKeyHint="done"
          disabled={createTag.isPending}
          className="h-9 w-32 rounded-full border border-toggle bg-surface px-3 text-ink focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-line px-3 text-body text-ink-sub active:bg-surface-2"
        >
          <Plus size={14} aria-hidden />새 태그
        </button>
      )}
    </div>
  )
}
