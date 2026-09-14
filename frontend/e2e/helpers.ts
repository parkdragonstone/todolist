// E2E 공용 헬퍼 — 앱 구조(SectionHeader, TaskItem, BottomSheet)에 맞춘 선택자
import { expect, type Locator, type Page } from '@playwright/test'

export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-password'

/** 테스트끼리 같은 DB를 쓰므로 제목이 겹치지 않게 만든다 */
export function uniqueTitle(prefix: string): string {
  return `${prefix} ${Date.now().toString(36).slice(-5)}`
}

/** 로컬 날짜(YYYY-MM-DD). 테스트 머신과 브라우저 모두 Asia/Seoul 기준 */
export function isoDate(offsetDays = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 홈 화면의 마감 그룹 섹션 (예: "오늘", "내일") — 제목(h2)과 할일 목록(ul)을 함께 감싼 요소 */
export function groupSection(page: Page, label: string): Locator {
  return page
    .locator('main div')
    .filter({ has: page.getByRole('heading', { level: 2, name: new RegExp(`^${label}\\d*$`) }) })
    .filter({ has: page.locator('ul') })
    .first()
}

/** 할일 카드(li)를 제목으로 찾는다 */
export function taskItem(scope: Page | Locator, title: string): Locator {
  return scope.locator('li').filter({ hasText: title })
}

export function sheet(page: Page): Locator {
  return page.getByRole('dialog')
}

export async function openNewTaskSheet(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: '할일 추가' }).click()
  const dialog = sheet(page)
  await expect(dialog.getByRole('heading', { name: '새 할일' })).toBeVisible()
  return dialog
}

export async function saveSheet(dialog: Locator): Promise<void> {
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog).toBeHidden()
}
