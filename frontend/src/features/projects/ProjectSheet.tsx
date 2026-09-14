// Design Ref: §5.3 ProjectSheet — 프로젝트 생성·수정 (이름, 색). ?project-edit=new | ID 로 열린다.
import { type FormEvent, useState } from 'react'

import { ApiError } from '@/api/client'
import { useCreateProject, useProjects, useUpdateProject } from '@/api/queries'
import type { Project } from '@/api/types'
import { BottomSheet } from '@/components/BottomSheet'
import { ColorPicker } from '@/components/ColorPicker'
import { Field } from '@/components/Field'
import { useToast } from '@/components/Toast'
import { useSheetParams } from '@/hooks/useSheetParams'
import { DEFAULT_PROJECT_COLOR } from '@/lib/colors'

export function ProjectSheet() {
  const { searchParams, closeSheet } = useSheetParams()
  const param = searchParams.get('project-edit')
  const projects = useProjects(true)

  // 닫히는 애니메이션 동안 마지막 내용을 유지한다
  const [active, setActive] = useState<string | null>(null)
  if (param !== null && param !== active) setActive(param)

  const isNew = active === 'new'
  const project = active && !isNew ? projects.data?.find((p) => p.id === Number(active)) : undefined

  return (
    <BottomSheet open={param !== null} onClose={closeSheet} title={isNew ? '새 프로젝트' : '프로젝트 수정'}>
      {active && (isNew || project) && <ProjectForm key={active} project={project ?? null} onDone={closeSheet} />}
      {active && !isNew && projects.isSuccess && !project && (
        <p className="py-10 text-center text-body text-ink-sub">프로젝트를 찾을 수 없어요</p>
      )}
    </BottomSheet>
  )
}

function ProjectForm({ project, onDone }: { project: Project | null; onDone: () => void }) {
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const { showToast } = useToast()
  const [name, setName] = useState(project?.name ?? '')
  const [color, setColor] = useState(project?.color ?? DEFAULT_PROJECT_COLOR)
  const [error, setError] = useState<string>()

  const pending = createProject.isPending || updateProject.isPending
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

    if (project) {
      updateProject.mutate({ id: project.id, patch: input }, { onSuccess: onSuccess('저장했어요'), onError })
    } else {
      createProject.mutate(input, { onSuccess: onSuccess('프로젝트를 만들었어요'), onError })
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label="이름" htmlFor="project-name" error={error}>
        <input
          id="project-name"
          data-autofocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={50}
          placeholder="예: 회사, 사이드 프로젝트"
          autoComplete="off"
          enterKeyHint="done"
          className="h-12 w-full rounded-card bg-surface-2 px-4 text-ink placeholder:text-ink-dim focus:outline-none focus-visible:outline-2 focus-visible:outline-toggle"
        />
      </Field>
      <Field label="색상">
        <ColorPicker value={color} onChange={setColor} label="프로젝트 색상" />
      </Field>
      <button
        type="submit"
        disabled={!canSave}
        className="min-h-12 rounded-button bg-primary text-[16px] font-semibold text-ink active:bg-primary-press disabled:opacity-50"
      >
        {pending ? '저장 중…' : project ? '저장' : '만들기'}
      </button>
    </form>
  )
}
