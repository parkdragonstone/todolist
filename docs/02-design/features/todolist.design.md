# todolist Design Document

> **Summary**: 단일 Docker 컨테이너(FastAPI + React PWA)와 Caddy HTTPS로 구성한 1인용 할일·마감·달력 앱의 상세 설계
>
> **Project**: todolist
> **Version**: 0.1.0
> **Author**: yongseok
> **Date**: 2026-09-14
> **Status**: Draft
> **Planning Doc**: [todolist.plan.md](../../01-plan/features/todolist.plan.md)

### Pipeline References (if applicable)

| Phase | Document | Status |
|-------|----------|--------|
| Phase 1 | Schema Definition → 본 문서 §3 | N/A (본 문서로 대체) |
| Phase 2 | Coding Conventions → 본 문서 §10 | N/A (본 문서로 대체) |
| Phase 3 | Mockup → 본 문서 §5 | N/A |
| Phase 4 | API Spec → 본 문서 §4 | N/A |

---

## Context Anchor

> Copied from Plan document. Ensures strategic context survives Design→Do handoff.

| Key | Value |
|-----|-------|
| **WHY** | 흩어진 프로젝트 할일과 마감을 한 곳에서 보고 PC와 폰 어디서든 처리하기 위해 |
| **WHO** | 개발자 본인 1명 (Mac PC + 스마트폰) |
| **RISK** | Oracle Always Free VM의 유휴 회수 정책·계정 한도 변경·일본 리전 A1 재고 부족, PWA 설치에 필요한 HTTPS 구성 |
| **SUCCESS** | 월 비용 0원 / 폰 PWA 설치 후 PC와 데이터 일치 / 할일 생성부터 완료까지 3탭 이내 / 일일 자동 백업 |
| **SCOPE** | M1 백엔드·DB → M2 PWA UI(목록·프로젝트·달력) → M3 반복·태그 → M4 Docker·Oracle 배포·백업 |

---

## 1. Overview

### 1.1 Design Goals

1. **운영비 0원**: Oracle Always Free(A1 arm64, 홈 리전 일본) + DuckDNS + Let's Encrypt만 사용한다.
2. **이식성**: `docker compose up` 한 번으로 Mac(arm64, 로컬)과 Oracle VM(arm64)에서 똑같이 동작한다.
3. **단일 원본 동기화**: 서버 SQLite가 유일한 원본이고, 클라이언트는 포커스 복귀와 변경 직후 재조회로 맞춘다.
4. **앱 같은 UX**: Alarmy 다크 테마, 하단 탭바, 바텀시트, 즉시 반영되는 체크(낙관적 업데이트).
5. **테스트 가능한 핵심 로직**: 정렬, 마감 그룹, 반복 계산, 인증을 FastAPI와 분리된 순수 함수로 두고 pytest로 검증한다.

### 1.2 Design Principles

- **YAGNI**: 1인·소용량이므로 페이지네이션, 캐시 서버, 메시지 큐, 멀티 워커를 쓰지 않는다.
- **얇은 라우터, 두꺼운 서비스**: 라우터는 입력 검증과 응답 변환만 맡고, 규칙은 `services/`에 둔다.
- **Secure by default**: 인증이 기본이고(allowlist 방식), HTTPS, HttpOnly 쿠키, 컨테이너 non-root 실행.
- **파일 하나가 곧 데이터**: `/data/todo.db` 하나만 백업하면 전체를 복구할 수 있다.

---

## 2. Architecture Options (v1.7.0)

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| **Approach** | FastAPI + Jinja + HTMX, Node 빌드 없음 | 프론트/백 컨테이너 분리, 계층형 + 리포지토리 패턴, CI | 단일 앱 컨테이너(React PWA 빌드를 FastAPI가 서빙) + Caddy |
| **New Files** | ~20 | ~90 | ~55 |
| **Modified Files** | 0 (신규) | 0 (신규) | 0 (신규) |
| **Complexity** | Low | High | Medium |
| **Maintainability** | Medium | High | High |
| **Effort** | Low | High | Medium |
| **App-like UX** | Low | High | High |
| **Risk** | Alarmy 수준 UI 구현이 어려움 | 1인용에 과설계 | Low (balanced) |
| **Recommendation** | 빠른 기능 확인 | 장기·다인 운영 | **Default choice** |

**Selected**: **Option C — Pragmatic Balance** (Checkpoint 3, 2026-09-14 사용자 선택)
**Rationale**: 바텀시트·달력·낙관적 체크 같은 앱 UX를 React로 구현하면서도, 컨테이너 1개 + 프록시 1개로 운영 부담을 최소화한다.

**HTTPS 방식**: **Caddy + DuckDNS** (사용자 선택). 폰에 VPN 앱이 필요 없고, 공개 노출은 앱 로그인·레이트리밋·보안 헤더로 방어한다.

**배포 위치**: **Oracle Cloud Always Free, 홈 리전 일본** (Japan East 도쿄 `ap-tokyo-1` 또는 Japan Central 오사카 `ap-osaka-1`). 한국 리전은 무료 가입 홈 리전으로 고를 수 없어 변경했다(사용자 확인, 2026-09-14).

| 검토한 배포 대안 | 결과 | 사유 |
|------------------|------|------|
| Oracle 일본 홈 리전 | **선택** | 설계(Docker + SQLite + Caddy) 변경 없음, 한국과 지연 수십 ms |
| Vercel + Neon/Turso | 제외 | 서버리스라 운영에서 Docker를 못 쓰고 SQLite 파일 대신 외부 DB, in-memory 레이트리밋 대신 DB 저장, 백그라운드 백업 대신 하루 1회 Cron으로 바꿔야 함 |
| GCP e2-micro | 제외 | 미국 리전만 무료(지연 ~130ms), RAM 1GB |

**A1 재고 부족 시 대안**: 같은 홈 리전의 `VM.Standard.E2.1.Micro`(AMD x86, 1GB, Always Free). RAM이 부족해 VM에서 프론트 빌드가 어려우므로 Mac에서 `docker buildx build --platform linux/amd64`로 빌드하고 `docker save | ssh ... docker load`로 전송한다.

### 2.1 Component Diagram

```
┌──────────────────────┐        ┌───────────────────────────── Oracle A1 VM, Japan region (arm64) ────────────────────────────┐
│ Mac 브라우저 / PWA    │        │                                                                                              │
│ iPhone·Android PWA   │─HTTPS─▶│  ┌──────────────┐  HTTP   ┌───────────────────────── app container ─────────────────────────┐ │
│ (React + SW cache)   │ :443   │  │ caddy:2      │───────▶│ uvicorn (1 worker)                                              │ │
└──────────────────────┘        │  │ auto TLS     │ :8000  │  ├─ /api/*   FastAPI routers ─▶ services ─▶ SQLAlchemy ─▶ SQLite │ │
                                │  │ sec headers  │        │  ├─ /assets, /sw.js, /manifest.webmanifest (static)             │ │
         DuckDNS                │  └──────────────┘        │  ├─ /* → index.html (SPA fallback)                              │ │
   mytodo.duckdns.org ─▶ VM IP  │                          │  └─ lifespan: migrations + daily backup task                    │ │
                                │                          └──────────────────────────────┬──────────────────────────────────┘ │
                                │                                                         │ bind mount                          │
                                │                                              ./data/todo.db, ./data/backups/*.db            │
                                └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

**쓰기 (체크 완료 예시)**
```
TaskItem 체크 탭
 → useCompleteTask.mutate(id)            (낙관적: 캐시에서 완료 표시 + 노란 체크 애니메이션)
 → POST /api/tasks/{id}/complete         (Origin 검사 → 세션 쿠키 검증)
 → services.recurrence.complete_task()   (completed_at 기록, 반복이면 다음 회차 생성)
 → 200 { data: { task, spawned_task } }
 → invalidate ['tasks'], ['upcoming'], ['calendar'], ['projects']
 → Toast "완료했어요 · 실행 취소" (3초)
```

**기기 간 동기화**
```
폰에서 수정 ──▶ 서버 DB 갱신
PC 앱으로 돌아옴 ──▶ TanStack Query focusManager(visibilitychange) ──▶ 활성 쿼리 재조회 (staleTime 10s) ──▶ 화면 갱신
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| caddy | app:8000, DuckDNS DNS | TLS 종료, 보안 헤더, 리버스 프록시 |
| app (FastAPI) | SQLite file `/data/todo.db` | 데이터 저장 |
| app | env `APP_PASSWORD_HASH` | 로그인 |
| frontend (build) | `/api/*` same-origin | 데이터 |
| Backend libs | fastapi, uvicorn[standard], sqlalchemy≥2, pydantic-settings, argon2-cffi, tzdata | |
| Backend test libs | pytest, httpx | |
| Frontend libs | react, react-dom, react-router, @tanstack/react-query, date-fns, lucide-react, tailwindcss(v4), vite-plugin-pwa, pretendard | |
| Frontend dev libs | typescript, eslint, vitest, @playwright/test | |

---

## 3. Data Model

### 3.1 Entity Definition

