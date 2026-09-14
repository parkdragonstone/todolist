#!/usr/bin/env bash
# Design Ref: §4.2 자동 백업 — VM의 SQLite 백업 파일을 Mac으로 복사한다 (VM 디스크 유실 대비).
#
# 사용법: deploy/pull-backup.sh ubuntu@<VM_IP> [ssh_key] [저장_폴더]
#   ssh_key    기본값 ~/.ssh/oci_todolist
#   저장_폴더  기본값 ~/todolist-backups
#   REMOTE_DIR 환경변수로 VM 쪽 백업 폴더를 바꿀 수 있다 (기본 todolist/data/backups)
set -euo pipefail

REMOTE="${1:?사용법: $0 user@host [ssh_key] [저장_폴더]}"
KEY="${2:-$HOME/.ssh/oci_todolist}"
DEST="${3:-$HOME/todolist-backups}"
REMOTE_DIR="${REMOTE_DIR:-todolist/data/backups}"
KEEP_LOCAL=60

mkdir -p "$DEST"

# 이미 받은 파일은 건너뛰고 새 백업만 복사한다
rsync -av --ignore-existing -e "ssh -i $KEY" "$REMOTE:$REMOTE_DIR/" "$DEST/"

# 로컬에는 최근 KEEP_LOCAL개만 남긴다
ls -1t "$DEST"/todo-*.db 2>/dev/null | tail -n +$((KEEP_LOCAL + 1)) | while read -r old; do
  rm -f -- "$old"
done

echo "백업 복사 완료: $DEST ($(ls -1 "$DEST"/todo-*.db 2>/dev/null | wc -l | tr -d ' ')개)"
