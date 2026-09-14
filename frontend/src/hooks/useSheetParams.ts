// Design Ref: §5.2 시트 상태 — URL 검색 파라미터로 시트를 열고, 앱 안에서 연 시트는 뒤로가기로 닫는다
import { useLocation, useNavigate, useSearchParams } from 'react-router'

/** 시트용 파라미터. 달력 선택일(?date=)은 화면 상태라 여기 포함하지 않는다 */
const SHEET_KEYS = ['new', 'task', 'project', 'project-edit'] as const

export function useSheetParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  const openSheet = (params: Record<string, string>) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        SHEET_KEYS.forEach((key) => next.delete(key))
        Object.entries(params).forEach(([key, value]) => next.set(key, value))
        return next
      },
      { state: { sheet: true } },
    )
  }

  const closeSheet = () => {
    if ((location.state as { sheet?: boolean } | null)?.sheet) {
      navigate(-1)
      return
    }
    // 새로고침·직접 링크로 열린 시트는 되돌아갈 기록이 없으므로 파라미터만 지운다
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        SHEET_KEYS.forEach((key) => next.delete(key))
        return next
      },
      { replace: true },
    )
  }

  return { searchParams, openSheet, closeSheet }
}