```typescript
// 모든 날짜/시각은 Asia/Seoul 로컬 기준
type ISODate = string;      // "2026-09-14"
type HHMM = string;         // "14:30"
type Timestamp = string;    // "2026-09-14T09:30:00+09:00"

interface Project {
  id: number;
  name: string;             // 1..50
  color: string;            // "#RRGGBB" (프리셋 8색)
  sort_order: number;
  archived: boolean;
  open_count: number;       // 조회 시 계산: 미완료 수
  overdue_count: number;    // 조회 시 계산: 기한 지난 미완료 수
  created_at: Timestamp;
  updated_at: Timestamp;
}

type Priority = 0 | 1 | 2 | 3;   // 0 없음, 1 낮음, 2 보통, 3 높음
type RepeatFreq = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface Repeat {
  freq: RepeatFreq;
  interval: number;         // 1..99
  weekdays: number[] | null;// weekly 전용, 0=월 … 6=일
  anchor_day: number | null;// monthly/yearly 기준일(1..31), 서버가 due_date에서 자동 설정
}

interface Tag {
  id: number;
  name: string;             // 1..30, 대소문자 무시 unique
  color: string;
  task_count: number;       // 조회 시 계산 (미완료 기준)
}

interface Task {
  id: number;
  project_id: number;
  project_name: string;     // 조회 시 조인
  project_color: string;
  title: string;            // 1..200
  memo: string;             // 0..5000
  due_date: ISODate | null;
  due_time: HHMM | null;    // due_date 있을 때만
  priority: Priority;
  tags: Pick<Tag, 'id' | 'name' | 'color'>[];
  repeat: Repeat | null;    // due_date 있을 때만
  completed_at: Timestamp | null;
  spawned_task_id: number | null; // 반복 완료 시 생성된 다음 회차
  created_at: Timestamp;
  updated_at: Timestamp;
}

interface Session {         // 서버 전용
  token_hash: string;       // sha256(token)
  created_at: Timestamp;
  expires_at: Timestamp;
  last_seen_at: Timestamp;
  user_agent: string;
}
```

### 3.2 Entity Relationships

```
[Project] 1 ──── N [Task] N ──── N [Tag]      (task_tags)
                     │
                     └── 0..1 spawned_task_id ──▶ [Task]   (반복 다음 회차)
[Session]  (독립, 1인 로그인 세션)
```

- Project 삭제 → Task CASCADE 삭제 (UI에서 확인 시트 필수)
- Tag 삭제 → task_tags CASCADE (할일은 유지)
- Task 삭제 → spawned_task_id를 가리키던 행은 SET NULL

### 3.3 Database Schema

`backend/app/migrations/001_init.sql` (`PRAGMA user_version` 기반 순차 적용)

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  color       TEXT    NOT NULL DEFAULT '#F23D52',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE TABLE tasks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id        INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title             TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  memo              TEXT    NOT NULL DEFAULT '' CHECK (length(memo) <= 5000),
  due_date          TEXT,
  due_time          TEXT,
  priority          INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
  repeat_freq       TEXT    CHECK (repeat_freq IN ('daily', 'weekly', 'monthly', 'yearly')),
  repeat_interval   INTEGER NOT NULL DEFAULT 1 CHECK (repeat_interval BETWEEN 1 AND 99),
  repeat_weekdays   TEXT,                 -- "0,2,4"
  repeat_anchor_day INTEGER CHECK (repeat_anchor_day BETWEEN 1 AND 31),
  completed_at      TEXT,
  spawned_task_id   INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL,
  CHECK (due_time IS NULL OR due_date IS NOT NULL),
  CHECK (repeat_freq IS NULL OR due_date IS NOT NULL)
);
CREATE INDEX ix_tasks_project_open ON tasks(project_id, completed_at);
CREATE INDEX ix_tasks_due_open     ON tasks(due_date, completed_at);

CREATE TABLE tags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE COLLATE NOCASE CHECK (length(name) BETWEEN 1 AND 30),
  color       TEXT    NOT NULL DEFAULT '#2FB4E0',
  created_at  TEXT    NOT NULL
);

