# todolist Planning Document

> **Summary**: 1인 전용, 월 0원 운영을 목표로 한 프로젝트별 할일·마감·달력 PWA (Docker + SQLite, Oracle Cloud Always Free 배포)
>
> **Project**: todolist
> **Version**: 0.1.0
> **Author**: yongseok
> **Date**: 2026-09-14
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 여러 프로젝트의 할일과 마감이 흩어져 있어 "지금 무엇이 급한지"를 한눈에 보기 어렵고, PC와 폰에서 같은 목록을 쓸 수 있는 무료 도구가 없다. |
| **Solution** | FastAPI + SQLite 단일 Docker 이미지에 React PWA를 포함해 Oracle Cloud Always Free VM에 배포한다. 서버 DB 하나를 PC와 폰이 함께 쓰는 방식으로 동기화한다. |
| **Function/UX Effect** | 프로젝트별 목록, 체크 완료, 마감순 정렬(지남/오늘/이번 주/이후), 월간 달력, 우선순위·태그, 반복 할일을 Alarmy 스타일 다크 UI로 제공한다. 홈 화면에 설치해 앱처럼 쓴다. |
| **Core Value** | 월 운영비 0원으로 두 기기에서 같은 할일을 보고 처리한다. 데이터는 파일 하나(SQLite)라서 백업과 이전이 쉽다. |

---

## Context Anchor

> Auto-generated from Executive Summary. Propagated to Design/Do documents for context continuity.

| Key | Value |
|-----|-------|
| **WHY** | 흩어진 프로젝트 할일과 마감을 한 곳에서 보고 PC와 폰 어디서든 처리하기 위해 |
| **WHO** | 개발자 본인 1명 (Mac PC + 스마트폰) |
| **RISK** | Oracle Always Free VM의 유휴 회수 정책·계정 한도 변경·일본 리전 A1 재고 부족, PWA 설치에 필요한 HTTPS 구성 |
| **SUCCESS** | 월 비용 0원 / 폰 PWA 설치 후 PC와 데이터 일치 / 할일 생성부터 완료까지 3탭 이내 / 일일 자동 백업 |
| **SCOPE** | M1 백엔드·DB → M2 PWA UI(목록·프로젝트·달력) → M3 반복·태그 → M4 Docker·Oracle 배포·백업 |

---

## 1. Overview

### 1.1 Purpose

본인이 진행 중인 여러 프로젝트의 할일을 **프로젝트 단위로 관리**하고, **마감기한 기준으로 급한 순서를 파악**하며, **달력으로 일정 전체를 한눈에** 보는 개인용 앱을 만든다. PC와 폰에서 같은 데이터를 쓴다.

### 1.2 Background

- 사용자는 1명이고 데이터는 텍스트 위주라서 수 MB 이하일 것으로 예상한다. 무거운 DB 서버나 유료 BaaS는 필요 없다.
- 운영 비용은 최대한 0원이어야 한다. 앱스토어 등록비(iOS 연 $99)나 유료 호스팅은 쓰지 않는다.
- Docker로 배포해 로컬 Mac, Oracle VM, 다른 VM 어디로든 옮길 수 있어야 한다.
- 디자인은 Alarmy 앱(wwit.design 레퍼런스)의 다크 테마를 따른다.

### 1.3 User Decisions (Checkpoint 1·2 확정 사항)

| 항목 | 결정 |
|------|------|
| 배포 위치 | Oracle Cloud Always Free VM (Ampere A1, arm64), **홈 리전 일본** (Japan East 도쿄 또는 Japan Central 오사카). 한국 리전은 무료 가입 홈 리전으로 선택 불가 |
| 검토 후 제외 | Vercel + Neon/Turso (서버리스라 Docker·SQLite 파일 구조를 바꿔야 함), GCP e2-micro (미국 리전만 무료) |
| 앱 형태 | PWA 설치형 웹앱 (PC·폰 공용 코드) |
| 추가 기능 | 우선순위/태그, 반복 할일 |
| 마감 단위 | 날짜(필수) + 시간(선택) |
| 제외 | 푸시 알림, 하위 할일, 네이티브 앱(APK/iOS) |

### 1.4 Related Documents

