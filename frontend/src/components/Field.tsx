// 시트 폼의 필드 레이블 + 필드 오류 (서버 400 field_errors 표시)
import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  htmlFor?: string
  error?: string
  children: ReactNode
}

export function Field({ label, htmlFor, error, children }: FieldProps) {
  const labelClass = 'mb-2 block text-meta font-semibold text-ink-sub'
  return (
    <div>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <p className={labelClass}>{label}</p>
      )}
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-meta text-primary">
          {error}
        </p>
      )}
    </div>
  )
}
