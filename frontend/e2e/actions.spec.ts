// Design Ref: §8.3 L2 — 화면별 동작 → 결과 (12개). seed 데이터 기준.
import { expect, test } from '@playwright/test'

import { groupSection, isoDate, openNewTaskSheet, saveSheet, sheet, taskItem, uniqueTitle } from './helpers'

test.describe('로그인', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('L2-1 틀린 비밀번호는 오류 문구를 보여준다', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('비밀번호').fill('wrong-password')
    const response = page.waitForResponse((r) => r.url().endsWith('/api/auth/login'))
    await page.getByRole('button', { name: '로그인' }).click()
    expect((await response).status()).toBe(401)
    await expect(page.getByRole('alert')).toHaveText('비밀번호가 맞지 않아요')
  })
})

test('L2-2 할일 홈에 요약 카드, 마감 그룹, 할일이 보인다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/^오늘 \d+개/)).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: /^지남/ })).toBeVisible()
  await expect(taskItem(groupSection(page, '지남'), '세금 계산서 발행')).toBeVisible()
})

test('L2-3 체크하면 토스트가 뜨고 목록에서 사라진다', async ({ page }) => {
  await page.goto('/')
  const completed = page.waitForResponse((r) => /\/api\/tasks\/\d+\/complete$/.test(r.url()))
  await page.getByRole('checkbox', { name: '장보기 완료', exact: true }).click()
  expect((await completed).status()).toBe(200)
  await expect(page.getByRole('status')).toContainText('완료했어요')
  await expect(page.getByRole('checkbox', { name: '장보기 완료', exact: true })).toHaveCount(0)
})

test('L2-4 토스트의 실행 취소로 완료를 되돌린다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('checkbox', { name: 'API 설계 문서 완료', exact: true }).click()
  const toast = page.getByRole('status')
  await expect(toast).toContainText('완료했어요')
  const undone = page.waitForResponse((r) => /\/api\/tasks\/\d+\/uncomplete$/.test(r.url()))
  await toast.getByRole('button', { name: '실행 취소' }).click()
  expect((await undone).status()).toBe(200)
  await expect(page.getByRole('checkbox', { name: 'API 설계 문서 완료', exact: true })).toBeVisible()
})

test('L2-5 [높음] 필터를 켜면 높음 우선순위 할일만 남는다', async ({ page }) => {
  await page.goto('/')
  const items = page.locator('main li')
  await expect(items.first()).toBeVisible()
  const before = await items.count()

  await page.getByRole('group', { name: '필터' }).getByRole('button', { name: '높음' }).click()
  await expect.poll(() => items.count()).toBeLessThan(before)
  const after = await items.count()
  expect(after).toBeGreaterThan(0)
  await expect(page.locator('main li').getByRole('img', { name: '우선순위 높음' })).toHaveCount(after)
})

test('L2-6 제목 입력 → [내일] → 저장하면 내일 섹션에 추가된다', async ({ page }) => {
  await page.goto('/')
  const title = uniqueTitle('내일 할일')
  const dialog = await openNewTaskSheet(page)
  await dialog.getByLabel('할일 제목').fill(title)
  await dialog.getByRole('button', { name: '내일', exact: true }).click()

  const created = page.waitForResponse((r) => r.url().endsWith('/api/tasks') && r.request().method() === 'POST')
  await saveSheet(dialog)
  expect((await created).status()).toBe(201)
  await expect(taskItem(groupSection(page, '내일'), title)).toBeVisible()
})