- Design Reference: https://wwit.design/2025/04/06/alarmy/
- Oracle Always Free Resources: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- Oracle Free Tier FAQ: https://www.oracle.com/cloud/free/faq/
- Design: `docs/02-design/features/todolist.design.md` (다음 단계)

---

## 2. Scope

### 2.1 In Scope

- [ ] **프로젝트 관리**: 생성, 이름·색상 수정, 순서 변경, 보관(아카이브), 삭제
- [ ] **할일 CRUD**: 제목, 메모, 마감 날짜 + 선택 시간, 우선순위, 태그, 소속 프로젝트
- [ ] **체크 완료**: 체크로 완료/완료 취소, 완료 항목 숨김/표시 토글
- [ ] **마감 기준 정렬·그룹**: 기한 지남 / 오늘 / 내일 / 이번 주 / 이후 / 기한 없음
- [ ] **달력 뷰**: 월간 그리드에 날짜별 할일 표시(점 또는 개수), 날짜를 누르면 해당일 목록, 월 이동
- [ ] **우선순위·태그**: 높음/보통/낮음/없음, 자유 태그(색상), 태그·우선순위 필터
- [ ] **반복 할일**: 매일, 매주(요일 지정), 매월, 매년 + 간격. 완료하면 다음 회차를 자동 생성
- [ ] **동기화**: 서버 DB를 단일 원본으로 두고, 앱 포커스 복귀와 변경 직후 자동 재조회
- [ ] **PWA**: manifest, 서비스워커(앱 셸 캐시), 홈 화면 설치, 다크 스플래시/아이콘
- [ ] **1인 인증**: 환경변수로 받은 비밀번호 해시로 로그인, HttpOnly 세션 쿠키(장기), 로그인 시도 제한
- [ ] **배포**: 멀티스테이지 Dockerfile, docker-compose(app + Caddy HTTPS), Oracle VM 배포 가이드
- [ ] **백업**: SQLite 일일 자동 백업(보관 14개), 앱에서 JSON 내보내기/가져오기

### 2.2 Out of Scope

