#!/usr/bin/env bash
# E2E용 백엔드: 새 임시 DB에 seed 데이터를 넣고, 테스트 비밀번호로 frontend/dist 를 서빙한다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/backend"
PY="$BACKEND/.venv/bin/python"

if [ ! -x "$PY" ]; then
  echo "backend/.venv 가 없습니다. README의 '개발 모드'를 먼저 따라 해주세요." >&2
  exit 1
fi
if [ ! -f "$ROOT/frontend/dist/index.html" ]; then
  echo "frontend/dist 가 없습니다. 먼저 'npm run build' 를 실행하세요." >&2
  exit 1
fi

WORK="$(mktemp -d -t todolist-e2e)"
cd "$BACKEND"

APP_PASSWORD_HASH="$("$PY" -c "from app.auth import hash_password; print(hash_password('${E2E_PASSWORD:-e2e-password}'))")"
export APP_PASSWORD_HASH
export DATABASE_PATH="$WORK/todo.db"
export BACKUP_DIR="$WORK/backups"
export STATIC_DIR="$ROOT/frontend/dist"
export COOKIE_SECURE=false
export BACKUP_CHECK_INTERVAL=0

"$PY" -m app.cli seed
exec "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port "${E2E_PORT:-8787}"
