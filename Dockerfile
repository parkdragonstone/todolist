# syntax=docker/dockerfile:1
# Design Ref: §11.1 — 멀티스테이지: Node로 PWA 빌드 → Python 런타임 (비root 실행, 헬스체크)

# ── 1) 프론트엔드 빌드 ──────────────────────────────────────────────────────
# 빌드 결과(정적 파일)는 CPU 아키텍처와 무관하므로 빌드 머신의 네이티브 플랫폼에서 실행한다.
# (arm64 Mac에서 amd64 이미지를 만들 때도 Node 빌드는 에뮬레이션 없이 빠르게 돈다)
FROM --platform=$BUILDPLATFORM node:24-alpine AS web
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json frontend/.npmrc ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ── 2) 런타임 ──────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TZ=Asia/Seoul \
    DATABASE_PATH=/data/todo.db \
    BACKUP_DIR=/data/backups \
    STATIC_DIR=/srv/static

WORKDIR /srv
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/app ./app
COPY --from=web /web/dist ./static

RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin appuser \
    && mkdir -p /data \
    && chown appuser:appuser /data
USER appuser

EXPOSE 8000
# 기동 직후(start-period)에는 2초마다 확인해 Caddy의 depends_on(service_healthy)이 오래 기다리지 않게 한다
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --start-interval=2s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2)" || exit 1

# 앱 포트는 compose 내부 네트워크의 Caddy만 접근하므로 프록시 헤더를 신뢰한다
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
