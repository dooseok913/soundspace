# MusicSpace — 시스템 아키텍처

---

## 1. 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 브라우저                            │
│              React 18 + TypeScript + Tailwind CSS               │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS (443 / 8443)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Nginx Reverse Proxy                           │
│              musicspace-frontend (nginx:alpine)                  │
│                                                                  │
│  포트: 80 (HTTP→HTTPS redirect)                                  │
│        443 (imaiplan.sytes.net)                                  │
│        8443 (imapplepie20.tplinkdns.com)                         │
└──────┬──────────────────┬──────────────────┬────────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐  ┌────────────────┐  ┌──────────────┐
│ Spring Boot │  │    FastAPI     │  │   Node.js    │
│   :8080     │  │    :8000       │  │    :3001     │
│             │  │                │  │              │
│ Main API    │  │ AI/ML Service  │  │  Playwright  │
│ Auth/JWT    │  │ M1/M2/M3/LLM   │  │  Spotify     │
│ Playlists   │  │ Enrichment     │  │  Browser     │
│ Streaming   │  │ Recommend      │  │  Automation  │
└──────┬──────┘  └───────┬────────┘  └──────┬───────┘
       │                  │                  │
       └──────────────────┴──────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
      ┌──────────────┐       ┌─────────────────┐
      │  MariaDB     │       │     Redis        │
      │  :3306       │       │     :6379        │
      │              │       │                  │
      │  music_space │       │  JWT Refresh     │
      │  _db         │       │  Token Cache     │
      └──────────────┘       └─────────────────┘
