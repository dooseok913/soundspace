#!/bin/bash
# MusicSpace Frontend 배포 스크립트
# docker-compose.frontend.yml 사용 (프론트엔드 전용)

set -e

cd ~/Final_team_project/humamAppleTeamPreject001

echo "=== MusicSpace Frontend Deploy ==="

# 0. 네트워크 확인 및 생성
if ! docker network inspect musicspace-network >/dev/null 2>&1; then
    echo "[0/4] Creating network..."
    docker network create musicspace-network
fi

# 1. 최신 코드 가져오기
echo "[1/4] Pulling latest code..."
git stash
git pull
git stash pop 2>/dev/null || true

# 2. 기존 컨테이너 정리
echo "[2/5] Cleaning up old container..."
docker rm -f musicspace-frontend 2>/dev/null || true

# 3. npm 빌드
echo "[3/5] Building React app..."
npm install
npm run build

# 4. 프론트엔드 빌드 및 시작
echo "[4/5] Building and starting frontend..."
docker-compose -f docker-compose.frontend-local.yml up -d --build

# 5. 상태 확인
echo "[5/5] Checking status..."
docker ps --filter "name=musicspace-frontend"

echo ""
echo "=== Deploy Complete ==="
echo "Frontend: https://imaiplan.sytes.net"