- 푸시 알림 / 마감 리마인더 (추후 확장 후보)
- 하위 할일(체크리스트)
- 오프라인 편집과 충돌 병합 (오프라인에서는 캐시된 앱 셸만 뜨고 편집은 온라인 필요)
- 네이티브 앱(Capacitor APK, iOS 앱스토어), 데스크톱 전용 앱
- 다중 사용자, 공유, 협업, 회원가입
- 외부 캘린더(Google Calendar) 연동, 첨부파일

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 프로젝트를 생성·수정(이름·색상)·삭제·보관하고 순서를 바꿀 수 있다 | High | Pending |
| FR-02 | 프로젝트 안에 할일(제목 필수, 메모·마감일·마감시간·우선순위·태그 선택)을 추가·수정·삭제할 수 있다 | High | Pending |
| FR-03 | 체크박스로 완료/완료 취소하고 완료 시각을 기록한다. 완료 항목은 기본으로 숨기고 토글로 볼 수 있다 | High | Pending |
| FR-04 | 홈(할일) 화면에서 전체 프로젝트의 미완료 할일을 마감 그룹(지남/오늘/내일/이번 주/이후/기한 없음)으로 묶어 마감 오름차순으로 보여준다 | High | Pending |
| FR-05 | 프로젝트 화면에서 정렬 기준(마감순/우선순위순/생성순)을 고를 수 있다 | High | Pending |
| FR-06 | 각 할일에 남은 기한(D-3, 오늘, D+2 지남 등)을 표시하고 지난 항목은 강조색으로 표시한다 | High | Pending |
| FR-07 | 달력 화면에 월간 그리드를 보여주고 날짜별 할일 수와 프로젝트 색 점을 표시한다. 날짜를 누르면 그날의 할일 목록을 달력 아래 패널에 보여준다 | High | Pending |
| FR-08 | 달력에서 날짜를 선택한 상태로 + 버튼을 누르면 해당 날짜가 마감으로 채워진 할일 추가 화면이 열린다 | Medium | Pending |
| FR-09 | 우선순위(높음/보통/낮음/없음)를 지정하고 우선순위로 필터링할 수 있다 | Medium | Pending |
| FR-10 | 태그를 생성(이름·색상)해 할일에 여러 개 붙이고 태그로 필터링할 수 있다 | Medium | Pending |
| FR-11 | 반복 규칙(매일/매주+요일/매월/매년, 간격 N)을 설정할 수 있고, 완료하면 다음 마감일로 새 할일을 만든다 | Medium | Pending |
| FR-12 | 비밀번호 로그인 후 세션을 유지하고(기본 90일), 로그아웃할 수 있다. 연속 실패 시 로그인이 일시 차단된다 | High | Pending |
| FR-13 | PC와 폰에서 한쪽에서 바꾼 내용이 다른 쪽 앱에 포커스를 주거나 새로고침하면 반영된다 | High | Pending |
| FR-14 | PWA로 설치할 수 있다(iOS Safari 홈 화면 추가, Android/데스크톱 Chrome 설치) | High | Pending |
| FR-15 | 전체 데이터를 JSON으로 내보내고 가져올 수 있다 | Low | Pending |
| FR-16 | 서버가 매일 SQLite 백업 파일을 만들고 최근 14개를 보관한다 | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Cost | 월 운영비 0원 (Oracle Always Free 한도 내, 무료 도메인·인증서) | Oracle 청구 대시보드, 예산 알림 |
| Performance | API p95 < 200ms, 초기 로드(캐시 후) < 1.5초 | 브라우저 DevTools, 서버 로그 |
| Footprint | 컨테이너 메모리 < 256MB, 이미지 < 300MB | `docker stats`, `docker images` |
| Portability | 같은 compose로 Mac(arm64)과 Oracle A1(arm64)에서 실행 | 로컬 및 VM 실행 확인 |
| Security | HTTPS 필수, HttpOnly·Secure·SameSite 쿠키, 비밀번호 해시, 로그인 레이트리밋, 인증 없는 API는 401 | curl 점검, OWASP 기본 체크 |
| Reliability | 데이터 손실 시 최근 24시간 이내로 복구 가능 (일일 백업) | 백업 파일로 복원 리허설 |
| Usability | 모바일 375px 폭 기준 한 손 조작, 하단 탭바, 터치 영역 44px 이상 | 실기기 확인 |
| Timezone | 모든 날짜·시간을 Asia/Seoul 로컬 기준으로 저장·표시 | 자정 경계 테스트 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] FR-01 ~ FR-14 구현 완료 (FR-15, FR-16 포함 시 전체 완료)
- [ ] 백엔드 API 테스트(pytest) 통과: CRUD, 정렬, 반복 다음 회차, 인증 401
- [ ] Oracle VM에서 HTTPS로 접속하고 폰에 PWA 설치 성공
- [ ] PC에서 추가한 할일이 폰에서 보이고, 폰에서 완료한 것이 PC에 반영됨
- [ ] README에 로컬 실행, 배포, 백업·복원 방법 문서화

### 4.2 Quality Criteria

- [ ] 백엔드 핵심 로직(정렬·반복·인증) 테스트 커버리지 80% 이상
- [ ] 프론트엔드 lint(ESLint) 오류 0, TypeScript 타입 오류 0
- [ ] `docker compose build` 성공(linux/arm64)
- [ ] Gap Analysis Match Rate ≥ 90%

### 4.3 Measurable Success Metrics