CREATE TABLE task_tags (
  task_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id   INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

CREATE TABLE sessions (
  token_hash    TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  user_agent    TEXT NOT NULL DEFAULT ''
);
```

**연결 PRAGMA** (연결마다 설정): `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`, `synchronous=NORMAL`

> 타임스탬프는 모두 `+09:00` 고정 오프셋 ISO 문자열이므로 문자열 비교로 정렬해도 결과가 맞다.

### 3.4 Domain Rules

#### 3.4.1 정렬 (`services/task_query.py`)

| sort | 순서 |
|------|------|
| `due` (기본) | due_date ASC (NULL은 마지막) → 같은 날짜면 시간 있는 항목을 due_time ASC로 먼저, 시간 없는 항목은 그 뒤 → priority DESC → created_at ASC |
| `priority` | priority DESC → `due` 규칙 |
| `created` | created_at DESC |
| 완료 목록(`status=done`) | completed_at DESC (sort 무시) |

#### 3.4.2 마감 그룹 (`services/due_groups.py`)

`now` = Asia/Seoul 현재 시각, `today` = now.date(), 주 시작 = **월요일** (`WEEK_STARTS_ON=0`)

| group key | 라벨 | 조건 (미완료만) |
|-----------|------|-----------------|
| `overdue` | 지남 | `due_date < today` 또는 (`due_date == today` 이고 `due_time < now.HH:MM`) |
| `today` | 오늘 | `due_date == today` (overdue 제외) |
| `tomorrow` | 내일 | `due_date == today + 1` |
| `this_week` | 이번 주 | `today + 2 ≤ due_date ≤ 이번 주 일요일` |
| `later` | 이후 | `due_date > max(이번 주 일요일, today + 1)` |
| `no_due` | 기한 없음 | `due_date IS NULL` |

각 그룹 내부는 `due` 정렬 규칙을 따른다. 빈 그룹도 키는 반환하고, 숨길지는 클라이언트가 정한다.

#### 3.4.3 반복 계산 (`services/recurrence.py`)

`next_due(due_date, repeat, today) -> date`

| freq | 규칙 |
|------|------|
| daily | `due + interval일` |
| weekly, weekdays 없음 | `due + 7×interval일` |
| weekly, weekdays 있음 | `due` 다음 날부터 하루씩 탐색. `weekday ∈ weekdays`이고 `(해당 주 월요일 − due 주 월요일)/7 % interval == 0`인 첫 날짜 (최대 `7×interval+7`일 탐색) |
| monthly | `interval`개월 뒤, 일은 `min(anchor_day, 그 달 말일)` |
| yearly | `interval`년 뒤 같은 월, 일은 `min(anchor_day, 그 달 말일)` (2/29 → 평년 2/28) |

- **따라잡기**: 계산 결과가 `today`보다 이르면 `today` 이상이 될 때까지 반복 적용한다. 오래 밀린 반복 할일이 여러 개 쌓이지 않게 하기 위해서다.
- `anchor_day`는 반복을 설정하거나 due_date를 수정할 때 서버가 `due_date.day`로 자동 설정한다.

`complete_task(task)`
1. 이미 완료면 그대로 반환한다(멱등).
2. `completed_at = now`
3. `repeat_freq`가 있으면 다음 회차 Task를 생성한다. 복사하는 필드는 project, title, memo, priority, tags, repeat_*, due_time이고 `due_date = next_due(...)`로 둔다. 원본의 `repeat_*`는 NULL로 비우고 `spawned_task_id = 새 id`로 둔다.
4. `(task, spawned_task | None)`을 반환한다.

`uncomplete_task(task)`
1. 미완료면 그대로 반환한다(멱등).
2. `completed_at = NULL`
3. `spawned_task_id`가 있고 그 Task가 **미완료**이면 반복 규칙을 원본으로 되돌리고 spawned Task를 삭제한다. `spawned_task_id = NULL`로 비운다.
4. spawned Task가 이미 완료 상태면 반복 규칙은 건드리지 않는다.
5. `(task, removed_spawned_task_id | None)`을 반환한다.

---

## 4. API Specification

### 4.0 Conventions

- Base path `/api`, JSON, 필드는 **snake_case**
- 성공 응답: `{ "data": ... }` (204는 본문 없음)
- 오류 응답: `{ "error": { "code": "...", "message": "...", "details": {} } }`
- 인증: 쿠키 `todo_session` (HttpOnly, Secure(`COOKIE_SECURE`), SameSite=Lax, Path=/, Max-Age=`SESSION_DAYS`×86400)
- 변경 요청(POST/PATCH/PUT/DELETE)에 `Origin` 헤더가 있고 요청 Host와 다르면 **403 FORBIDDEN_ORIGIN**
- 인증 예외(allowlist): `POST /api/auth/login`, `GET /api/health`
- 페이지네이션 없음 (1인 소용량)

### 4.1 Endpoint List

| Method | Path | Description | Auth |
|--------|------|-------------|:----:|
| GET | /api/health | 헬스체크 `{status:"ok"}` | ✗ |
| POST | /api/auth/login | 비밀번호 로그인, 세션 쿠키 발급 | ✗ |
| POST | /api/auth/logout | 세션 삭제, 쿠키 만료 | ✓ |
| GET | /api/auth/me | 로그인 여부 확인 | ✓ |
| GET | /api/projects | 프로젝트 목록 (+ open/overdue 카운트) `?include_archived=false` | ✓ |
| POST | /api/projects | 프로젝트 생성 | ✓ |
| PATCH | /api/projects/{id} | 이름/색상/보관 수정 | ✓ |
| PUT | /api/projects/order | 순서 일괄 변경 `{ids:[...]}` | ✓ |
| DELETE | /api/projects/{id} | 삭제 (할일 CASCADE) | ✓ |
| GET | /api/tasks | 할일 목록 (필터·정렬) | ✓ |
| GET | /api/tasks/upcoming | 마감 그룹별 미완료 할일 | ✓ |
| GET | /api/tasks/{id} | 할일 상세 | ✓ |
| POST | /api/tasks | 할일 생성 | ✓ |
| PATCH | /api/tasks/{id} | 할일 부분 수정 | ✓ |
| POST | /api/tasks/{id}/complete | 완료 (반복이면 다음 회차 생성) | ✓ |
| POST | /api/tasks/{id}/uncomplete | 완료 취소 (생성된 회차 회수) | ✓ |
| DELETE | /api/tasks/{id} | 삭제 | ✓ |
| GET | /api/tags | 태그 목록 (+ task_count) | ✓ |
| POST | /api/tags | 태그 생성 | ✓ |
| PATCH | /api/tags/{id} | 태그 수정 | ✓ |
| DELETE | /api/tags/{id} | 태그 삭제 | ✓ |
| GET | /api/calendar | 기간 내 날짜별 할일 `?from&to&include_done` | ✓ |
| GET | /api/export | 전체 JSON 내보내기 (attachment) | ✓ |
| POST | /api/import | JSON 가져오기 (전체 교체, 사전 자동 백업) | ✓ |
| GET | /api/backups | 서버 백업 파일 목록 | ✓ |
| POST | /api/backups | 즉시 백업 생성 | ✓ |

### 4.2 Detailed Specification

#### `POST /api/auth/login`

**Request:** `{ "password": "string(1..200)" }`
**Response 200:** `{ "data": { "authenticated": true } }` + `Set-Cookie: todo_session=...`
**Errors:**
- `401 INVALID_PASSWORD` — 비밀번호 불일치 (실패 카운트 증가)
- `429 TOO_MANY_ATTEMPTS` — 같은 IP에서 15분 내 5회 실패, 또는 전체 1시간 내 30회 실패. `Retry-After` 헤더 포함, 15분 잠금
- `400 VALIDATION_ERROR`

> 로그인할 때마다 만료된 세션을 정리한다. 세션 만료까지 남은 기간이 절반 이하가 되면 요청 시 `expires_at`을 연장한다(sliding).

#### `GET /api/projects?include_archived=false`

**Response 200:**
```json
{ "data": [
  { "id": 1, "name": "회사", "color": "#F23D52", "sort_order": 0, "archived": false,
    "open_count": 5, "overdue_count": 1,
    "created_at": "2026-09-14T09:00:00+09:00", "updated_at": "2026-09-14T09:00:00+09:00" }
] }
```
정렬: `archived ASC, sort_order ASC, id ASC`

#### `POST /api/projects`

**Request:** `{ "name": "사이드 프로젝트", "color": "#5157E6" }` (color 선택, 기본 `#F23D52`, `^#[0-9A-Fa-f]{6}$`)
**Response 201:** `{ "data": Project }` (sort_order = 현재 최대값 + 1)

#### `PATCH /api/projects/{id}`

**Request:** `{ "name"?: string, "color"?: string, "archived"?: boolean }`
**Response 200:** `{ "data": Project }` · **404 NOT_FOUND**

#### `PUT /api/projects/order`

**Request:** `{ "ids": [3, 1, 2] }`. 보관되지 않은 프로젝트 id 전체와 정확히 같은 집합이어야 하며, 아니면 400.
**Response 200:** `{ "data": Project[] }`

#### `DELETE /api/projects/{id}` → `204` · `404`

#### `GET /api/tasks`

| Query | Type | Default | 설명 |
|-------|------|---------|------|
| project_id | int | - | 프로젝트 필터 |
| status | `open`\|`done`\|`all` | `open` | 완료 상태 |
| tag_id | int (반복 가능) | - | 지정한 태그를 **모두** 가진 할일 |
| priority | int 0..3 | - | 해당 우선순위 **이상** |
| due_from / due_to | ISODate | - | 마감일 범위(포함) |
| sort | `due`\|`priority`\|`created` | `due` | §3.4.1 |

**Response 200:** `{ "data": Task[] }`

#### `GET /api/tasks/upcoming`

Query: `project_id?`, `tag_id?`(반복), `priority?`
**Response 200:**
```json
{ "data": {
  "today": "2026-09-14",
  "groups": {
    "overdue": [Task], "today": [Task], "tomorrow": [Task],
    "this_week": [Task], "later": [Task], "no_due": [Task]
  },
  "counts": { "overdue": 1, "today": 3, "tomorrow": 0, "this_week": 2, "later": 5, "no_due": 4 }
} }
```

#### `POST /api/tasks`

**Request:**
```json
{
  "project_id": 1,
  "title": "주간 보고서 작성",
  "memo": "",
  "due_date": "2026-09-18",
  "due_time": "17:00",
  "priority": 3,
  "tag_ids": [2],
  "repeat": { "freq": "weekly", "interval": 1, "weekdays": [4] }
}
```
- `title` 필수(앞뒤 공백 제거 후 1..200), 나머지는 선택
- `due_time`만 있고 `due_date`가 없으면 400 (`field_errors.due_time`)
- `repeat`만 있고 `due_date`가 없으면 400 (`field_errors.repeat`)
- `repeat.weekdays`는 `freq=weekly`일 때만 허용, 값 0..6 중복 없음
- 존재하지 않는 `project_id`나 `tag_ids`는 400

**Response 201:** `{ "data": Task }`

#### `PATCH /api/tasks/{id}`

**Request:** POST와 같은 필드의 부분 집합. `null`을 보내면 해당 필드를 비운다(`due_date: null` → `due_time`, `repeat`도 함께 비움). `tag_ids`를 보내면 태그 전체를 교체한다.
**Response 200:** `{ "data": Task }` · `404`

#### `POST /api/tasks/{id}/complete`

**Response 200:** `{ "data": { "task": Task, "spawned_task": Task | null } }` · `404`

#### `POST /api/tasks/{id}/uncomplete`

**Response 200:** `{ "data": { "task": Task, "removed_spawned_task_id": number | null } }` · `404`

#### `DELETE /api/tasks/{id}` → `204` · `404`

#### `GET /api/tags` → `{ "data": Tag[] }` (name ASC)
#### `POST /api/tags` `{ name, color? }` → `201 { data: Tag }` · `409 DUPLICATE`
#### `PATCH /api/tags/{id}` `{ name?, color? }` → `200` · `404` · `409`
#### `DELETE /api/tags/{id}` → `204` · `404`

#### `GET /api/calendar?from=2026-08-31&to=2026-10-11&include_done=true`

- `from`, `to` 필수, `to - from ≤ 62일`, 아니면 400
- 날짜별로 해당 마감일의 할일을 모은다(할일이 없는 날짜는 생략)

**Response 200:**
```json
{ "data": {
  "from": "2026-08-31", "to": "2026-10-11",
  "days": {
    "2026-09-14": {
      "open": 2, "done": 1, "overdue": 0,
      "colors": ["#F23D52", "#2FB4E0"],
      "tasks": [Task]
    }
  }
} }
```
`colors`: 미완료 할일의 프로젝트 색을 중복 없이 최대 3개

> 반복 할일은 현재 존재하는 회차만 표시한다. 미래 회차를 미리 펼쳐 보여주는 기능은 범위 밖이다.

#### `GET /api/export`

**Response 200** (`Content-Disposition: attachment; filename="todolist-YYYYMMDD-HHMM.json"`):
```json
{ "format": "todolist-export", "version": 1, "exported_at": "2026-09-14T10:00:00+09:00",
  "projects": [...], "tags": [...], "tasks": [ { ...Task 원본 컬럼, "tag_ids": [1,2] } ] }
```

#### `POST /api/import`

**Request:** export 형식 JSON (최대 10MB)
**동작:** ① `format`/`version` 검증 → ② 즉시 백업 생성 → ③ 트랜잭션 안에서 projects/tags/tasks/task_tags를 전체 삭제한 뒤 id를 보존해 삽입 → ④ 실패하면 롤백
**Response 200:** `{ "data": { "projects": 3, "tags": 2, "tasks": 40, "backup": "todo-20260914-100000-preimport.db" } }` · `400 INVALID_IMPORT`

#### `GET /api/backups` → `{ "data": [ { "name": "todo-20260914.db", "size": 53248, "created_at": "..." } ] }` (최신순)
#### `POST /api/backups` → `201 { "data": { "name": "todo-20260914-101500-manual.db", ... } }`

**자동 백업** (`services/backup.py`, lifespan 백그라운드 태스크): 앱을 시작할 때와 이후 1시간마다 `todo-YYYYMMDD.db`가 있는지 확인하고, 없으면 `sqlite3.Connection.backup()`으로 만든다. 자동 백업은 `BACKUP_KEEP`(기본 14)개를 넘으면 오래된 것부터 삭제한다(manual/preimport 파일은 최근 5개 보관).

---

## 5. UI/UX Design

### 5.0 Design Tokens (Alarmy 레퍼런스 스크린샷에서 추출)

> Pencil MCP 미사용. `frontend/src/styles/tokens.css`에 CSS 변수로 고정하고 Tailwind v4 `@theme`에 연결한다.

| Category | Tokens |
|----------|--------|
| **Colors** | `--bg #111214`, `--surface #1E1F23`, `--surface-2 #2A2B30`, `--line #34353B`, `--text #FFFFFF`, `--text-sub #8E8F96`, `--text-dim #5C5D63` |
| **Brand** | `--primary #F23D52` (CTA·FAB·지남), `--primary-press #D93246`, `--toggle #2FB4E0`, `--success #F9C23C` (완료 체크), `--indigo #5157E6` (선택일) |
| **Priority** | 높음 `#F23D52` / 보통 `#FF9F3D` / 낮음 `#2FB4E0` / 없음 (표시 안 함) |
| **Project/Tag Preset** | `#F23D52` `#FF8A3D` `#F9C23C` `#3DD68C` `#2FB4E0` `#5157E6` `#A06CF0` `#F26BB5` |
| **Typography** | Pretendard Variable (self-host). Screen title 26/700, Section 17/700, Body 15/500, Meta 12/500, Button 16/600 |
| **Spacing** | 4px 기반. 화면 좌우 20px, 카드 내부 16px, 리스트 간격 8px, 섹션 간격 24px |
| **Radius** | 카드·셀 12px / 버튼 10px / 칩 999px / 바텀시트 상단 20px |
| **Elevation** | 그림자 대신 표면 명도 차이. 바텀시트 뒤 딤 `rgba(0,0,0,.6)` |
| **Motion** | 체크 scale 0.8→1.1→1 + 노랑 채움 250ms, 시트 slide-up 220ms ease-out, 완료 항목 fade-out 400ms |
| **Tone** | 어두운 배경에 선명한 코랄 레드 한 가지를 주 강조색으로, 굵은 한글 대제목, 여백 많은 카드 리스트 |
| **Layout** | 모바일 우선(최대 폭 560px 중앙 정렬), 하단 고정 탭바(64px + safe-area), 우하단 FAB(56px, 탭바 위 16px) |

### 5.1 Screen Layout

```
┌──────────────────────────────┐   ┌──────────────────────────────┐   ┌──────────────────────────────┐
│ 할일                         │   │ ‹  사이드 프로젝트    ⋯      │   │ 2026년 9월        ‹ 오늘 ›   │
│ 9월 14일 월요일              │   │ ● 미완료 5 · 지남 1          │   │ 월 화 수 목 금 토 일         │
│ ┌──────────────────────────┐ │   │ [마감순|우선순위|생성순]     │   │  1  2  3  4  5  6  7         │
│ │ 오늘 3개 · 지난 할일 1개 │ │   │ [높음↑] [#태그]  완료보기 ◯ │   │  8  9 10 11 12 13 14         │
│ └──────────────────────────┘ │   │ ┌──────────────────────────┐ │   │       •     ••    (14)       │
│ [전체] [높음] [#업무] [#개인]│   │ │◯ API 설계 문서   D-2 🚩  │ │   │ 15 16 17 18 19 20 21         │
│ 지남 1                       │   │ │◯ 로그인 화면     9/20    │ │   │  •        •••+2              │
│ ┌──────────────────────────┐ │   │ └──────────────────────────┘ │   │ ...                          │
│ │◯ 세금 신고  ●회사 D+2    │ │   │                              │   │ 9월 14일 (월) · 3개          │
│ └──────────────────────────┘ │   │                              │   │ ┌──────────────────────────┐ │
│ 오늘 3                       │   │                              │   │ │◯ 주간 보고서  17:00 ↻    │ │
│ ┌──────────────────────────┐ │   │                              │   │ │✓ 운동        (완료)      │ │
│ │◯ 주간 보고서 ●회사 17:00↻│ │   │                          (+) │   │ └──────────────────────────┘ │
│ └──────────────────────────┘ │   │                              │   │                          (+) │
│                          (+) │   ├──────────────────────────────┤   ├──────────────────────────────┤
├──────────────────────────────┤   │ ☑할일  ▦프로젝트  ▣달력  ⚙설정│   │ ☑할일  ▦프로젝트  ▣달력  ⚙설정│
│ ☑할일  ▦프로젝트  ▣달력  ⚙설정│   └──────────────────────────────┘   └──────────────────────────────┘
└──────────────────────────────┘
         Home (/)                           Project Detail                      Calendar

TaskSheet (바텀시트)
┌──────────────────────────────┐
│ ───                          │
│ 할일 제목을 입력하세요        │  ← autofocus
│ ● 회사 ▾                      │  ← 프로젝트 선택
│ 마감  [오늘][내일][다음 주][📅]│
│       시간 [--:--]  ✕        │
│ 우선순위 [없음|낮음|보통|높음] │
│ 태그  [#업무 ✓][#개인][+ 새 태그]│
│ 반복  [안 함 ▾]  매주 · 금    │
│ 메모  ___________________    │
│ [ 삭제 ]          [  저장  ]  │  ← 저장 = primary
└──────────────────────────────┘
```

### 5.2 User Flow

```
첫 실행 → /login (비밀번호) → / 할일
할일 추가:  FAB(+) → TaskSheet(제목 입력, 기본 마감=오늘 없음, 프로젝트=현재/마지막 사용) → 저장           [2탭 + 입력]
할일 완료:  TaskItem 체크 탭 → 노란 체크 → 목록에서 사라짐 → Toast "완료했어요 · 실행 취소"               [1탭]
할일 수정:  TaskItem 본문 탭 → TaskSheet(편집) → 저장
달력:       달력 탭 → 날짜 탭 → 아래 목록 갱신 → FAB → 해당 날짜가 마감으로 채워진 TaskSheet
프로젝트:   프로젝트 탭 → 카드 탭 → 상세(정렬·필터·완료보기) → ⋯ → 수정/보관/삭제(확인 시트)
설정:       태그 관리 / 보관된 프로젝트 / 백업·내보내기·가져오기 / 로그아웃
401 발생:   모든 화면 → 쿼리 캐시 초기화 → /login
```

라우팅: `/login`, `/`, `/projects`, `/projects/:id`, `/calendar`, `/settings`
시트 상태: URL 검색 파라미터로 관리해 뒤로가기로 닫힌다 (`?task=123`, `?new=1&date=2026-09-14&project=2`, `?project-edit=2`)

### 5.3 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| AppShell | src/components/AppShell.tsx | 인증 가드, Outlet, TabBar, Fab, TaskSheet 호스트, Toast 영역 |
| TabBar | src/components/TabBar.tsx | 하단 4탭(할일/프로젝트/달력/설정), 활성 표시, safe-area |
| Fab | src/components/Fab.tsx | 우하단 원형 + 버튼, 현재 문맥(프로젝트/날짜) 전달 |
| BottomSheet | src/components/BottomSheet.tsx | 딤, 슬라이드업, 드래그 핸들, ESC/딤 탭 닫기, 포커스 트랩 |
| ConfirmSheet | src/components/ConfirmSheet.tsx | 파괴적 작업 확인 (취소/확인(primary)) |
| TaskItem | src/components/TaskItem.tsx | 체크, 제목, 메타(프로젝트 점·이름, DueChip, PriorityFlag, TagChip, 반복 아이콘) |
| CheckCircle | src/components/CheckCircle.tsx | 26px 원형 체크, 완료 애니메이션, 44px 터치 영역 |
| DueChip | src/components/DueChip.tsx | `D-3`/`오늘 17:00`/`내일`/`D+2`(지남, primary) 라벨 |
| PriorityFlag | src/components/PriorityFlag.tsx | 우선순위 색 깃발 (0이면 렌더 안 함) |
| TagChip | src/components/TagChip.tsx | `#이름` 칩 (선택형/표시형) |
| SectionHeader | src/components/SectionHeader.tsx | 그룹 제목 + 개수 (지남은 primary 색) |
| Segmented | src/components/Segmented.tsx | 세그먼트 컨트롤 (정렬, 우선순위) |
| Toggle | src/components/Toggle.tsx | 청록 토글 (완료 보기, 보관 보기) |
| ColorPicker | src/components/ColorPicker.tsx | 프리셋 8색 원형 선택 |
| EmptyState | src/components/EmptyState.tsx | 빈 목록 안내 |
| Toast | src/components/Toast.tsx | 하단 토스트 + 액션 버튼(실행 취소) |
| LoginPage | src/features/auth/LoginPage.tsx | 비밀번호 입력, 오류·잠금 메시지 |
| HomePage | src/features/tasks/HomePage.tsx | 요약 카드, 필터 칩, 마감 그룹 섹션 |
| TaskSheet | src/features/tasks/TaskSheet.tsx | 할일 생성·수정·삭제 폼 |
| RepeatPicker | src/features/tasks/RepeatPicker.tsx | 반복 주기·간격·요일 선택 |
| TagPicker | src/features/tasks/TagPicker.tsx | 태그 다중 선택 + 인라인 생성 |
| ProjectsPage | src/features/projects/ProjectsPage.tsx | 프로젝트 카드 목록, 순서 편집, 새 프로젝트 |
| ProjectDetailPage | src/features/projects/ProjectDetailPage.tsx | 프로젝트별 할일, 정렬·필터·완료 보기, ⋯ 메뉴 |
| ProjectSheet | src/features/projects/ProjectSheet.tsx | 프로젝트 생성·수정 (이름, 색) |
| CalendarPage | src/features/calendar/CalendarPage.tsx | 월 이동, 선택일 상태, 선택일 목록 |
| CalendarMonth | src/features/calendar/CalendarMonth.tsx | 7×6 그리드, 점·개수, 오늘/선택 표시 |
| SettingsPage | src/features/settings/SettingsPage.tsx | 섹션 구성, 로그아웃 |
| TagsSection | src/features/settings/TagsSection.tsx | 태그 CRUD |
| ArchivedSection | src/features/settings/ArchivedSection.tsx | 보관된 프로젝트 목록·복원 |
| BackupSection | src/features/settings/BackupSection.tsx | 백업 목록·즉시 백업·내보내기·가져오기 |

### 5.4 Page UI Checklist (v2.1.0)

#### Login (`/login`)

- [ ] Title: 앱 이름 "Todo" + 한 줄 설명
- [ ] Input: 비밀번호 (type=password, autocomplete=current-password, autofocus)
- [ ] Button: "로그인" (primary, 입력이 비어 있으면 비활성)
- [ ] Error text: 401이면 "비밀번호가 맞지 않아요", 429면 "잠시 후 다시 시도해주세요 (N분)"
- [ ] Behavior: 성공 시 `/`로 이동, 이미 로그인 상태면 `/`로 리다이렉트

#### Home (`/`)

- [ ] Header: "할일" 대제목 + 오늘 날짜 "9월 14일 월요일"
- [ ] Summary card: "오늘 N개 · 지난 할일 M개" (M>0이면 primary 색)
- [ ] Filter chips: [전체] [높음] + 태그 칩 목록 (가로 스크롤, 다중 선택)
- [ ] Sections: 지남 / 오늘 / 내일 / 이번 주 / 이후 / 기한 없음 (빈 그룹 숨김, 개수 표시)
- [ ] TaskItem: 체크, 제목, 프로젝트 점+이름, DueChip, PriorityFlag, 태그 칩, 반복 아이콘
- [ ] EmptyState: 미완료 할일이 없으면 "할 일을 모두 끝냈어요"
- [ ] FAB: TaskSheet(new) 열기
- [ ] Toast: 완료 시 "완료했어요 · 실행 취소"

#### Projects (`/projects`)

- [ ] Header: "프로젝트" + "순서 편집" 텍스트 버튼
- [ ] Card list: 색 바, 이름, "미완료 N · 지남 M" (M>0이면 primary)
- [ ] Reorder mode: 각 카드에 ↑ ↓ 버튼, "완료"로 저장(PUT /order)
- [ ] Button: "+ 새 프로젝트" → ProjectSheet
- [ ] EmptyState: "첫 프로젝트를 만들어보세요" + 만들기 버튼

#### Project Detail (`/projects/:id`)

- [ ] Header: 뒤로가기, 색 점 + 프로젝트 이름, ⋯ 메뉴(수정 / 보관 / 삭제)
- [ ] Sub-info: "미완료 N · 지남 M"
- [ ] Segmented: 정렬 [마감순 | 우선순위 | 생성순] (프로젝트별 localStorage 기억)
- [ ] Filter chips: 우선순위(높음 이상) + 태그
- [ ] Toggle: "완료 항목 보기" (켜면 목록 아래 완료 섹션을 completed_at DESC로 표시)
- [ ] TaskItem list (프로젝트 이름 메타는 숨김)
- [ ] ConfirmSheet: 삭제 시 "할일 N개도 함께 삭제돼요"
- [ ] FAB: 이 프로젝트가 미리 선택된 TaskSheet
- [ ] 404: 존재하지 않는 id면 "프로젝트를 찾을 수 없어요" + 목록으로

#### Calendar (`/calendar`)

- [ ] Header: "YYYY년 M월" + ‹ 이전달 / "오늘" / 다음달 › 버튼
- [ ] Weekday row: 일 월 화 수 목 금 토 (일 primary 색, 토 청록) — 달력만 일요일 시작, "이번 주" 그룹·반복 요일은 월요일 기준 유지
- [ ] Grid: 7×6, 이번 달이 아닌 날짜는 dim, 오늘은 primary 테두리, 선택일은 indigo 채움
- [ ] Day cell: 프로젝트 색 점 최대 3개 + 그 이상이면 "+N", 지난 미완료가 있으면 숫자 primary
- [ ] Swipe: 좌우 스와이프로 월 이동 (모바일)
- [ ] Selected day panel: "9월 14일 (월) · N개" + 해당일 TaskItem 목록 (완료 포함, 완료는 취소선)
- [ ] EmptyState(패널): "이 날은 일정이 없어요"
- [ ] FAB: 선택 날짜가 마감으로 채워진 TaskSheet

#### Settings (`/settings`)

- [ ] Section "태그": 태그 목록(색 점, 이름, 개수), 탭하면 이름·색 수정 시트, "+ 새 태그", 삭제(확인)
- [ ] Section "보관된 프로젝트": 목록 + "복원" 버튼
- [ ] Section "백업": "지금 백업" 버튼, 최근 백업 목록(이름·크기·시각), "JSON 내보내기", "JSON 가져오기"(파일 선택 → 확인 시트 "현재 데이터가 모두 교체돼요")
- [ ] Section "정보": 앱 버전, PWA 설치 안내 문구(iOS: 공유 → 홈 화면에 추가)
- [ ] Button: "로그아웃" (텍스트, primary 색)

#### TaskSheet (bottom sheet)

- [ ] Input: 제목 (autofocus, 200자 제한, Enter로 저장)
- [ ] Select: 프로젝트 (색 점 + 이름, 보관 제외)
- [ ] Quick due chips: [오늘] [내일] [다음 주 월] [📅 날짜 선택(input type=date)] + 마감 지우기 ✕
- [ ] Input: 시간 (input type=time, 날짜가 있을 때만 활성) + 지우기
- [ ] Segmented: 우선순위 [없음 | 낮음 | 보통 | 높음]
- [ ] TagPicker: 기존 태그 다중 선택 + "+ 새 태그" 인라인 생성
- [ ] RepeatPicker: [안 함 | 매일 | 매주 | 매월 | 매년], 간격 스테퍼(1..99), 매주면 요일 칩 7개. 날짜가 없으면 비활성 + 안내
- [ ] Textarea: 메모 (5000자)
- [ ] Buttons: 수정 모드일 때만 "삭제"(ConfirmSheet), "저장"(primary, 제목이 비면 비활성)
- [ ] Validation: 서버 400 `field_errors`를 필드 아래에 표시

### 5.5 PWA

| 항목 | 값 |
|------|----|
| manifest | name "Todo", short_name "Todo", start_url "/", display "standalone", background_color/theme_color `#111214`, lang "ko" |
| icons | 192, 512, maskable 512 (코랄 레드 원 + 흰 체크), apple-touch-icon 180 |
| iOS meta | `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black-translucent`, `viewport-fit=cover` + safe-area padding |
| Service Worker | vite-plugin-pwa `generateSW`, `registerType: 'autoUpdate'` + `skipWaiting`·`clientsClaim` + `main.tsx`의 `registerSW({ immediate: true })`(새 버전 활성화 시 자동 새로고침), 앱 셸 precache(폰트 서브셋은 런타임 CacheFirst), `navigateFallback: /index.html`, `navigateFallbackDenylist: [/^\/api\//]` |
| API 캐싱 | **NetworkOnly** (오래된 데이터와 인증 정보를 캐시하지 않음) |
| 서버 헤더 | `sw.js`, `index.html`, `manifest.webmanifest` → `Cache-Control: no-cache` / `/assets/*` → `public, max-age=31536000, immutable` |

### 5.6 Client State & Sync

| Query Key | Endpoint | 무효화하는 동작 |
|-----------|----------|-----------------|
| `['me']` | GET /auth/me | login, logout |
| `['projects', {include_archived}]` | GET /projects | project*, task* |
| `['tasks', filters]` | GET /tasks | task*, project*, tag* |
| `['upcoming', filters]` | GET /tasks/upcoming | task*, project*, tag* |
| `['calendar', from, to]` | GET /calendar | task*, project* |
| `['tags']` | GET /tags | tag*, task* |
| `['backups']` | GET /backups | backup create, import |

- QueryClient 기본값: `staleTime: 10_000`, `refetchOnWindowFocus: true`, `refetchOnReconnect: true`, `retry: (n, err) => err.status >= 500 && n < 2`
- 완료/완료 취소는 **낙관적 업데이트**를 쓰고, 실패하면 롤백하고 토스트 "저장에 실패했어요"
- `api/client.ts`: `credentials: 'same-origin'`, JSON 헤더, 401이면 `queryClient.clear()` 후 `/login`으로 이동, 오류를 `ApiError{status, code, message, fieldErrors}`로 정규화

---

## 6. Error Handling

### 6.1 Error Code Definition

| HTTP | code | Message (ko) | Cause | Client Handling |
|:----:|------|--------------|-------|-----------------|
| 400 | VALIDATION_ERROR | 입력값을 확인해주세요 | Pydantic/도메인 검증 실패 | `details.field_errors`를 필드 아래에 표시 |
| 400 | INVALID_IMPORT | 가져오기 파일 형식이 올바르지 않아요 | format/version/무결성 오류 | 토스트 |
| 401 | UNAUTHORIZED | 로그인이 필요해요 | 세션 없음/만료 | `/login`으로 이동 |
| 401 | INVALID_PASSWORD | 비밀번호가 맞지 않아요 | 로그인 실패 | 로그인 폼 오류 |
| 403 | FORBIDDEN_ORIGIN | 허용되지 않은 요청이에요 | Origin 불일치 | 토스트 |
| 404 | NOT_FOUND | 항목을 찾을 수 없어요 | id 없음 | 시트 닫기 + 토스트 / 404 화면 |
| 409 | DUPLICATE | 이미 같은 이름이 있어요 | 태그 이름 중복 | 필드 오류 |
| 413 | PAYLOAD_TOO_LARGE | 파일이 너무 커요 | import 10MB 초과 | 토스트 |
| 429 | TOO_MANY_ATTEMPTS | 잠시 후 다시 시도해주세요 | 로그인 레이트리밋 | `Retry-After` 기반 남은 시간 표시 |
| 500 | INTERNAL_ERROR | 문제가 생겼어요 | 예기치 못한 예외 (로그 기록, 스택 미노출) | 토스트 |

### 6.2 Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값을 확인해주세요",
    "details": { "field_errors": { "due_time": "마감 날짜 없이 시간만 지정할 수 없어요" } }
  }
}
```

구현: `app/errors.py`의 `AppError(status, code, message, details)`와 `RequestValidationError`, `HTTPException`, 일반 `Exception` 핸들러를 모두 이 형식으로 변환한다.

---

## 7. Security Considerations

- [ ] **HTTPS 강제**: Caddy 자동 TLS, HTTP→HTTPS 리다이렉트, HSTS `max-age=31536000`
- [ ] **인증**: argon2id 해시(`APP_PASSWORD_HASH`), 세션 토큰 `secrets.token_urlsafe(32)`를 DB에는 sha256으로만 저장
- [ ] **쿠키**: HttpOnly, Secure, SameSite=Lax, Path=/
- [ ] **CSRF**: SameSite=Lax + 변경 요청 Origin 검사 + JSON body 강제(`Content-Type: application/json`, import 포함)
- [ ] **레이트리밋**: 로그인 실패 IP별 5회/15분, 전체 30회/1시간 → 15분 잠금 (단일 워커 in-memory)
- [ ] **클라이언트 IP**: uvicorn `--proxy-headers --forwarded-allow-ips="*"` (app 포트는 호스트에 공개하지 않고 compose 내부 네트워크에서만 caddy가 접근)
- [ ] **보안 헤더** (Caddy): `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, CSP `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'`
- [ ] **입력 검증**: Pydantic 길이·패턴·범위 검증, SQLAlchemy 파라미터 바인딩(SQL injection 방지), React 기본 이스케이프(메모는 텍스트로만 렌더링, `dangerouslySetInnerHTML` 금지)
- [ ] **컨테이너**: non-root(uid 10001), app 포트 비공개, `.env` git 제외
- [ ] **VM**: SSH 키 인증만 허용, OCI Security List ingress 22(내 IP)/80/443, Ubuntu iptables 80/443 허용, `unattended-upgrades` 활성화
- [ ] **OpenAPI 문서**: 운영 환경에서는 `/docs`, `/openapi.json` 비활성 (`ENABLE_DOCS=false`)