test('L2-7 마감 날짜가 없으면 반복을 고를 수 없고 안내가 보인다', async ({ page }) => {
  await page.goto('/')
  const dialog = await openNewTaskSheet(page)
  await expect(dialog.getByText('반복하려면 먼저 마감 날짜를 정해주세요')).toBeVisible()
  await expect(dialog.getByRole('radio', { name: '매일' })).toBeDisabled()

  await dialog.getByRole('button', { name: '오늘', exact: true }).click()
  await expect(dialog.getByRole('radio', { name: '매일' })).toBeEnabled()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('L2-8 프로젝트 상세에서 [우선순위] 정렬하면 높은 우선순위가 맨 위에 온다', async ({ page }) => {
  await page.goto('/projects')
  await page.getByRole('link', { name: /회사/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: '회사' })).toBeVisible()

  await page.getByRole('radio', { name: '우선순위' }).click()
  await expect(page.getByRole('radio', { name: '우선순위' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('main ul li').first().getByRole('img', { name: '우선순위 높음' })).toBeVisible()
})

test('L2-9 완료 항목 보기를 켜면 완료 섹션이 나온다', async ({ page }) => {
  await page.goto('/projects')
  await page.getByRole('link', { name: /사이드 프로젝트/ }).click()
  await page.getByRole('switch', { name: '완료 항목 보기' }).click()
  await expect(page.getByRole('heading', { level: 2, name: /^완료/ })).toBeVisible()
  await expect(taskItem(page, '개발 환경 설정')).toBeVisible()
})

test('L2-10 달력에서 다음 달로 이동하면 새 기간을 불러온다', async ({ page }) => {
  await page.goto('/calendar')
  // 요일 줄은 일요일부터 시작한다
  await expect(page.locator('main div[aria-hidden]').first()).toHaveText('일월화수목금토')
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const refetch = page.waitForResponse((r) => r.url().includes('/api/calendar'))
  await page.getByRole('button', { name: '다음 달' }).click()
  expect((await refetch).status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${next.getFullYear()}년 ${next.getMonth() + 1}월`)
})

test('L2-11 달력에서 날짜를 고르고 + 를 누르면 그 날짜가 마감으로 채워진다', async ({ page }) => {
  const target = isoDate(2)
  const [year, month, day] = target.split('-').map(Number)
  await page.goto('/calendar')

  const now = new Date()
  if (year !== now.getFullYear() || month !== now.getMonth() + 1) {
    await page.getByRole('button', { name: '다음 달' }).click()
  }
  await page.getByRole('button', { name: new RegExp(`^${month}월 ${day}일 \\(`) }).click()
  await expect(page).toHaveURL(new RegExp(`date=${target}`))

  const dialog = await openNewTaskSheet(page)
  await expect(dialog.getByLabel('마감 날짜 선택')).toHaveValue(target)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('L2-13 달력에서 공휴일·일요일은 빨강, 토요일은 청록이고 공휴일은 목록 맨 위에 보인다', async ({ page }) => {
  // 2026-10-03(토) 개천절, 10-04(일), 10-10(토). 선택일(indigo) 스타일과 겹치지 않게 10-15(목)를 선택해 둔다
  await page.goto('/calendar?date=2026-10-15')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('2026년 10월')

  const dayButton = (label: RegExp) => page.getByRole('button', { name: label })
  const dayNumber = (label: RegExp) => dayButton(label).locator('span').first()
  await expect(dayNumber(/^10월 3일 \(토\), 개천절/)).toHaveClass(/text-primary/)
  await expect(dayNumber(/^10월 4일 \(일\)/)).toHaveClass(/text-primary/)
  await expect(dayNumber(/^10월 10일 \(토\)/)).toHaveClass(/text-toggle/)
  await expect(page.getByRole('list', { name: '공휴일' })).toHaveCount(0)

  await dayButton(/^10월 3일 \(토\), 개천절/).click()
  await expect(page.getByRole('list', { name: '공휴일' })).toContainText('개천절')
})

test('L2-12 설정에서 새 태그를 만들면 목록에 추가된다', async ({ page }) => {
  await page.goto('/settings')
  const name = `태그${Date.now().toString(36).slice(-5)}`

  await page.getByRole('button', { name: '+ 새 태그' }).click()
  const dialog = sheet(page)
  await dialog.getByLabel('이름').fill(name)
  const created = page.waitForResponse((r) => r.url().endsWith('/api/tags') && r.request().method() === 'POST')
  await dialog.getByRole('button', { name: '만들기' }).click()
  expect((await created).status()).toBe(201)
  await expect(page.getByRole('button', { name: new RegExp(`#${name}`) })).toBeVisible()
})