| Metric | Target |
|--------|--------|
| 월 청구액 | ₩0 |
| 할일 추가 → 완료까지 탭 수 | ≤ 3 |
| 기기 간 반영 시간(포커스 복귀 기준) | ≤ 2초 |
| 백업 보관 | 최근 14일 |

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Oracle이 유휴 인스턴스를 회수 (7일간 CPU p95·네트워크·메모리(A1) 사용률이 모두 20% 미만이면 회수 대상) | High | High | Pay-As-You-Go로 전환(유휴 회수 대상에서 제외, Always Free 한도 안에서는 과금 없음. 2026-09-14 Oracle 문서로 확인) + 예산 알림 ₩1,000 설정. 일일 백업을 VM 밖(로컬 Mac)으로도 복사 |
| Oracle 무료 한도 축소 (2026-06 A1 한도가 4 OCPU/24GB에서 2 OCPU/12GB로 줄어듦) | Medium | Medium | 앱은 1 OCPU/1~6GB로 충분하게 설계. Docker 이미지라서 GCP e2-micro나 집 Mac으로 바로 이전 가능 |
| 한국 리전(서울·춘천)을 무료 가입 홈 리전으로 고를 수 없음 | Medium | High (확인됨) | 홈 리전을 일본(도쿄/오사카)으로 선택. 한국 기준 지연은 수십 ms 수준이라 할일 앱에 영향 없음. **홈 리전은 가입 후 변경 불가**이고 Always Free 컴퓨트는 홈 리전에서만 생성 가능 |
| A1 인스턴스 생성 시 "Out of capacity" | Medium | High | 시간대를 바꿔 재시도하고 PAYG 전환 후 재시도. 대안으로 같은 홈 리전의 AMD E2.1.Micro(1GB, x86) 사용 → 멀티아키텍처 이미지(amd64+arm64)를 Mac에서 빌드해 VM으로 전송 |
| PWA 설치와 서비스워커에 HTTPS가 필수 | High | High | Caddy 자동 인증서 + 무료 DuckDNS 서브도메인. 대안은 Tailscale `serve`(사설 HTTPS). Design에서 최종 선택 |
| 인터넷에 노출된 1인 앱이 무차별 대입 공격을 받음 | High | Medium | 강한 비밀번호, argon2 해시, 로그인 레이트리밋, 보안 헤더, SSH 키 전용 로그인, OCI 보안목록은 22/80/443만 개방 |
| SQLite 파일 손상 또는 VM 디스크 유실 | High | Low | WAL 모드, `sqlite3 .backup` 기반 일일 백업, 외부 복사, JSON 내보내기 |
| iOS PWA 제약 (저장소 정리, 백그라운드 제한) | Low | Medium | 데이터는 서버에 두고 클라이언트는 캐시만 사용. 푸시는 범위 밖 |
| 반복 할일 로직의 날짜 경계 버그 (월말 31일, 윤년) | Medium | Medium | 매월 31일은 해당 월 말일로 보정. pytest로 경계값 테스트 |

---

## 6. Impact Analysis

> 신규 프로젝트(빈 디렉토리)이므로 기존 소비자가 없다.

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `projects`, `tasks`, `tags`, `task_tags` | DB Schema (SQLite) | 신규 생성 |
| `/api/*` | REST API | 신규 생성 |
| `todolist` Docker image, `docker-compose.yml` | Deploy Config | 신규 생성 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| (없음) | - | 신규 프로젝트 | None |

### 6.3 Verification

- [x] 기존 코드 없음, 호환성 영향 없음
- [ ] 스키마 마이그레이션 도구(Alembic 또는 버전 테이블)를 초기부터 적용해 향후 변경에 대비

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure (`components/`, `lib/`, `types/`) | Static sites, portfolios, landing pages | ☐ |
| **Dynamic** | Feature-based modules, backend integration | Web apps with backend, SaaS MVPs, fullstack apps | ☑ |
| **Enterprise** | Strict layer separation, DI, microservices | High-traffic systems, complex architectures | ☐ |

> Dynamic 레벨이지만 **bkend.ai BaaS 대신 자체 서버**를 선택한다. 사용자가 Docker 자가 배포와 0원 운영을 명시했고, 외부 BaaS에 데이터를 의존하지 않기 위해서다.

### 7.2 Key Architectural Decisions

