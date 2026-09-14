// D-day·지남 표시가 시간 경과에 맞게 바뀌도록 현재 시각을 주기적으로 갱신한다
import { useEffect, useState } from 'react'

export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return now
}
