// Design Ref: §5.4 Settings — 태그 / 보관된 프로젝트 / 백업 / 정보(버전, 설치 안내) / 로그아웃
import { useLogout } from '@/api/queries'
import { SectionHeader } from '@/components/SectionHeader'

import { ArchivedSection } from './ArchivedSection'
import { BackupSection } from './BackupSection'
import { TagsSection } from './TagsSection'

export function SettingsPage() {
  const logout = useLogout()

  return (
    <section className="screen-x">
      <h1 className="text-title font-bold">설정</h1>

      <TagsSection />
      <ArchivedSection />
      <BackupSection />

      <SectionHeader title="정보" />
      <div className="rounded-card bg-surface p-4">
        <p className="flex justify-between text-body">
          <span>버전</span>
          <span className="text-ink-sub">{__APP_VERSION__}</span>
        </p>
        <p className="mt-3 text-meta leading-relaxed text-ink-sub">
          홈 화면에 설치하면 앱처럼 쓸 수 있어요. iPhone은 Safari에서 공유 → ‘홈 화면에 추가’, Android와 PC는 Chrome
          주소창의 ‘앱 설치’를 누르세요.
        </p>
      </div>

      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="mt-8 min-h-12 w-full rounded-card bg-surface text-body font-semibold text-primary active:bg-surface-2 disabled:opacity-50"
      >
        로그아웃
      </button>
    </section>
  )
}
