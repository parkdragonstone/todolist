// Design Ref: §5.4 Home — 요약 카드, 필터 칩(전체/높음/태그), 마감 그룹 섹션, 완료 토스트
import { Flag, PartyPopper } from 'lucide-react'
import { useState } from 'react'

import { useTags, useUpcoming } from '@/api/queries'
import { GROUP_KEYS, type GroupKey } from '@/api/types'
import { EmptyState } from '@/components/EmptyState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { SectionHeader } from '@/components/SectionHeader'
import { Chip, TagChip } from '@/components/TagChip'
import { TaskItem } from '@/components/TaskItem'
import { useNow } from '@/hooks/useNow'
import { useTaskToggle } from '@/hooks/useTaskToggle'
import { formatHeaderDate } from '@/lib/date'
import { toggleId } from '@/lib/task'

const GROUP_LABELS: Record<GroupKey, string> = {
  overdue: '지남',
  today: '오늘',
  tomorrow: '내일',
  this_week: '이번 주',
  later: '이후',
  no_due: '기한 없음',
}

export function HomePage() {
  const now = useNow()
  const toggle = useTaskToggle()
  const tags = useTags()
  const [highOnly, setHighOnly] = useState(false)
  const [tagIds, setTagIds] = useState<number[]>([])

  const filtered = highOnly || tagIds.length > 0
  const upcoming = useUpcoming({
    priority: highOnly ? 3 : undefined,
    tag_id: tagIds.length > 0 ? tagIds : undefined,
  })
  const data = upcoming.data
  const counts = data?.counts
  const openTotal = counts ? GROUP_KEYS.reduce((sum, key) => sum + counts[key], 0) : 0

  const clearFilters = () => {
    setHighOnly(false)
    setTagIds([])
  }

  return (
    <section className="screen-x">
      <header>
        <h1 className="text-title font-bold">할일</h1>
        <p className="mt-1 text-body text-ink-sub">{formatHeaderDate(now)}</p>
      </header>

      <div className="mt-5 rounded-card bg-surface p-4" aria-live="polite">
        {counts ? (
          <>
            <p className="text-section font-semibold">
              오늘 {counts.today}개<span className="mx-1.5 text-ink-dim">·</span>
              <span className={counts.overdue > 0 ? 'text-primary' : 'text-ink-sub'}>
                지난 할일 {counts.overdue}개
              </span>
            </p>
            <p className="mt-1 text-meta text-ink-sub">
              {filtered ? '필터 적용 중 · ' : ''}남은 할일 {openTotal}개
            </p>
          </>
        ) : (
          <div className="h-11 animate-pulse rounded-button bg-surface-2" />
        )}
      </div>

      <div role="group" aria-label="필터" className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        <Chip selected={!filtered} onClick={clearFilters}>
          전체
        </Chip>
        <Chip selected={highOnly} onClick={() => setHighOnly((value) => !value)}>
          <Flag size={14} aria-hidden className="fill-current text-prio-high" />
          높음
        </Chip>
        {tags.data?.map((tag) => (
          <TagChip
            key={tag.id}
            tag={tag}
            selected={tagIds.includes(tag.id)}
            onClick={() => setTagIds((ids) => toggleId(ids, tag.id))}
          />
        ))}
      </div>

      {upcoming.isPending && <ListSkeleton rows={4} />}
      {upcoming.isError && <p className="mt-6 text-body text-primary">할일을 불러오지 못했어요</p>}

      {data && openTotal === 0 && (
        <EmptyState
          icon={PartyPopper}
          title={filtered ? '조건에 맞는 할일이 없어요' : '할 일을 모두 끝냈어요'}
          description={filtered ? undefined : '+ 버튼으로 새 할일을 추가해보세요'}
        />
      )}

      {data &&
        GROUP_KEYS.filter((key) => data.groups[key].length > 0).map((key) => (
          <div key={key}>
            <SectionHeader
              title={GROUP_LABELS[key]}
              count={data.groups[key].length}
              tone={key === 'overdue' ? 'danger' : 'default'}
            />
            <ul className="flex flex-col gap-2">
              {data.groups[key].map((task) => (
                <TaskItem key={task.id} task={task} now={now} onToggle={toggle} />
              ))}
            </ul>
          </div>
        ))}
    </section>
  )
}
