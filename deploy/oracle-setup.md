# Oracle Cloud 배포 가이드 (Always Free · 일본 리전)

> Design Ref: §7.4, §11.4 — 월 0원으로 Oracle Always Free VM에 Docker + Caddy(자동 HTTPS)로 배포합니다.
> 명령은 **Mac** 또는 **VM** 중 어디서 실행하는지 표시해 두었습니다.

## 0. 준비물

| 항목 | 설명 |
|------|------|
| 결제 카드 | Oracle 가입 시 본인 확인용 (Always Free 한도 안에서는 청구되지 않음) |
| SSH 키 | VM 접속용 (아래 2단계에서 생성) |
| DuckDNS 계정 | 무료 서브도메인 (GitHub·Google 계정으로 로그인) |
| 이 저장소 | Mac에 있는 `todolist/` 폴더 |

---

## 1. Oracle 계정 만들기

1. <https://www.oracle.com/cloud/free/> → **Start for free**
2. **Home Region**: `Japan East (Tokyo)` 또는 `Japan Central (Osaka)`
   - 한국 리전은 무료 가입 홈 리전으로 고를 수 없습니다.
   - **홈 리전은 가입 후 바꿀 수 없고**, Always Free 컴퓨트는 홈 리전에서만 만들 수 있습니다.
3. 가입이 끝나면 **Billing → Upgrade to Pay As You Go** (권장)
   - Always Free 한도 안에서는 계속 0원입니다.
   - 7일 동안 CPU·네트워크·메모리 사용률이 낮으면 Always Free 인스턴스가 회수될 수 있는데, PAYG 계정은 이 회수 대상에서 빠집니다. 할일 앱은 사용률이 낮아서 중요합니다.
4. **Billing → Budgets → Create Budget**: 금액 1 USD, 알림 이메일 설정 (혹시 모를 과금을 바로 알 수 있게)

## 2. SSH 키 만들기 (Mac)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/oci_todolist -C todolist
cat ~/.ssh/oci_todolist.pub   # 3단계에서 붙여넣기
```

## 3. VM 인스턴스 만들기 (Oracle 콘솔)

**Compute → Instances → Create instance**

| 항목 | 값 |
|------|----|
| Image | Canonical **Ubuntu 24.04** (aarch64) |
| Shape | Ampere **VM.Standard.A1.Flex** · **1 OCPU / 6 GB** |
| Networking | 새 VCN + public subnet, **Assign a public IPv4 address** 체크 |
| SSH keys | `oci_todolist.pub` 내용 붙여넣기 |
| Boot volume | 기본값 (Always Free 합산 200GB 이내) |

생성 후 **Public IP**를 메모합니다. 인스턴스를 삭제하지 않는 한 이 IP는 유지됩니다.

> **"Out of capacity" 오류가 나면**
> - 몇 시간 뒤나 새벽 시간대에 다시 시도하고, PAYG로 전환한 뒤 다시 시도합니다.
> - 계속 실패하면 `VM.Standard.E2.1.Micro`(AMD x86, 1GB, Always Free)로 만들고 [11. E2.1.Micro로 만든 경우](#11-e21microx86로-만든-경우)를 따릅니다.

## 4. 방화벽 열기

### 4-1. VCN Security List (Oracle 콘솔)

**Networking → Virtual cloud networks → (VCN) → Security Lists → Default → Add Ingress Rules**

| Source CIDR | Protocol | Port | 용도 |
|-------------|----------|------|------|
| `0.0.0.0/0` | TCP | 80 | 인증서 발급, HTTP→HTTPS 리다이렉트 |
| `0.0.0.0/0` | TCP | 443 | HTTPS |
| `0.0.0.0/0` | UDP | 443 | HTTP/3 (선택) |

기본으로 열려 있는 22(SSH)는 가능하면 Source를 **내 공인 IP/32**로 좁혀 두세요.

### 4-2. VM 내부 iptables (VM)

Oracle의 Ubuntu 이미지는 VM 안에서도 80/443을 막아 둡니다.

```bash
ssh -i ~/.ssh/oci_todolist ubuntu@<PUBLIC_IP>

sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 5. 서버 기본 설정 (VM)

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades

# Docker Engine + compose 플러그인 (공식 설치 스크립트)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit   # 다시 접속해야 docker 그룹이 적용됩니다
```

SSH 비밀번호 로그인이 꺼져 있는지 확인합니다. Oracle Ubuntu 이미지는 기본으로 꺼져 있습니다.

```bash
sudo sshd -T | grep -i passwordauthentication   # passwordauthentication no
```

## 6. DuckDNS 도메인 연결

1. <https://www.duckdns.org> 로그인 → 서브도메인 입력(예: `mytodo`) → **add domain**
2. **current ip** 칸에 VM의 Public IP 입력 → **update ip**
3. 확인 (Mac): `dig +short mytodo.duckdns.org` → VM IP가 나오면 됩니다.

## 7. 앱 배포

### 7-1. 코드 올리기 (Mac)

```bash
cd ~/Desktop/Python/todolist
rsync -av \
  --exclude .git --exclude .bkit --exclude .env --exclude data \
  --exclude .venv --exclude node_modules --exclude dist \
  --exclude __pycache__ --exclude test-results --exclude playwright-report \
  ./ ubuntu@<PUBLIC_IP>:~/todolist/ -e "ssh -i ~/.ssh/oci_todolist"
