// Design Ref: §8.1 — L2(화면 동작)·L3(사용자 흐름) E2E. 모바일(Pixel 7) 크기의 Chromium에서 실행한다.
import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 8787)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`
export const STORAGE_STATE = 'e2e/.auth/state.json'

export default defineConfig({
  testDir: './e2e',
  // 모든 테스트가 같은 seed DB를 쓰므로 순서대로 한 개씩 실행한다
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  expect: { timeout: 5_000 },
  use: {
    baseURL: BASE_URL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'mobile',
      testMatch: /.*\.spec\.ts/,
      use: { ...devices['Pixel 7'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],
  // E2E_BASE_URL을 주면(예: docker compose 로컬 서버) 서버를 따로 띄우지 않는다
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'bash e2e/start-server.sh',
        url: `${BASE_URL}/api/health`,
        reuseExistingServer: false,
        timeout: 60_000,
        env: { E2E_PORT: String(PORT) },
      },
})
