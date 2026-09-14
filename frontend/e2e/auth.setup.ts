// 한 번 로그인한 세션(쿠키)을 저장해 두고 모든 E2E 테스트에서 재사용한다 (로그인 레이트리밋 회피)
import { expect, test as setup } from '@playwright/test'

import { STORAGE_STATE } from '../playwright.config'
import { E2E_PASSWORD } from './helpers'

setup('login once and store session', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('비밀번호').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page.getByRole('heading', { name: '할일', level: 1 })).toBeVisible()
  await page.context().storageState({ path: STORAGE_STATE })
})
