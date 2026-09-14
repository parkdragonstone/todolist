// Design Ref: §5.4 Settings/보관된 프로젝트 — 목록 + 복원
import { useProjects, useUpdateProject } from '@/api/queries'
import { SectionHeader } from '@/components/SectionHeader'
import { useToast } from '@/components/Toast'

export function ArchivedSection() {
  const projects = useProjects(true)
  const updateProject = useUpdateProject()
  const { showToast } = useToast()
  const archived = projects.data?.filter((project) => project.archived) ?? []

  return (
    <div>
      <SectionHeader title="보관된 프로젝트" count={archived.length} />
      {archived.length === 0 ? (
        <p className="rounded-card bg-surface p-4 text-body text-ink-sub">보관된 프로젝트가 없어요</p>
      ) : (
        <ul className="overflow-hidden rounded-card bg-surface">
          {archived.map((project, index) => (
            <li
              key={project.id}
              className={`flex min-h-13 items-center gap-3 px-4 ${index > 0 ? 'border-t border-line/60' : ''}`}
            >
              <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: project.color }} />
              <span className="min-w-0 flex-1 truncate text-body">{project.name}</span>
              <button
                type="button"
                disabled={updateProject.isPending}
                onClick={() =>
                  updateProject.mutate(
                    { id: project.id, patch: { archived: false } },
                    {
                      onSuccess: () => showToast({ message: `${project.name} 프로젝트를 복원했어요` }),
                      onError: () => showToast({ message: '복원하지 못했어요', tone: 'error' }),
                    },
                  )
                }
                className="min-h-10 rounded-button bg-surface-2 px-4 text-meta font-semibold text-ink active:bg-line disabled:opacity-50"
              >
                복원
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
