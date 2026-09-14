// Design Ref: §5.4 Settings/백업 — 지금 백업, 최근 백업 목록, JSON 내보내기, JSON 가져오기(확인 시트)
import { DatabaseBackup, Download, Upload } from 'lucide-react'
import { type ChangeEvent, useRef, useState } from 'react'

import { ApiError } from '@/api/client'
import { EXPORT_URL, useBackups, useCreateBackup, useImportData } from '@/api/queries'
import { ConfirmSheet } from '@/components/ConfirmSheet'
import { SectionHeader } from '@/components/SectionHeader'
import { useToast } from '@/components/Toast'
import { formatBytes, formatDateTime } from '@/lib/format'

const MAX_IMPORT_BYTES = 10 * 1024 * 1024
const RECENT_BACKUPS = 5
const actionClass =
  'flex min-h-12 items-center justify-center gap-2 rounded-button bg-surface-2 text-body font-semibold text-ink active:bg-line disabled:opacity-50'

export function BackupSection() {
  const backups = useBackups()
  const createBackup = useCreateBackup()
  const importData = useImportData()
  const { showToast } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<{ fileName: string; payload: unknown } | null>(null)

  const onFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_IMPORT_BYTES) {
      showToast({ message: '파일이 너무 커요 (최대 10MB)', tone: 'error' })
      return
    }
    try {
      setPendingImport({ fileName: file.name, payload: JSON.parse(await file.text()) })
    } catch {
      showToast({ message: 'JSON 파일을 읽을 수 없어요', tone: 'error' })
    }
  }

  const runBackup = () =>
    createBackup.mutate(undefined, {
      onSuccess: (backup) => showToast({ message: `백업했어요 · ${backup.name}` }),
      onError: () => showToast({ message: '백업하지 못했어요', tone: 'error' }),
    })

  const runImport = () => {
    if (!pendingImport) return
    importData.mutate(pendingImport.payload, {
      onSuccess: (result) => {
        setPendingImport(null)
        showToast({ message: `가져왔어요 · 프로젝트 ${result.projects}, 할일 ${result.tasks}` })
      },
      onError: (error) =>
        showToast({ message: error instanceof ApiError ? error.message : '가져오지 못했어요', tone: 'error' }),
    })
  }

  const recent = backups.data?.slice(0, RECENT_BACKUPS) ?? []

  return (
    <div>
      <SectionHeader title="백업" />
      <div className="rounded-card bg-surface p-4">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={runBackup} disabled={createBackup.isPending} className={actionClass}>
            <DatabaseBackup size={18} aria-hidden />
            {createBackup.isPending ? '백업 중…' : '지금 백업'}
          </button>
          <a href={EXPORT_URL} download className={actionClass}>
            <Download size={18} aria-hidden />
            JSON 내보내기
          </a>
          <button type="button" onClick={() => fileInput.current?.click()} className={`col-span-2 ${actionClass}`}>
            <Upload size={18} aria-hidden />
            JSON 가져오기
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void onFileSelected(event)}
          />
        </div>

        <p className="mt-5 mb-2 text-meta font-semibold text-ink-sub">최근 백업 (매일 자동, 14일 보관)</p>
        {backups.isPending && <p className="text-body text-ink-sub">불러오는 중…</p>}
        {backups.isSuccess && recent.length === 0 && <p className="text-body text-ink-sub">아직 백업이 없어요</p>}
        {recent.length > 0 && (
          <ul className="flex flex-col gap-2">
            {recent.map((backup) => (
              <li key={backup.name} className="flex items-center justify-between gap-3 text-meta">
                <span className="min-w-0 truncate text-ink">{backup.name}</span>
                <span className="shrink-0 text-ink-sub">
                  {formatBytes(backup.size)} · {formatDateTime(backup.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmSheet
        open={pendingImport !== null}
        title="데이터를 가져올까요?"
        message={`${pendingImport?.fileName ?? ''} 파일로 현재 데이터가 모두 교체돼요. 가져오기 직전에 자동으로 백업해요.`}
        confirmLabel="가져오기"
        pending={importData.isPending}
        onConfirm={runImport}
        onClose={() => setPendingImport(null)}
      />
    </div>
  )
}
