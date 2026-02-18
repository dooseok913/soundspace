# Docker 환경 가이드

## 파일 구조

```
humamAppleTeamPreject001/
├── Dockerfile                           # Frontend 빌드
├── docker-compose.frontend-local.yml    # 로컬 프론트엔드
├── docker-compose.frontend-server.yml   # 서버 프론트엔드
├── docker-compose.fullstack-local.yml     # 로컬 전체 스택 (빌드)
├── docker-compose.fullstack-server.yml    # 서버 전체 스택 (Docker Hub)
├── nginx.conf                           # 서버용 (HTTPS)
└── nginx.local.conf                     # 로컬용 (HTTP)
```

---

## Docker Compose 파일 정리

| 파일 | 용도 | 방식 |
|------|------|------|
| docker-compose.frontend-local.yml | 로컬 프론트엔드 | 빌드 |
| docker-compose.frontend-server.yml | 서버 프론트엔드 | 빌드 |
| docker-compose.fullstack-local.yml | 로컬 전체 스택 | 빌드 |
| docker-compose.fullstack-server.yml | 서버 전체 스택 | Docker Hub pull |

---

## 프론트엔드 배포

### 로컬
```bash
cd humamAppleTeamPreject001
docker-compose -f docker-compose.frontend-local.yml up -d --build
```
- 접속: http://localhost

### 서버
```bash
cd /home/mibeen/music_space_place/Final_team_project/humamAppleTeamPreject001
git pull
docker-compose -f docker-compose.frontend-server.yml up -d --build
```
- 접속: https://imaiplan.sytes.net

---

## 백엔드 배포

### 로컬 (전체 스택 빌드)
```bash
cd humamAppleTeamPreject001
docker-compose -f docker-compose.fullstack-local.yml up -d --build
```

### 서버 (Docker Hub pull)
```bash
cd /home/mibeen/music_space_place/Final_team_project/humamAppleTeamPreject001
docker-compose -f docker-compose.fullstack-server.yml pull
docker-compose -f docker-compose.fullstack-server.yml up -d
```

---

## 사전 조건

### 프론트엔드 배포 시
- 백엔드 컨테이너 실행 중: `musicspace-backend`, `musicspace-spring-backend`, `musicspace-fastapi`
- Docker 네트워크: `humamappleteampreject001_musicspace-network`
- SSL 인증서 (서버): `/etc/letsencrypt/live/imaiplan.sytes.net/`

---

## API 라우팅

| API 경로 | 백엔드 | 설명 |
|----------|--------|------|
| `/api/auth/*` | Spring Boot | 인증 |
| `/api/playlists/*` | Spring Boot | 플레이리스트 |
| `/api/pms/*` | Spring Boot | Personal Music Space |
| `/api/ems/*` | Spring Boot | External Music Space |
| `/api/gms/*` | Spring Boot | Gateway Music Space |
| `/api/kuka/*` | FastAPI | L1 Kuka 추천 |
| `/api/m1/*`, `/api/m2/*`, `/api/m3/*` | FastAPI | AI 모델 |
| `/api/spotify/browser/*` | Node.js | Spotify 브라우저 자동화 |

---

## 유용한 명령어

```bash
# 컨테이너 상태
docker ps | grep musicspace

# 로그 확인
docker logs musicspace-frontend --tail 50

# 컨테이너 재시작
docker restart musicspace-frontend

# 불필요한 이미지 정리
docker system prune -f
```
