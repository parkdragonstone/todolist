// Design Ref: §8.4 L3 — 여러 화면을 잇는 사용자 흐름 (5개)
import { expect, test } from '@playwright/test'

import { STORAGE_STATE } from '../playwright.config'
import { groupSection, isoDate, openNewTaskSheet, saveSheet, taskItem, uniqueTitle } from './helpers'

test('L3-1 프로젝트 생성 → 할일 추가(오늘 23:59·높음·새 태그) → 홈 오늘 섹션에서 확인', async ({ page }) => {
  const projectName = uniqueTitle('E2E 프로젝트')
  const tagName = `e2e${Date.now().toString(36).slice(-4)}`
  const title = uniqueTitle('첫 할일')

  await page.goto('/projects')
  await page.getByRole('button', { name: '새 프로젝트' }).click()
  const projectSheet = page.getByRole('dialog')
  await projectSheet.getByLabel('이름').fill(projectName)
  await projectSheet.getByRole('button', { name: '만들기' }).click()
  await expect(projectSheet).toBeHidden()

  await page.getByRole('link', { name: new RegExp(projectName) }).click()
  await expect(page.getByRole('heading', { level: 1, name: projectName })).toBeVisible()

  const dialog = await openNewTaskSheet(page)
  await expect(dialog.locator('#task-project option:checked')).toHaveText(projectName)
  await dialog.getByLabel('할일 제목').fill(title)
  await dialog.getByRole('button', { name: '오늘', exact: true }).click()
  await dialog.getByLabel('마감 시간').fill('23:59')
  await dialog.getByRole('radio', { name: '높음' }).click()
  await dialog.getByRole('button', { name: '새 태그' }).click()
  await dialog.getByLabel('새 태그 이름').fill(tagName)
  await dialog.getByLabel('새 태그 이름').press('Enter')
  await expect(dialog.getByRole('button', { name: tagName })).toHaveAttribute('aria-pressed', 'true')
  await saveSheet(dialog)

  await page.getByRole('link', { name: '할일', exact: true }).click()
  const item = taskItem(groupSection(page, '오늘'), title)
  await expect(item).toBeVisible()
  await expect(item).toContainText(projectName)
  await expect(item).toContainText('오늘 23:59')
  await expect(item).toContainText(tagName)
  await expect(item.getByRole('img', { name: '우선순위 높음' })).toBeVisible()
})

test('L3-2 매주 반복 할일을 완료하면 다음 주 회차가 생기고, 완료를 취소하면 사라진다', async ({ page }) => {
  const title = uniqueTitle('매주 반복')
  const today = isoDate(0)
  const nextWeek = isoDate(7)

  await page.goto('/')
  const dialog = await openNewTaskSheet(page)
  await dialog.getByLabel('할일 제목').fill(title)
  await dialog.getByRole('button', { name: '오늘', exact: true }).click()
  await dialog.getByRole('radio', { name: '매주' }).click()
  await expect(dialog.getByText(/^매주 · /)).toBeVisible()
  await saveSheet(dialog)

  await taskItem(groupSection(page, '오늘'), title).getByRole('checkbox').click()
  await expect(page.getByRole('status')).toContainText('다음')

  await page.goto(`/calendar?date=${nextWeek}`)
  await expect(taskItem(page.locator('main'), title)).toBeVisible()

  await page.goto(`/calendar?date=${today}`)
  const original = taskItem(page.locator('main'), title)
  await expect(original.getByRole('checkbox', { name: `${title} 완료 취소` })).toBeVisible()
  const undone = page.waitForResponse((r) => /\/uncomplete$/.test(r.url()))
  await original.getByRole('checkbox').click()
  expect((await undone).status()).toBe(200)
  await expect(original.getByRole('checkbox', { name: `${title} 완료`, exact: true })).toBeVisible()

  await page.goto(`/calendar?date=${nextWeek}`)
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible()
  await expect(taskItem(page.locator('main'), title)).toHaveCount(0)
})

test('L3-3 한 기기에서 추가한 할일이 다른 기기에서 앱으로 돌아오면 2초 안에 보인다', async ({ browser }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL
  const deviceA = await browser.newContext({ baseURL, storageState: STORAGE_STATE })
  const deviceB = await browser.newContext({ baseURL, storageState: STORAGE_STATE })
  const pageA = await deviceA.newPage()
  const pageB = await deviceB.newPage()

  await pageB.goto('/')
  await expect(pageB.getByRole('heading', { level: 1, name: '할일' })).toBeVisible()

  const title = uniqueTitle('동기화')
  await pageA.goto('/')
  const dialog = await openNewTaskSheet(pageA)
  await dialog.getByLabel('할일 제목').fill(title)
  await dialog.getByRole('button', { name: '오늘', exact: true }).click()
  await saveSheet(dialog)

  // Plan SC: 기기 간 반영 ≤ 2초 — 기기 B가 앱으로 돌아온 순간(visibilitychange)을 재현
  const started = Date.now()
  await pageB.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
  await expect(taskItem(pageB, title)).toBeVisible({ timeout: 2_000 })
  expect(Date.now() - started).toBeLessThan(2_000)

  await deviceA.close()
  await deviceB.close()
})

test('L3-4 세션 쿠키가 사라지면 다음 요청에서 로그인 화면으로 이동한다', async ({ page, context }) => {
  await page.goto('/projects')
  await expect(page.getByRole('heading', { level: 1, name: '프로젝트' })).toBeVisible()

  await context.clearCookies()
  await page.getByRole('link', { name: '달력', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: '로그인' })).toBeVisible()
})

test('L3-5 JSON 내보내기 → 할일 삭제 → 가져오기로 복원된다', async ({ page }) => {
  const title = uniqueTitle('백업 왕복')
  await page.goto('/')
  const dialog = await openNewTaskSheet(page)
  await dialog.getByLabel('할일 제목').fill(title)
  await saveSheet(dialog)
  await expect(taskItem(page, title)).toBeVisible()

  await page.goto('/settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'JSON 내보내기' }).click()
  const exportFile = testInfo().outputPath('export.json')
  await (await downloadPromise).saveAs(exportFile)

  await page.goto('/')
  await taskItem(page, title).getByRole('button').first().click()
  const editSheet = page.getByRole('dialog').filter({ hasText: '할일 수정' })
  await editSheet.getByRole('button', { name: '삭제' }).click()
  const confirmDelete = page.getByRole('dialog').filter({ hasText: '할일을 삭제할까요?' })
  await confirmDelete.getByRole('button', { name: '삭제' }).click()
  await expect(taskItem(page, title)).toHaveCount(0)

  await page.goto('/settings')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'JSON 가져오기' }).click()
  await (await chooser).setFiles(exportFile)
  const confirmImport = page.getByRole('dialog').filter({ hasText: '데이터를 가져올까요?' })
  const imported = page.waitForResponse((r) => r.url().endsWith('/api/import'))
  await confirmImport.getByRole('button', { name: '가져오기' }).click()
  expect((await imported).status()).toBe(200)
  await expect(page.getByRole('status')).toContainText('가져왔어요')

  await page.goto('/')
  await expect(taskItem(page, title)).toBeVisible()
})

function testInfo() {
  return test.info()
}
