// 표시용 포맷 순수 함수 (React 비의존)
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** "2026-09-25" → "9/25(금)" */
export const formatShortDate = (isoDate: string) => format(parseISO(isoDate), 'M/d(EEE)', { locale: ko })

/** ISO 타임스탬프 → 기기 로컬 기준 "9/14 10:22" */
export const formatDateTime = (timestamp: string) => format(parseISO(timestamp), 'M/d HH:mm')