---

## 8. Test Plan (v2.3.0)

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| Unit | recurrence, due_groups, task_query 정렬 | pytest | Do (M2) |
| L1: API Tests | 모든 엔드포인트 상태코드·응답 형태·인증·검증 | pytest + FastAPI TestClient(httpx), 임시 SQLite | Do (M1·M2) |
| Unit (FE) | `lib/date.ts` (D-day 라벨, 월 그리드) | Vitest | Do (M3) |
| L2: UI Action Tests | 핵심 화면 동작 | Playwright (`frontend/e2e/actions.spec.ts`) | Do (M5) |
| L3: E2E Scenario | 로그인 → 추가 → 완료 → 달력 확인 | Playwright (`frontend/e2e/e2e.spec.ts`) | Do (M5) |

> L2/L3는 `docker compose -f docker-compose.local.yml up` 서버(테스트 비밀번호, seed 데이터)를 대상으로 실행한다.

### 8.2 L1: API Test Scenarios

| # | Endpoint | Method | Test Description | Expected Status | Expected Response |
|---|----------|--------|-----------------|:--------------:|-------------------|
| 1 | /api/health | GET | 인증 없이 호출 | 200 | `.status == "ok"` |
| 2 | /api/projects | GET | 인증 없이 호출 | 401 | `.error.code == "UNAUTHORIZED"` |
| 3 | /api/auth/login | POST | 올바른 비밀번호 | 200 | `Set-Cookie: todo_session` (HttpOnly) |
| 4 | /api/auth/login | POST | 틀린 비밀번호 | 401 | `.error.code == "INVALID_PASSWORD"` |
| 5 | /api/auth/login | POST | 5회 실패 후 6번째 | 429 | `Retry-After` 헤더, `TOO_MANY_ATTEMPTS` |
| 6 | /api/auth/logout | POST | 로그아웃 후 /me | 204 → 401 | 세션 삭제됨 |
| 7 | /api/projects | POST | 다른 Origin 헤더 | 403 | `FORBIDDEN_ORIGIN` |
| 8 | /api/projects | POST | 정상 생성 | 201 | `.data.id`, `sort_order` 증가 |
| 9 | /api/projects | POST | 빈 이름 | 400 | `.error.details.field_errors.name` |
| 10 | /api/projects | GET | 카운트 계산 | 200 | `open_count`, `overdue_count` 정확 |
| 11 | /api/projects/order | PUT | 집합 불일치 | 400 | `VALIDATION_ERROR` |
| 12 | /api/projects/{id} | DELETE | 할일 CASCADE | 204 | 이후 해당 할일 GET → 404 |
| 13 | /api/tasks | POST | 태그·반복 포함 생성 | 201 | `.data.tags.length`, `.data.repeat.anchor_day` |
| 14 | /api/tasks | POST | due_time만 지정 | 400 | `field_errors.due_time` |
| 15 | /api/tasks | POST | repeat만 지정 | 400 | `field_errors.repeat` |
| 16 | /api/tasks | GET | sort=due 순서 | 200 | 날짜 ASC, 같은 날짜는 시간 있는 항목 먼저, NULL 마지막 |
| 17 | /api/tasks | GET | tag_id 2개 AND 필터 | 200 | 두 태그 모두 가진 항목만 |
| 18 | /api/tasks | GET | status=done 정렬 | 200 | completed_at DESC |
| 19 | /api/tasks/upcoming | GET | 그룹 분류 (시간 고정) | 200 | overdue/today/tomorrow/this_week/later/no_due 정확 |
| 20 | /api/tasks/{id}/complete | POST | 반복 없는 할일 | 200 | `spawned_task == null`, `completed_at` 존재 |
| 21 | /api/tasks/{id}/complete | POST | 매주(금) 반복 | 200 | `spawned_task.due_date` = 다음 금요일, 원본 `repeat == null` |
| 22 | /api/tasks/{id}/complete | POST | 두 번 호출 | 200 | 멱등, 회차 1개만 생성 |
| 23 | /api/tasks/{id}/uncomplete | POST | 미완료 회차 회수 | 200 | `removed_spawned_task_id` 존재, 원본 repeat 복원 |
| 24 | /api/tasks/{id} | PATCH | due_date=null | 200 | due_time·repeat도 null |
| 25 | /api/tags | POST | 대소문자만 다른 중복 | 409 | `DUPLICATE` |
| 26 | /api/calendar | GET | 범위 63일 | 400 | `VALIDATION_ERROR` |
| 27 | /api/calendar | GET | 날짜별 집계 | 200 | `days[d].open/done/colors(≤3)` |
| 28 | /api/export → /api/import | GET/POST | 왕복 후 데이터 동일 | 200 | 카운트 일치, preimport 백업 생성 |
| 29 | /api/import | POST | 잘못된 format | 400 | `INVALID_IMPORT`, 기존 데이터 유지 |
| 30 | /api/backups | POST | 즉시 백업 | 201 | 파일 존재, `GET /backups`에 표시 |

