# MusicSpace — 프로젝트 개요

> AI 기반 개인화 음악 스트리밍 플랫폼
> Tidal · Spotify · YouTube · YouTube Music · Apple Music · iTunes 통합

---

## 목차

1. [프로젝트 소개](#1-프로젝트-소개)
2. [시스템 구성](#2-시스템-구성)
3. [저장소 구조](#3-저장소-구조)
4. [빠른 시작 (MacBook 로컬)](#4-빠른-시작-macbook-로컬)
5. [주요 기능](#5-주요-기능)
6. [관련 문서](#6-관련-문서)

---

## 1. 프로젝트 소개

MusicSpace는 다수의 스트리밍 플랫폼을 통합하고, 머신러닝 기반 AI 추천 엔진을 결합한 개인화 음악 공간입니다.

**세 가지 음악 공간:**

| 공간 | 이름 | 설명 |
|------|------|------|
| PMS | Personal Music Space | 개인 플레이리스트 관리, Tidal/Spotify 연동 |
| GMS | Gateway Music Space | AI 추천 허브, M1/M2/M3/LLM 모델 접근 |
| EMS | External Music Space | 외부 플레이리스트 탐색 및 가져오기 |

**기술 스택:**

| 레이어 | 기술 |
|--------|------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| API Gateway | Nginx (reverse proxy) |
| Main Backend | Spring Boot 3 (Java 17) |
| AI/ML Service | FastAPI (Python 3.11) |
| Browser Automation | Node.js + Playwright |
| Database | MariaDB 10.11 |
| Cache / Session | Redis 7 |
| Container | Docker + Docker Compose |

---

## 2. 시스템 구성

```
사용자 브라우저
      │
      ▼
  Nginx (80/443/8443)
      │
      ├── /api/auth, /api/playlists, /api/tidal, /api/spotify
      │   /api/youtube, /api/pms, /api/ems, /api/gms, /api/training  →  Spring Boot :8080
      │
      ├── /api/spotify/browser, /api/spotify/token                   →  Node.js     :3001
      │
      ├── /api/m1, /api/m2, /api/m3, /api/llm
      │   /api/recommend, /api/analyze, /api/enrich                  →  FastAPI     :8000
      │
      └── /* (SPA)                                                   →  React 정적 파일
```

**컨테이너 목록:**

| 컨테이너 | 이미지 | 포트 |
|----------|--------|------|
| musicspace-frontend | nginx:alpine (Dockerfile 빌드) | 80, 443, 8443 |
| musicspace-spring-backend | openjdk:17 (Dockerfile 빌드) | 8080 (내부) |
| musicspace-fastapi | python:3.11 (Dockerfile 빌드) | 8000 (내부) |
| musicspace-backend | node:20 (Dockerfile 빌드) | 3001 (내부) |
| musicspace-db | mariadb:10.11 | 3306 |
| musicspace-redis | redis:7-alpine | 6379 |

---

## 3. 저장소 구조

```
Team_final_project/
├── humamAppleTeamPreject001/   ← 프론트엔드 (이 레포)
│   ├── src/                   ← React 소스
│   ├── server/                ← Node.js Playwright 서버
│   ├── docs/                  ← 프로젝트 문서 (현재 파일)
│   ├── nginx.local.conf       ← Nginx 설정
│   └── docker-compose.*.yml   ← 배포 설정
│
├── 2TeamFinalProject-BE/       ← Spring Boot 백엔드
│   └── src/main/java/com/springboot/finalprojcet/
│       └── domain/            ← auth, pms, ems, gms, spotify, tidal ...
│
└── FAST_API/                  ← Python AI/ML 서버
    ├── M1/                    ← 오디오 특성 예측 + 하이브리드 추천
    ├── M2/                    ← TF-IDF + GBR 콘텐츠 기반 추천
    ├── M3/                    ← CatBoost 협업 필터링
    ├── LLM/                   ← ChromaDB + Gemini 자연어 검색
    ├── main.py                ← FastAPI 앱 진입점
    ├── audio_enrichment.py    ← 오디오 특성 자동 채움
    └── init_user_models.py    ← 회원가입 시 모델 초기화
```

---

## 4. 빠른 시작 (MacBook 로컬)

### 사전 준비

- Docker Desktop 설치 및 실행
- 세 레포 클론 (같은 부모 디렉토리에)
- `.env` 파일 작성 (`.env.example` 참고)

### 전체 스택 실행

```bash
cd humamAppleTeamPreject001

# 전체 빌드 및 시작 (최초 실행 / 코드 변경 후)
docker compose -f docker-compose.macbook-dockerhub.yml up -d --build

# 상태 확인
docker ps

# 로그 확인
docker compose -f docker-compose.macbook-dockerhub.yml logs -f
```

### 프론트엔드만 업데이트

```bash
./deploy-frontend.sh
```

### 접속 URL

| 환경 | URL |
|------|-----|
| 로컬 | http://localhost |
| 로컬 HTTPS | https://localhost:8443 |
| 외부 도메인 | https://imapplepie20.tplinkdns.com:8443 |

---

## 5. 주요 기능

### 음악 플레이어
- **재생 우선순위:** Tidal HLS → YouTube → iTunes Preview → YouTube Search
- hls.js 기반 Tidal HLS 스트리밍 (품질 선택 가능)
- React Context 기반 전역 플레이어 상태

### AI 추천 엔진
| 모델 | 방식 | 설명 |
|------|------|------|
| M1 | 오디오 특성 + 하이브리드 | Spotify 오디오 벡터 기반 개인화 |
| M2 | TF-IDF + GBR | 텍스트(아티스트/곡명) 기반 콘텐츠 필터링 |
| M3 | CatBoost | 사용자 행동 협업 필터링 |
| LLM | ChromaDB + Gemini | 자연어로 음악 검색/추천 |

### 플랫폼 연동
| 플랫폼 | 인증 방식 | 주요 기능 |
|--------|----------|---------|
| Tidal | OAuth 2.0 (PKCE) | 플레이리스트 가져오기, HLS 스트리밍 |
| Spotify | OAuth 2.0 + Browser (Playwright) | 플레이리스트, 오디오 특성, 추천 |
| YouTube | API Key + OAuth | 영상 검색, 재생 |
| YouTube Music | API Key | 음악 검색 |
| Apple Music | MusicKit JS | 카탈로그 검색 |
| iTunes | Search API | 미리듣기 재생 |

---

## 6. 관련 문서

| 문서 | 설명 |
|------|------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 시스템 아키텍처 및 데이터 흐름 |
| [DEPLOY_MACBOOK.md](DEPLOY_MACBOOK.md) | MacBook 로컬 배포 상세 가이드 |
| [API_REFERENCE.md](API_REFERENCE.md) | 전체 API 엔드포인트 레퍼런스 |
| [AI_MODELS.md](AI_MODELS.md) | AI/ML 모델 상세 설명 |
| [STREAMING_PLATFORMS.md](STREAMING_PLATFORMS.md) | 스트리밍 플랫폼 연동 현황 |
| [서버운영가이드.md](서버운영가이드.md) | 서버 운영 및 장애 대응 |
| [dbSchema.sql](dbSchema.sql) | 데이터베이스 스키마 |
