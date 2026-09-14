# Todo — 나만의 할일·마감·달력

프로젝트별 할일을 마감 순서로 모아 보고, 달력으로 일정을 한눈에 확인하는 **1인용 PWA**입니다.
PC와 폰이 같은 서버 DB를 쓰기 때문에 어느 기기에서 바꿔도 다른 기기에 반영되고, Oracle Cloud Always Free에 올려 **월 0원**으로 운영합니다.

## 기능

- 프로젝트: 생성·색상·순서 변경·보관·삭제
- 할일: 제목·메모·마감 날짜(+시간)·우선순위·태그·반복(매일/매주 요일/매월/매년)
- 홈: 지남 / 오늘 / 내일 / 이번 주 / 이후 / 기한 없음 그룹, 체크 한 번으로 완료 + 실행 취소
- 달력: 월간 그리드(프로젝트 색 점), 날짜를 누르면 그날 할일, 그 날짜로 바로 추가
- 설정: 태그 관리, 보관된 프로젝트 복원, 백업(매일 자동 14개)·JSON 내보내기/가져오기
- PWA: 홈 화면 설치, 새 버전 자동 적용
- 보안: 비밀번호(argon2) 로그인, HttpOnly 세션 쿠키, 로그인 시도 제한, Origin 검사, HTTPS·보안 헤더

## 구조

```
todolist/
├── backend/            FastAPI + SQLAlchemy + SQLite (pytest)
├── frontend/           React + Vite + TypeScript + Tailwind v4 + TanStack Query (Vitest, Playwright)
├── deploy/             Caddyfile, Oracle 배포 가이드, 백업 복사 스크립트
├── docs/               PDCA 문서 (Plan / Design)
├── Dockerfile          프론트 빌드 → Python 런타임 단일 이미지
├── docker-compose.yml        운영: app + Caddy(자동 HTTPS)
└── docker-compose.local.yml  로컬: app만 127.0.0.1:8000
```

## 로컬에서 Docker로 실행

```bash
cp .env.example .env
docker compose -f docker-compose.local.yml build

# 로그인 비밀번호 해시 만들기 → 출력된 해시를 .env 의 APP_PASSWORD_HASH='...' 에 붙여넣기 (작은따옴표 필수)
docker compose -f docker-compose.local.yml run --rm --no-deps app python -m app.cli hash-password

docker compose -f docker-compose.local.yml up -d
# (선택) 데모 데이터: docker compose -f docker-compose.local.yml exec app python -m app.cli seed
```

<http://127.0.0.1:8000> 에서 로그인합니다. 데이터는 Docker 볼륨 `todolist-local_todo_local_data`에 저장됩니다.

## 개발 모드 (핫 리로드)

```bash
# 백엔드 (터미널 1)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
export APP_PASSWORD_HASH="$(.venv/bin/python -c "from app.auth import hash_password; print(hash_password('dev-password'))")"
export DATABASE_PATH=./data/dev.db BACKUP_DIR=./data/backups COOKIE_SECURE=false STATIC_DIR=../frontend/dist
.venv/bin/python -m app.cli seed
.venv/bin/uvicorn app.main:app --reload --port 8000

# 프론트엔드 (터미널 2) — /api 요청은 8000으로 프록시됩니다
cd frontend
npm install
npm run dev      # http://localhost:5173 (비밀번호: dev-password)
```

## 테스트

| 대상 | 명령 |
|------|------|
| 백엔드 API·로직 | `cd backend && .venv/bin/python -m pytest --cov=app` |
| 백엔드 린트 | `cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .` |
| 프론트 타입·린트·단위 | `cd frontend && npm run typecheck && npm run lint && npm test` |
| E2E (Playwright) | `cd frontend && npm run build && npm run e2e` |

E2E는 임시 DB에 seed 데이터와 테스트 비밀번호로 백엔드를 자동으로 띄워 실행합니다. 백엔드 venv가 먼저 준비돼 있어야 합니다.

## 배포 (Oracle Cloud Always Free)

자세한 순서는 **[deploy/oracle-setup.md](deploy/oracle-setup.md)** 를 따르세요. 요약:

1. Oracle 가입 (홈 리전 **일본**), Pay As You Go 전환, 예산 알림
2. Ampere A1 VM(Ubuntu 24.04, 1 OCPU / 6GB) 생성, 80/443 개방
3. Docker 설치, DuckDNS 서브도메인을 VM IP에 연결
4. 코드 복사 → `.env` 작성 → `docker compose up -d --build`
5. `https://<서브도메인>.duckdns.org` 접속 → 폰·PC 홈 화면에 설치

## 백업과 복원

- 자동: `data/backups/todo-YYYYMMDD.db` (매일, 최근 14개)
- Mac으로 복사: `deploy/pull-backup.sh ubuntu@<VM_IP>`
- 복원: [deploy/oracle-setup.md §10](deploy/oracle-setup.md#10-백업과-복원)
- 앱 설정 화면에서 JSON 내보내기/가져오기

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `APP_PASSWORD_HASH` | (필수) | argon2 해시, `.env`에서는 작은따옴표로 감싸기 |
| `DOMAIN` | (운영 필수) | Caddy가 인증서를 받을 도메인 |
| `SESSION_DAYS` | `90` | 로그인 유지 일수 |
| `COOKIE_SECURE` | `true` | 로컬 HTTP에서만 `false` (compose.local이 설정) |
| `DATABASE_PATH` | `/data/todo.db` | SQLite 파일 |
| `BACKUP_DIR` | `/data/backups` | 백업 폴더 |
| `BACKUP_KEEP` | `14` | 자동 백업 보관 개수 |
| `TZ` | `Asia/Seoul` | 날짜 기준 타임존 |
| `ENABLE_DOCS` | `false` | `/docs` API 문서 노출 |

## 문서

- 계획: [docs/01-plan/features/todolist.plan.md](docs/01-plan/features/todolist.plan.md)
- 설계: [docs/02-design/features/todolist.design.md](docs/02-design/features/todolist.design.md)
