#!/bin/bash
# MusicSpace Ubuntu Deploy Script
# Docker Hub에서 이미지 Pull 후 실행

set -e

DEPLOY_DIR="/home/mibeen/music_space_place/Final_team_project/humanAppleTeamPreject001"

echo "========================================"
echo "MusicSpace Ubuntu Deploy"
echo "========================================"

cd $DEPLOY_DIR

echo "[1/4] Pulling latest images from Docker Hub..."
docker compose -f docker-compose.prod.yml pull

echo "[2/4] Stopping existing containers..."
docker compose -f docker-compose.prod.yml down

echo "[3/4] Starting containers..."
docker compose -f docker-compose.prod.yml up -d

echo "[4/4] Checking container status..."
sleep 5
docker compose -f docker-compose.prod.yml ps

echo ""
echo "========================================"
echo "Deploy Complete!"
echo "========================================"
echo ""
echo "Logs: docker compose -f docker-compose.prod.yml logs -f"
echo "Site: https://imaiplan.sytes.net"