**Unit (recurrence)**: 1/31 매월 → 2/28(평년)·2/29(윤년) → 3/31 (anchor 유지), 2/29 매년 → 평년 2/28, 매주 [월,수,금] 간격 2, daily 따라잡기(10일 밀린 경우 결과 ≥ today), interval 3
**Unit (due_groups)**: 토요일(내일=일요일, this_week 비어 있음), 일요일(this_week 없음, 다음 주는 later), 오늘 시간 지난 항목은 overdue

### 8.3 L2: UI Action Test Scenarios

| # | Page | Action | Expected Result | Data Verification |
|---|------|--------|----------------|-------------------|
| 1 | Login | 틀린 비밀번호 제출 | 오류 문구 표시 | 401 응답 |
| 2 | Home | 로드 | 요약 카드, 섹션 헤더, TaskItem 렌더 | seed 데이터 표시 |
| 3 | Home | 체크 탭 | 항목 사라짐 + 토스트 | complete API 200 |
| 4 | Home | 토스트 "실행 취소" | 항목 복귀 | uncomplete API 200 |
| 5 | Home | [높음] 필터 칩 | 목록 수 감소 | priority≥3만 |
| 6 | TaskSheet | 제목 입력 → [내일] → 저장 | 시트 닫힘, "내일" 섹션에 표시 | POST 201 |
| 7 | TaskSheet | 날짜 없이 반복 선택 | 반복 컨트롤 비활성 + 안내 | - |
| 8 | Project Detail | 정렬 [우선순위] | 순서 변경 | 첫 항목 priority 최댓값 |
| 9 | Project Detail | 완료 항목 보기 토글 | 완료 섹션 표시 | status=done 조회 |
| 10 | Calendar | 다음달 › | 헤더 월 변경 | calendar API 새 범위 |
| 11 | Calendar | 날짜 탭 → FAB | TaskSheet 마감 = 선택 날짜 | - |
| 12 | Settings | 새 태그 생성 | 목록에 추가 | POST /tags 201 |

