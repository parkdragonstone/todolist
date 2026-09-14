// 목록 로딩 중 자리표시 (스켈레톤)
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul aria-busy="true" aria-label="불러오는 중" className="mt-3 flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="h-16 animate-pulse rounded-card bg-surface" />
      ))}
    </ul>
  )
}