| Decision | Options | Selected (안) | Rationale |
|----------|---------|---------------|-----------|
| Backend | FastAPI / Flask / Node(Express) | **FastAPI (Python 3.12)** | 작업 폴더가 Python 환경이고, 타입 기반 검증(Pydantic)과 자동 OpenAPI 문서를 제공 |
| DB | SQLite / PostgreSQL / CSV | **SQLite (WAL, Docker 볼륨)** | 1인·소용량이라 별도 DB 컨테이너가 필요 없다. CSV와 달리 트랜잭션과 쿼리를 지원하고, 백업은 파일 복사 |
| ORM | SQLModel / SQLAlchemy / raw SQL | SQLAlchemy 2.x + SQL 마이그레이션(`PRAGMA user_version`) | 성숙도, 마이그레이션 도구 의존성 최소화 |
| Frontend | React+Vite / SvelteKit / Vanilla | **React + Vite + TypeScript** | 컴포넌트·생태계, vite-plugin-pwa |
| Server State | TanStack Query / SWR / fetch | TanStack Query | 포커스 시 재조회로 기기 간 동기화(FR-13), 낙관적 업데이트 |
| Styling | Tailwind / CSS Modules | Tailwind + CSS 변수 디자인 토큰 | Alarmy 토큰을 변수로 고정하고 빠르게 적용 |
| Calendar | 자체 월간 그리드 / FullCalendar | 자체 구현 (date-fns) | 테마를 맞추기 쉽고 번들이 작다. 월간 뷰만 필요 |
| Auth | 세션 쿠키 / JWT | 서버 세션 쿠키 (HttpOnly) | 1인·동일 출처라 가장 단순하고 안전 |
| HTTPS/Proxy | Caddy+DuckDNS / Tailscale serve / Cloudflare Tunnel | **Caddy + DuckDNS** (Design에서 확정) | PWA에 HTTPS가 필수. 비용 0원, 폰에 VPN 앱 불필요 |
| Testing | pytest / Vitest / Playwright | pytest(API) + Vitest(유틸) | 핵심 로직 위주 |
| Packaging | 단일 컨테이너 / 프론트·백 분리 | 단일 앱 컨테이너(정적 파일은 FastAPI가 서빙) + Caddy | 1인용이라 운영 단순성 우선 |

### 7.3 Folder Structure Preview

```
todolist/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI 앱, 정적 파일 서빙
│   │   ├── config.py          # 환경변수
│   │   ├── db.py              # SQLite 엔진, WAL 설정
│   │   ├── models.py          # Project, Task, Tag, TaskTag, Session
│   │   ├── schemas.py         # Pydantic 입출력
│   │   ├── auth.py            # 로그인·세션·레이트리밋
│   │   ├── routers/           # projects, tasks, tags, calendar, backup
│   │   └── services/          # recurrence.py, sorting.py, backup.py
│   ├── alembic/
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── styles/tokens.css  # Alarmy 디자인 토큰
│   │   ├── components/        # TaskItem, Checkbox, BottomSheet, TabBar, Fab ...
│   │   ├── features/          # tasks, projects, calendar, settings, auth
│   │   ├── api/               # fetch 클라이언트 + TanStack Query 훅
│   │   └── lib/               # date/due-group, recurrence 표시
│   └── public/                # manifest, icons
├── deploy/
│   ├── Caddyfile
│   └── oracle-setup.md
├── Dockerfile                 # node build → python runtime (multi-stage)
├── docker-compose.yml         # app + caddy, volume: ./data
└── docs/
```

### 7.4 Deployment Topology (월 0원)

```
[Mac PC 브라우저/PWA] ─┐
                      ├─ HTTPS ─▶ Oracle Always Free VM (Ampere A1, arm64, Ubuntu)
[스마트폰 PWA] ────────┘            ├─ caddy  (443, 자동 TLS, *.duckdns.org)
                                    └─ app    (FastAPI + 정적 PWA, :8000)
                                         └─ volume ./data/todo.db (+ backups/)
```

| 항목 | 서비스 | 비용 |
|------|--------|------|
| VM | Oracle A1 Flex (1 OCPU / 6GB 이하), 홈 리전 일본 | ₩0 (Always Free) |
| 디스크 | Boot volume 50GB (무료 합산 200GB 이내) | ₩0 |
| 도메인 | DuckDNS 서브도메인 | ₩0 |
| TLS | Let's Encrypt (Caddy 자동) | ₩0 |
| 앱 배포 | PWA (앱스토어 없음) | ₩0 |

### 7.5 Design Direction (Alarmy 레퍼런스에서 추출)

