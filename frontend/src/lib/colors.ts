// Design Ref: §5.0 Project/Tag Preset — 사용자가 고르는 데이터 색상 (UI 토큰과 별개)
export const PRESET_COLORS = [
  '#F23D52',
  '#FF8A3D',
  '#F9C23C',
  '#3DD68C',
  '#2FB4E0',
  '#5157E6',
  '#A06CF0',
  '#F26BB5',
] as const

export const DEFAULT_PROJECT_COLOR = PRESET_COLORS[0]
export const DEFAULT_TAG_COLOR = PRESET_COLORS[4]

export const PRIORITY_LABELS = ['없음', '낮음', '보통', '높음'] as const
