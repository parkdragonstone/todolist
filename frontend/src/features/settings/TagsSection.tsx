// Design Ref: §5.4 Settings/태그 — 목록(색 점·이름·미완료 수), 수정 시트(이름·색), 새 태그, 삭제 확인
import { ChevronRight } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { ApiError } from '@/api/client'
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from '@/api/queries'
import type { Tag } from '@/api/types'
import { BottomSheet } from '@/components/BottomSheet'
import { ColorPicker } from '@/components/ColorPicker'
import { ConfirmSheet } from '@/components/ConfirmSheet'
import { Field } from '@/components/Field'
import { SectionHeader } from '@/components/SectionHeader'
import { useToast } from '@/components/Toast'
import { DEFAULT_TAG_COLOR } from '@/lib/colors'

type EditTarget = Tag | 'new' | null

export function TagsSection() {
  const tags = useTags()
  const [target, setTarget] = useState<EditTarget>(null)

  // 닫히는 애니메이션 동안 마지막 대상을 유지한다
  const [active, setActive] = useState<EditTarget>(null)
  if (target !== null && target !== active) setActive(target)

  return (
    <div>
      <SectionHeader
        title="태그"
        count={tags.data?.length}
        action={
          <button
            type="button"
            onClick={() => setTarget('new')}
            className="-mr-2 min-h-11 px-2 text-body font-semibold text-toggle"
          >
            + 새 태그
          </button>
        }
      />
      {tags.data?.length === 0 && <p className="rounded-card bg-surface p-4 text-body text-ink-sub">아직 태그가 없어요</p>}
      {tags.data && tags.data.length > 0 && (
        <ul className="overflow-hidden rounded-card bg-surface">
          {tags.data.map((tag, index) => (
            <li key={tag.id} className={index > 0 ? 'border-t border-line/60' : ''}>
              <button
                type="button"
                onClick={() => setTarget(tag)}
                className="flex min-h-12 w-full items-center gap-3 px-4 text-left active:bg-surface-2"
              >
                <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="min-w-0 flex-1 truncate text-body">#{tag.name}</span>
                <span className="text-meta text-ink-sub">할일 {tag.task_count}</span>
                <ChevronRight size={18} aria-hidden className="text-ink-dim" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <BottomSheet open={target !== null} onClose={() => setTarget(null)} title={active === 'new' ? '새 태그' : '태그 수정'}>
        {active !== null && (
          <TagForm
            key={active === 'new' ? 'new' : active.id}
            tag={active === 'new' ? null : active}
            onDone={() => setTarget(null)}
          />
        )}
      </BottomSheet>
    </div>
  )
}

function TagForm({ tag, onDone }: { tag: Tag | null; onDone: () => void }) {
  const createTag = useCreateTag()
  const updateTag = useUpdateTag()
  const deleteTag = useDeleteTag()
  const { showToast } = useToast()
  const [name, setName] = useState(tag?.name ?? '')
  const [color, setColor] = useState(tag?.color ?? DEFAULT_TAG_COLOR)
  const [error, setError] = useState<string>()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const pending = createTag.isPending || updateTag.isPending
  const canSave = name.trim().length > 0 && !pending

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSave) return
    const input = { name: name.trim(), color }
    const onError = (err: unknown) =>
      setError(err instanceof ApiError ? (err.fieldErrors.name ?? err.message) : '저장에 실패했어요')
    const onSuccess = (message: string) => () => {
      showToast({ message })
      onDone()
    }
    if (tag) updateTag.mutate({ id: tag.id, patch: input }, { onSuccess: onSuccess('저장했어요'), onError })
    else createTag.mutate(input, { onSuccess: onSuccess('태그를 만들었어요'), onError })
  }

  const onDelete = () => {
    if (!tag) return
    deleteTag.mutate(tag.id, {
      onSuccess: () => {
        setConfirmDelete(false)
        showToast({ message: '태그를 삭제했어요' })
        onDone()
      },
      onError: () => showToast({ message: '삭제하지 못했어요', tone: 'error' }),
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label="이름" htmlFor="tag-name" error={error}>
        <input
          id="tag-name"
          data-autofocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={30}
          placeholder="예: 업무, 중요"
          autoComplete="off"
          enterKeyHint="done"
          className="h-12 w-full rounded-card bg-surface-2 px-4 text-ink placeholder:text-ink-dim focus:outline-none focus-visible:outline-2 focus-visible:outline-toggle"
        />
      </Field>
      <Field label="색상">
        <ColorPicker value={color} onChange={setColor} label="태그 색상" />
      </Field>
      <div className="flex gap-3">
        {tag && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="min-h-12 rounded-button bg-surface-2 px-5 text-body font-semibold text-primary active:bg-line"
          >
            삭제
          </button>
        )}
        <button
          type="submit"
          disabled={!canSave}
          className="min-h-12 flex-1 rounded-button bg-primary text-[16px] font-semibold text-ink active:bg-primary-press disabled:opacity-50"
        >
          {pending ? '저장 중…' : tag ? '저장' : '만들기'}
        </button>
      </div>
      {tag && (
        <ConfirmSheet
          open={confirmDelete}
          title={`#${tag.name} 태그를 삭제할까요?`}
          message="할일에서 이 태그만 빠지고, 할일은 그대로 남아요."
          confirmLabel="삭제"
          pending={deleteTag.isPending}
          onConfirm={onDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </form>
  )
}