### 8.4 L3: E2E Scenario Test Scenarios

| # | Scenario | Steps | Success Criteria |
|---|----------|-------|-----------------|
| 1 | 첫 사용 흐름 | 로그인 → 프로젝트 생성 → 할일 추가(오늘 17:00, 높음, 태그) → 홈 "오늘"에서 확인 | 모든 필드가 TaskItem 메타에 표시 |
| 2 | 반복 할일 | 매주 반복 할일 추가 → 완료 → 다음 주 같은 요일 회차 생성 확인 → 실행 취소 → 회차 사라짐 | 달력에 다음 회차 점 표시/제거 |
| 3 | 기기 동기화 시뮬레이션 | 브라우저 컨텍스트 A에서 추가 → 컨텍스트 B 포커스 이벤트 → B에 표시 | 2초 이내 반영 |
| 4 | 인증 만료 | 쿠키 삭제 후 화면 이동 | `/login`으로 리다이렉트 |
| 5 | 백업 왕복 | 내보내기 JSON → 할일 삭제 → 가져오기 → 복원 확인 | 카운트 일치 |

### 8.5 Seed Data Requirements

`python -m app.cli seed` (개발·테스트 전용, 데이터가 비어 있을 때만 실행)

| Entity | Minimum Count | Key Fields Required |
|--------|:------------:|---------------------|
| Project | 3 | 회사(#F23D52), 사이드 프로젝트(#5157E6), 개인(#3DD68C) |
| Tag | 3 | 업무, 개인, 중요 |
| Task | 14 | 지남 2, 오늘 3(시간 있음 1), 내일 2, 이번 주 2, 이후 2, 기한 없음 2, 완료 1 / 우선순위 0~3 분포 / 매주 반복 1, 매월 반복 1 |

---

## 9. Clean Architecture (Pragmatic 적용)

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **Presentation (BE)** | HTTP 라우팅, 요청/응답 스키마 변환, 의존성 주입 | `backend/app/routers/`, `schemas.py` |
| **Application/Domain (BE)** | 정렬, 마감 그룹, 반복, 백업, 가져오기 규칙 | `backend/app/services/` |
| **Infrastructure (BE)** | DB 엔진, ORM 모델, 마이그레이션, 설정, 시간 | `db.py`, `models.py`, `migrations/`, `config.py`, `timeutil.py` |
| **Cross-cutting (BE)** | 인증, 오류 | `auth.py`, `errors.py` |
| **Presentation (FE)** | 페이지·시트·컴포넌트 | `frontend/src/features/`, `components/` |
| **Application (FE)** | 서버 상태 훅, 캐시 무효화 규칙 | `frontend/src/api/queries.ts` |
| **Domain (FE)** | 타입, 날짜·라벨 계산 순수 함수 | `frontend/src/api/types.ts`, `lib/` |
| **Infrastructure (FE)** | fetch 클라이언트 | `frontend/src/api/client.ts` |

### 9.2 Dependency Rules

```
BE:  routers ──▶ services ──▶ models/db
        │            │
        └──▶ schemas └──▶ timeutil, errors      (services는 fastapi를 import하지 않는다)

FE:  features/components ──▶ api/queries ──▶ api/client
             │                    │
             └──▶ lib, api/types ◀┘              (lib는 React/fetch를 import하지 않는다)
```

### 9.3 File Import Rules

| From | Can Import | Cannot Import |
|------|-----------|---------------|
| routers | services, schemas, auth, errors, db(get_db) | 다른 router |
| services | models, timeutil, errors, (sqlalchemy Session) | fastapi, routers, schemas |
| features/components | api/queries, api/types, lib, components | api/client 직접 호출 (queries 경유) |
| lib | 없음 (date-fns만) | react, api |

### 9.4 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| tasks router | Presentation | `backend/app/routers/tasks.py` |
| recurrence / due_groups / task_query | Domain | `backend/app/services/*.py` |
| ORM models | Infrastructure | `backend/app/models.py` |
| HomePage / TaskSheet | Presentation | `frontend/src/features/tasks/` |
| useUpcoming / useCompleteTask | Application | `frontend/src/api/queries.ts` |
| dDayLabel / monthGrid | Domain | `frontend/src/lib/date.ts` |
| apiFetch | Infrastructure | `frontend/src/api/client.ts` |

---

## 10. Coding Convention Reference

### 10.1 Naming Conventions

| Target | Rule | Example |
|--------|------|---------|
| Python modules/functions/vars | snake_case | `next_due()`, `due_groups.py` |
| Python classes | PascalCase | `TaskOut`, `AppError` |
| React components & files | PascalCase(.tsx) | `TaskItem.tsx` |
| TS functions/vars | camelCase | `dDayLabel()`, `useUpcoming()` |
| TS utility files | camelCase.ts | `date.ts`, `colors.ts` |
| Constants | UPPER_SNAKE_CASE | `WEEK_STARTS_ON`, `PRESET_COLORS` |
| Folders | kebab-case (단일 단어 권장) | `features/calendar/` |
| API JSON fields / TS API types | snake_case (변환 계층 없음) | `due_date`, `project_color` |

### 10.2 Import Order

- Python: 표준 라이브러리 → 서드파티 → `app.*` (ruff isort 규칙)
- TS: 외부 라이브러리 → `@/` 절대 경로 → 상대 경로 → `import type` → 스타일

### 10.3 Environment Variables

| Variable | Default | Scope | 설명 |
|----------|---------|-------|------|
| `APP_PASSWORD_HASH` | (필수) | app | argon2id 해시. `.env`에는 **작은따옴표로 감싸서** 적는다(`$` 보간 방지) |
| `SESSION_DAYS` | `90` | app | 세션 유지 일수 |
| `COOKIE_SECURE` | `true` | app | 로컬 HTTP 개발에서만 `false` |
| `DATABASE_PATH` | `/data/todo.db` | app | SQLite 경로 |
| `BACKUP_DIR` | `/data/backups` | app | 백업 폴더 |
| `BACKUP_KEEP` | `14` | app | 자동 백업 보관 수 |
| `TZ` | `Asia/Seoul` | app | 타임존 |
| `ENABLE_DOCS` | `false` | app | `/docs` 노출 여부 |
| `DOMAIN` | (필수, 운영) | caddy | 예: `mytodo.duckdns.org` |

> Plan §8.3의 `SESSION_SECRET`은 쓰지 않는다. 서버에 저장하는 랜덤 토큰 방식이라 서명 키가 필요 없고, 대신 `COOKIE_SECURE`를 추가한다.

### 10.4 This Feature's Conventions

| Item | Convention Applied |
|------|-------------------|
| Component naming | PascalCase, 한 파일에 컴포넌트 하나 |
| File organization | 기능별 `features/*` + 공용 `components/` |
| State management | 서버 상태는 TanStack Query만. UI 상태는 useState와 URL 파라미터. 전역 스토어 없음 |
| Styling | Tailwind v4 유틸리티 + `tokens.css` 변수. 임의 hex 사용 금지(토큰만) |
| Error handling | BE는 `AppError` → 공통 envelope, FE는 `ApiError` → 필드 오류 또는 토스트 |
| Lint/Format | BE ruff(check+format), FE eslint + tsc `--noEmit` |
| Design trace | 주요 모듈 상단에 `# Design Ref: §x.y` / `// Design Ref: §x.y` 주석 |

---

## 11. Implementation Guide

### 11.1 File Structure

```
todolist/
├── .env.example
├── .gitignore  .dockerignore
├── Dockerfile
├── docker-compose.yml            # 운영: app + caddy
├── docker-compose.local.yml      # 로컬: app만, 127.0.0.1:8000, COOKIE_SECURE=false
├── README.md
├── deploy/
│   ├── Caddyfile
│   ├── oracle-setup.md           # 계정(PAYG+예산알림) → A1 생성 → 방화벽 → Docker → DuckDNS → 배포
│   └── pull-backup.sh            # Mac에서 VM 백업 scp 복사
├── backend/
│   ├── requirements.txt  requirements-dev.txt  pyproject.toml (ruff, pytest 설정)
│   ├── app/
│   │   ├── __init__.py  main.py  config.py  db.py  models.py  schemas.py
│   │   ├── errors.py  auth.py  timeutil.py  cli.py (hash-password, seed)
│   │   ├── migrations/001_init.sql
│   │   ├── routers/ __init__.py auth.py projects.py tasks.py tags.py calendar.py backup.py
│   │   └── services/ __init__.py task_query.py due_groups.py recurrence.py backup.py
│   └── tests/
│       ├── conftest.py (임시 DB, 고정 시계, 로그인 클라이언트)
│       ├── test_auth.py  test_projects.py  test_tasks.py  test_tags.py
│       ├── test_calendar.py  test_backup.py
│       └── test_recurrence.py  test_due_groups.py
└── frontend/
    ├── package.json  vite.config.ts  tsconfig.json  eslint.config.js  index.html
    ├── playwright.config.ts
    ├── public/ favicon.svg  icons/(icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png)
    ├── e2e/ actions.spec.ts  e2e.spec.ts
    └── src/
        ├── main.tsx  App.tsx  vite-env.d.ts
        ├── styles/ tokens.css  index.css
        ├── api/ client.ts  types.ts  queries.ts
        ├── lib/ date.ts  date.test.ts  colors.ts
        ├── components/ (§5.3 공용 컴포넌트 16개)
        └── features/
            ├── auth/LoginPage.tsx
            ├── tasks/ HomePage.tsx  TaskSheet.tsx  RepeatPicker.tsx  TagPicker.tsx
            ├── projects/ ProjectsPage.tsx  ProjectDetailPage.tsx  ProjectSheet.tsx
            ├── calendar/ CalendarPage.tsx  CalendarMonth.tsx
            └── settings/ SettingsPage.tsx  TagsSection.tsx  ArchivedSection.tsx  BackupSection.tsx
```

**Dockerfile (요지)**
```dockerfile
FROM node:24-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 TZ=Asia/Seoul
WORKDIR /srv
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY --from=web /web/dist ./static
RUN useradd -u 10001 -m appuser && mkdir -p /data && chown appuser /data
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/api/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
```

**docker-compose.yml (요지)**
```yaml
services:
  app:
    build: .
    image: todolist:latest
    restart: unless-stopped
    env_file: .env
    volumes: ["./data:/data"]        # VM에서 최초 1회: mkdir data && sudo chown 10001:10001 data
    expose: ["8000"]
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    environment: ["DOMAIN=${DOMAIN}"]
    volumes: ["./deploy/Caddyfile:/etc/caddy/Caddyfile:ro", "caddy_data:/data", "caddy_config:/config"]
    depends_on: [app]
volumes: { caddy_data: {}, caddy_config: {} }
```

### 11.2 Implementation Order

1. [ ] **M1** 백엔드 기반: config, timeutil, db(PRAGMA, 마이그레이션 러너), 001_init.sql, models, errors, auth(로그인·세션·레이트리밋·Origin 검사), health, cli(hash-password) + test_auth
2. [ ] **M2** 백엔드 도메인: services(task_query, due_groups, recurrence, backup) → routers(projects, tasks, tags, calendar, backup) → main(SPA 서빙, lifespan 백업 태스크) → cli seed + 나머지 테스트
3. [ ] **M3** 프론트 기반: Vite+React+TS+Tailwind v4, tokens.css, Pretendard, api(client/types/queries), AppShell·TabBar·Fab·BottomSheet·Toast·ConfirmSheet, LoginPage, PWA(manifest·SW·아이콘), lib/date + Vitest
4. [ ] **M4** 프론트 기능: TaskItem 계열 컴포넌트 → HomePage → TaskSheet(RepeatPicker, TagPicker) → Projects/ProjectDetail/ProjectSheet → Calendar → Settings
5. [ ] **M5** 배포·검증: Dockerfile, compose(운영/로컬), Caddyfile, .env.example, oracle-setup.md, pull-backup.sh, README, Playwright L2/L3, arm64·amd64 멀티아키텍처 빌드 확인(E2.1.Micro 대안 대비)

### 11.3 Session Guide

> Auto-generated from Design structure. Session split is recommended, not required.
> Use `/pdca do todolist --scope module-N` to implement one module per session.

#### Module Map

| Module | Scope Key | Description | Files (approx) | Estimated Turns |
|--------|-----------|-------------|:--------------:|:---------------:|
| 백엔드 기반 | `module-1` | 설정, DB, 마이그레이션, 모델, 오류, 인증, 헬스체크, CLI hash + 인증 테스트 | 14 | 20-25 |
| 백엔드 도메인 API | `module-2` | 정렬, 마감 그룹, 반복, 백업 서비스 + 5개 라우터 + SPA 서빙 + seed + 테스트 | 18 | 35-45 |
| 프론트 기반 & PWA | `module-3` | Vite/Tailwind/토큰, API 계층, 셸·탭바·시트·토스트, 로그인, PWA, date 유틸 | 20 | 30-40 |
| 프론트 기능 화면 | `module-4` | 할일 홈, TaskSheet, 프로젝트 목록/상세, 달력, 설정 | 18 | 40-50 |
| 배포 & E2E | `module-5` | Docker/compose/Caddy, Oracle 가이드, 백업 스크립트, README, Playwright | 10 | 20-30 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | ✅ 완료 |
| Session 2 | Do | `--scope module-1,module-2` | 55-70 |
| Session 3 | Do | `--scope module-3` | 30-40 |
| Session 4 | Do | `--scope module-4` | 40-50 |
| Session 5 | Do | `--scope module-5` + 로컬 Docker 검증 | 20-30 |
| Session 6 | Check + Act + Report | 전체 (`/pdca analyze todolist`) | 30-40 |

### 11.4 Deployment Runbook (요약, 상세는 `deploy/oracle-setup.md`)

1. Oracle Cloud 가입: **Home Region = Japan East (Tokyo) 또는 Japan Central (Osaka)** (가입 후 변경 불가, Always Free 컴퓨트는 홈 리전에서만 생성 가능) → **Pay As You Go로 업그레이드**(유휴 회수 제외, Always Free 한도 안에서는 과금 없음) → Budget 알림 설정(예: 월 ₩1,000 초과 시 이메일)
2. Compute → Instance 생성: Ubuntu 24.04 (aarch64), `VM.Standard.A1.Flex` 1 OCPU / 6GB, SSH 공개키 등록, 퍼블릭 IP 할당
   - "Out of capacity"가 뜨면 다른 시간대에 재시도. 계속 실패하면 `VM.Standard.E2.1.Micro`(x86, 1GB)로 생성하고, 이미지는 Mac에서 `docker buildx build --platform linux/amd64 -t todolist:latest --load .` → `docker save todolist:latest | ssh ubuntu@VM docker load`로 전송
3. VCN Security List Ingress: TCP 22(내 IP), 80, 443 (0.0.0.0/0)
4. VM 방화벽: `sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT` (443도 동일) → `sudo netfilter-persistent save`
5. Docker Engine + compose plugin 설치, `sudo usermod -aG docker ubuntu`
6. duckdns.org에서 서브도메인을 만들고 VM 퍼블릭 IP 등록
7. `git clone`(또는 rsync) → `mkdir data && sudo chown 10001:10001 data`
8. 비밀번호 해시 생성: `docker compose run --rm app python -m app.cli hash-password`
9. `.env` 작성(`APP_PASSWORD_HASH='...'`, `DOMAIN=mytodo.duckdns.org`) → `docker compose up -d --build`
10. `https://mytodo.duckdns.org` 접속 → 로그인 → iPhone Safari 공유 → "홈 화면에 추가" / Android·데스크톱 Chrome "앱 설치"
11. Mac에서 백업 가져오기: `deploy/pull-backup.sh` (선택, launchd 또는 cron으로 주 1회)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-14 | Initial draft: Option C(Pragmatic) + Caddy/DuckDNS 선택 반영, Oracle 유휴 회수 정책 공식 문서로 재확인 | yongseok |
| 0.2 | 2026-09-14 | 홈 리전 일본으로 변경(한국 리전 무료 가입 불가), Vercel·GCP 대안 검토 기록, A1 재고 부족 시 E2.1.Micro + amd64 빌드 대안 추가 | yongseok |
| 0.5 | 2026-09-14 | 사용자 요청: 달력 요일 순서를 일요일 시작(일~토)으로 변경 (`CALENDAR_WEEK_STARTS_ON`) | yongseok |
| 0.4 | 2026-09-14 | Do(M5) 반영: `uvicorn[standard]`→`uvicorn`(이미지 축소), HEALTHCHECK `--start-interval=2s`, `refetchOnWindowFocus: 'always'`(기기 간 반영 SC), 401·로그아웃 시 `resetToLoggedOut`(clear() 후 구독 끊김 버그 수정, E2E L3-4에서 발견), Dockerfile 프론트 스테이지 `--platform=$BUILDPLATFORM`, E2E는 `frontend/e2e/`(auth.setup + L2 12 + L3 5) | yongseok |
| 0.3 | 2026-09-14 | Do(M1~M4) 반영: 서비스워커 대기 문제 수정(§5.5), 공용 훅 `src/hooks/`(useNow·useSheetParams·useTaskToggle)과 `services/task_mutation.py` 추가, 보관된 프로젝트의 할일은 프로젝트 미지정 목록·달력에서 제외, TypeScript 6.0·`.npmrc legacy-peer-deps` | yongseok |