```

---

## 2. 네트워크 구성

모든 컨테이너는 `musicspace-network` (bridge) 네트워크로 통신합니다.

### Nginx 라우팅 규칙

| 경로 패턴 | 대상 | 설명 |
|-----------|------|------|
| `/api/auth/**` | Spring Boot | JWT 로그인/로그아웃/갱신 |
| `/api/playlists/**` | Spring Boot | 플레이리스트 CRUD |
| `/api/pms/**` | Spring Boot | Personal Music Space |
| `/api/ems/**` | Spring Boot | External Music Space |
| `/api/gms/**` | Spring Boot | Gateway Music Space |
| `/api/tidal/**` | Spring Boot | Tidal OAuth + 플레이리스트 |
| `/api/spotify/**` | Spring Boot | Spotify API |
| `/api/youtube/**` | Spring Boot | YouTube API |
| `/api/youtube-music/**` | Spring Boot | YouTube Music API |
| `/api/itunes/**` | Spring Boot | iTunes Search API |
| `/api/genres/**` | Spring Boot | 장르 관리 |
| `/api/analysis/**` | Spring Boot | 분석 |
| `/api/training/**` | Spring Boot | ML 학습 데이터 |
| `/api/stats/**` | Spring Boot | 통계 |
| `/api/spotify/browser/**` | Node.js | Playwright 브라우저 자동화 |
| `/api/spotify/token/**` | Node.js | Spotify 토큰 관리 |
| `/api/m1/**` | FastAPI | M1 하이브리드 추천 |
| `/api/m2/**` | FastAPI | M2 콘텐츠 기반 추천 |
| `/api/m3/**` | FastAPI | M3 협업 필터링 |
| `/api/llm/**` | FastAPI | LLM 자연어 추천 |
| `/api/recommend/**` | FastAPI | 통합 추천 |
| `/api/analyze/**` | FastAPI | 오디오 분석 |
| `/api/enrich/**` | FastAPI | 오디오 특성 자동 채움 |
| `/api/kuka/**` | FastAPI | Kuka Spotify 추천 |

---

## 3. 서비스별 상세

### 3-1. Frontend (React + Vite)

```
src/
├── pages/
│   ├── auth/          로그인, 회원가입
│   ├── music/
│   │   ├── PersonalMusicSpace.tsx    PMS 메인
│   │   ├── GatewayMusicSpace.tsx     GMS (AI 추천 허브)
│   │   ├── ExternalMusicSpace.tsx    EMS
│   │   ├── MusicConnections.tsx      플랫폼 연결 관리
│   │   └── Settings.tsx              관리자 설정 (MASTER only)
│   └── admin/         관리자 패널
├── components/
│   ├── music/
│   │   ├── MusicPlayer.tsx           전역 플레이어
│   │   ├── MusicSidebar.tsx          좌측 사이드바
│   │   ├── LLMModal/                 자연어 검색 UI
│   │   └── ems/                      EMS 컴포넌트
│   └── layout/        Header, Sidebar
└── context/           전역 상태 (플레이어, 인증 등)
```

**빌드 방식:**
- `Dockerfile` 내부에서 `npx vite build` 실행
- 결과물을 nginx 이미지에 복사
- `nginx.local.conf`는 bind mount로 주입 (런타임 설정)

### 3-2. Spring Boot Backend

```
domain/
├── auth/      JWT 인증, 회원가입/로그인, Redis refresh token
├── pms/       개인 플레이리스트, 트랙 관리
├── ems/       외부 플레이리스트, 통계
├── gms/       AI 추천 Gateway
├── tidal/     Tidal OAuth, HLS 스트리밍
├── spotify/   Spotify API, 오디오 특성
├── youtube/   YouTube Data API
├── itunes/    iTunes Search
├── training/  ML 학습 데이터 추출
├── analysis/  음악 분석
├── cart/      플레이리스트 장바구니
├── stats/     통계 집계
└── user/      사용자 관리
```

**핵심 기술:**
- Spring Security + JWT (액세스 15분 / 리프레시 7일)
- MyBatis + JPA 혼용
- Redis: refresh token 저장소

### 3-3. FastAPI AI/ML Service

```
FAST_API/
├── M1/   오디오 특성 벡터 기반 하이브리드 추천
│         audio_predictor.pkl (297KB)
│         per-user 모델 (user_models/)
├── M2/   TF-IDF + GBR 콘텐츠 기반 추천
│         tfidf_gbr_models.pkl (7.1MB)
├── M3/   CatBoost 협업 필터링
│         recommender_U2_MyInitialT_20260201.cbm (1MB)
├── LLM/  ChromaDB + Gemini 자연어 검색
├── audio_enrichment.py   오디오 특성 자동 예측 저장
└── init_user_models.py   회원가입 시 모델 초기화
```

### 3-4. Node.js Backend (Playwright)

- Spotify 브라우저 자동화 (Playwright)
- Spotify OAuth 토큰 관리
- `server/` 폴더에 위치

---

## 4. 인증 흐름

```
로그인 요청
    │
    ▼
Spring Boot /api/auth/login
    │
    ├── MariaDB에서 사용자 조회
    ├── BCrypt 비밀번호 검증
    ├── Access Token 생성 (JWT, 15분)
    ├── Refresh Token 생성 (JWT, 7일)
    │   └── Redis에 저장
    └── 응답 (Access + Refresh Token)

API 요청
    │
    ▼
Nginx → Spring Boot
    │
    ├── JWT 검증 (Spring Security Filter)
    │   ├── 유효 → 요청 처리
    │   └── 만료 → 401
    │
    └── /api/auth/refresh 로 갱신 요청
        ├── Redis에서 Refresh Token 확인
        └── 새 Access Token 발급
```

---

## 5. AI 추천 흐름

```
사용자 행동 (좋아요/재생/스킵)
    │
    ▼
Spring Boot /api/training → 학습 데이터 DB 저장

회원가입 또는 데이터 누적
    │
    ▼
FastAPI /api/init-models
    ├── [NEW] audio_enrichment: PMS 트랙 오디오 특성 예측 저장
    ├── M1 개인화 모델 학습 (오디오 벡터 기반)
    ├── M2 사용자 콘텐츠 프로파일 구성
    └── M3 협업 필터링 모델 업데이트

추천 요청
    │
    ├── /api/m1/recommend → 하이브리드 추천
    ├── /api/m2/recommend → 콘텐츠 기반
    ├── /api/m3/recommend → 협업 필터링
    └── /api/llm/search   → 자연어 (ChromaDB+Gemini)
```

---

## 6. 오디오 특성 자동 채움 (Audio Enrichment)

기존 tracks 테이블에 오디오 특성(danceability, energy 등)이 없는 트랙을 M2 GBR 모델로 자동 예측하여 저장합니다.

**엔드포인트:**

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/enrich-all` | 전체 미보유 트랙 배치 처리 (백그라운드) |
| POST | `/api/enrich-tracks` | 특정 track_id 리스트 처리 |
| GET | `/api/enrich-status` | 진행 상태 및 커버리지 확인 |

**저장 대상 컬럼:** `danceability`, `energy`, `valence`, `acousticness`, `instrumentalness`, `liveness`, `speechiness`, `tempo`, `loudness` + `external_metadata` JSON