| Token | Value (초안) | 용도 |
|-------|-------------|------|
| `--bg` | `#111214` | 앱 배경 (거의 검정) |
| `--surface` | `#1E1F23` | 카드·리스트 셀 |
| `--surface-2` | `#2A2B30` | 입력·선택 영역, 바텀시트 |
| `--text` / `--text-sub` | `#FFFFFF` / `#8E8F96` | 본문 / 보조 |
| `--primary` | `#F23D52` (코랄 레드) | 주요 CTA 버튼, FAB, 기한 지남 강조 |
| `--accent-toggle` | `#2FB4E0` (청록) | 토글, 라디오 선택 |
| `--accent-success` | `#F9C23C` (노랑) | 완료 체크 애니메이션 |
| `--accent-indigo` | `#5157E6` | 달력 선택일, 보조 강조 |
| Radius | 카드 12px / 버튼 10px / 바텀시트 20px | |
| Typography | Pretendard, 굵은 대제목 22~24px, 본문 15px | |
| Patterns | 하단 탭바(할일·프로젝트·달력·설정), 빨간 원형 FAB(+), 바텀시트 편집, 휠 스타일 시간 선택, 섹션 카드 리스트 | |

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [ ] `CLAUDE.md` has coding conventions section (없음, 생성 예정)
- [ ] `docs/01-plan/conventions.md` exists (없음)
- [ ] `CONVENTIONS.md` exists at project root (없음)
- [ ] ESLint configuration (프론트 생성 시)
- [ ] Prettier configuration (프론트 생성 시)
- [ ] TypeScript configuration (프론트 생성 시)
- [ ] Ruff configuration (백엔드 생성 시)

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **Naming** | missing | Python snake_case, TS camelCase·컴포넌트 PascalCase, API JSON은 snake_case | High |
| **Folder structure** | missing | 7.3 구조 준수 | High |
| **Date format** | missing | `due_date: YYYY-MM-DD`, `due_time: HH:MM | null`, 타임스탬프 ISO8601(+09:00) | High |
| **Error handling** | missing | API 오류 `{ "error": { "code", "message" } }` + HTTP 상태코드 | Medium |
| **Environment variables** | missing | 8.3 목록 | Medium |

### 8.3 Environment Variables Needed

| Variable | Purpose | Scope | To Be Created |
|----------|---------|-------|:-------------:|
| `APP_PASSWORD_HASH` | 로그인 비밀번호 argon2 해시 | Server | ☐ |
| `COOKIE_SECURE` | 쿠키 Secure 속성 (로컬 HTTP만 false) | Server | ☐ |
| `SESSION_DAYS` | 세션 유지 일수 (기본 90) | Server | ☐ |
| `DATABASE_PATH` | SQLite 경로 (기본 `/data/todo.db`) | Server | ☐ |
| `BACKUP_KEEP` | 백업 보관 개수 (기본 14) | Server | ☐ |
| `TZ` | `Asia/Seoul` | Server | ☐ |
| `DOMAIN` | Caddy 도메인 (예: `mytodo.duckdns.org`) | Deploy | ☐ |

### 8.4 Pipeline Integration

| Phase | Status | Document Location | Command |
|-------|:------:|-------------------|---------|
| Phase 1 (Schema) | ☐ | `docs/01-plan/schema.md` | Design 문서 데이터 모델 절에서 대체 |
| Phase 2 (Convention) | ☐ | `docs/01-plan/conventions.md` | 8.2 기준으로 Do 단계 초기에 작성 |

---

## 9. Next Steps

1. [ ] `/pdca design todolist`: 아키텍처 3안 비교, 데이터 모델·API 명세·화면 설계·HTTPS 방식 확정
2. [ ] 사용자 설계안 선택 및 승인
3. [ ] `/pdca do todolist`: M1 → M4 순서로 구현
4. [ ] Oracle Cloud 계정 가입 (홈 리전: 일본 도쿄 또는 오사카), A1 인스턴스 생성 (사용자 직접 수행, 카드 등록 필요)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-14 | Initial draft (Checkpoint 1·2 사용자 결정 반영, Alarmy 디자인 토큰 추출) | yongseok |
| 0.2 | 2026-09-14 | Design 반영: Oracle 유휴 회수 기준 정정(20%, PAYG 제외), FR-07 달력 목록을 하단 패널로 변경, SESSION_SECRET→COOKIE_SECURE, Caddy+DuckDNS 확정, 마이그레이션 방식 확정 | yongseok |
| 0.3 | 2026-09-14 | 한국 리전 무료 가입 불가 확인 → 홈 리전 일본으로 변경. Vercel·GCP 검토 후 제외. 재고 부족 대안(E2.1.Micro + 멀티아키텍처) 추가 | yongseok |
