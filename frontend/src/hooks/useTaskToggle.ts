// Plan SC: 할일 추가→완료 3탭 이내 — 체크 1탭으로 완료하고, 토스트의 "실행 취소"로 되돌린다
import { useCompleteTask, useUncompleteTask } from '@/api/queries'
import type { Task } from '@/api/types'
import { useToast } from '@/components/Toast'
import { formatShortDate } from '@/lib/format'

export function useTaskToggle() {
  const complete = useCompleteTask()
  const uncomplete = useUncompleteTask()
  const { showToast } = useToast()

  const notifyFailure = () => showToast({ message: '저장에 실패했어요', tone: 'error' })

  return (task: Task) => {
    if (task.completed_at) {
      uncomplete.mutate(task.id, { onError: notifyFailure })
      return
    }
    complete.mutate(task.id, {
      onSuccess: (result) => {
        const nextDue = result.spawned_task?.due_date
        showToast({
          message: nextDue ? `완료했어요 · 다음 ${formatShortDate(nextDue)}` : '완료했어요',
          actionLabel: '실행 취소',
          onAction: () => uncomplete.mutate(task.id, { onError: notifyFailure }),
        })
      },
      onError: notifyFailure,
    })
  }
}