```

> git 원격 저장소(비공개)를 쓴다면 VM에서 `git clone` 해도 됩니다.

### 7-2. 설정과 실행 (VM)

```bash
cd ~/todolist
cp .env.example .env
mkdir -p data && sudo chown 10001:10001 data     # 컨테이너 사용자(uid 10001)가 쓸 수 있게

docker compose build                              # 1 OCPU 기준 수 분 걸립니다
docker compose run --rm --no-deps app python -m app.cli hash-password
# 비밀번호를 두 번 입력하면 해시가 출력됩니다

nano .env
#   APP_PASSWORD_HASH='출력된 해시'     ← 작은따옴표 필수
#   DOMAIN=mytodo.duckdns.org

docker compose up -d
docker compose ps                                 # app: healthy, caddy: running
docker compose logs -f caddy                      # "certificate obtained successfully" 확인 후 Ctrl+C
```

## 8. 폰·PC에 설치

1. `https://todolistpys.duckdns.org` 접속 → 로그인
2. 설치
   - **iPhone**: Safari → 공유 → **홈 화면에 추가**
   - **Android**: Chrome 메뉴 → **앱 설치**
   - **Mac/PC**: Chrome 주소창 오른쪽 **설치** 아이콘

## 9. 업데이트 배포

```bash
# Mac: 7-1의 rsync 다시 실행
# VM:
cd ~/todolist
docker compose up -d --build
docker image prune -f
```

설치된 PWA는 다음에 열 때 새 버전으로 자동 교체되고 새로고침됩니다.

## 10. 백업과 복원

| 방식 | 위치·방법 |
|------|-----------|
| 자동 백업 | VM `~/todolist/data/backups/todo-YYYYMMDD.db` (매일 1개, 최근 14개 보관) |
| 수동 백업 | 앱 **설정 → 백업 → 지금 백업** |
| Mac으로 복사 | `deploy/pull-backup.sh ubuntu@<PUBLIC_IP>` (주 1회 권장) |
| JSON | 앱 **설정 → JSON 내보내기 / 가져오기** (가져오기 직전에 자동 백업) |

**백업 파일로 복원 (VM)**

```bash
cd ~/todolist
docker compose stop app
cp data/backups/todo-20260914.db data/todo.db
rm -f data/todo.db-wal data/todo.db-shm
sudo chown 10001:10001 data/todo.db
docker compose start app
```

**Mac으로 정기 복사 (선택, crontab)**

```bash
crontab -e
# 매주 월요일 09:00
0 9 * * 1 $HOME/Desktop/Python/todolist/deploy/pull-backup.sh ubuntu@<PUBLIC_IP> >> $HOME/todolist-backups/pull.log 2>&1
```

## 11. E2.1.Micro(x86)로 만든 경우

RAM이 1GB라 VM에서 프론트엔드를 빌드하면 메모리가 부족할 수 있습니다. **Mac에서 amd64 이미지를 만들어 전송**합니다.

```bash
# Mac
cd ~/Desktop/Python/todolist
docker buildx build --platform linux/amd64 -t todolist:latest --load .
docker save todolist:latest | gzip | ssh -i ~/.ssh/oci_todolist ubuntu@<PUBLIC_IP> 'gunzip | docker load'

# VM (이미지가 이미 있으므로 빌드 없이 실행)
cd ~/todolist && docker compose up -d
```

스왑 1GB를 추가해 두면 안정적입니다 (VM).

```bash
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 12. 문제 해결

| 증상 | 확인할 것 |
|------|-----------|
| 인증서 발급 실패 (`caddy` 로그에 challenge failed) | 4-1·4-2의 80/443 개방, `dig +short` 결과가 VM IP인지 |
| 브라우저에 502 | `docker compose ps`에서 app이 healthy인지, `docker compose logs app` |
| 로그인이 항상 실패 | `.env`의 해시가 **작은따옴표**로 감싸졌는지, 수정 후 `docker compose up -d` 로 재시작했는지 |
| 로그인 5회 실패 후 잠김 | 15분 기다리거나 `docker compose restart app` |
| `unable to open database file` | `sudo chown 10001:10001 data` |
| 인스턴스가 멈춰 있음 | 유휴 회수 가능성 → 콘솔에서 Start, PAYG 전환 여부 확인 |
| 폰에서 옛 화면이 보임 | 앱을 완전히 닫았다가 다시 열기 (새 버전이 자동 적용) |
