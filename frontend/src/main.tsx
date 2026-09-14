// Design Ref: §5.6 — QueryClient 기본값(포커스 복귀 재조회), 401 전역 처리, 폰트·스타일 로드
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './styles/index.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

import { ApiError, setUnauthorizedHandler } from './api/client'
import { resetToLoggedOut } from './api/queries'
import { App } from './App'
import { ToastProvider } from './components/Toast'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      // Plan SC: 기기 간 반영 ≤ 2초 — 앱으로 돌아오면 staleTime과 관계없이 항상 다시 불러온다
      refetchOnWindowFocus: 'always',
      refetchOnReconnect: true,
      retry: (failureCount, error) =>
        error instanceof ApiError && error.status >= 500 && failureCount < 2,
    },
    mutations: { retry: false },
  },
})

// 세션이 만료되면 로그인 상태를 false로 바꾸고 나머지 캐시를 비운다 → AppShell이 /login으로 보낸다
setUnauthorizedHandler(() => resetToLoggedOut(queryClient))

// Design Ref: §5.5 — 새 버전을 배포하면 서비스워커를 즉시 교체하고 페이지를 새로고침한다
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
