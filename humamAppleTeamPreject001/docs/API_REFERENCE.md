# MusicSpace — API 레퍼런스

> Base URL: `https://imapplepie20.tplinkdns.com:8443`
> 인증: `Authorization: Bearer {accessToken}` (명시된 경우)

---

## 목차

1. [인증 API (Spring Boot)](#1-인증-api)
2. [PMS API (Spring Boot)](#2-pms-api)
3. [EMS API (Spring Boot)](#3-ems-api)
4. [GMS API (Spring Boot)](#4-gms-api)
5. [Tidal API (Spring Boot)](#5-tidal-api)
6. [Spotify API (Spring Boot + Node.js)](#6-spotify-api)
7. [YouTube API (Spring Boot)](#7-youtube-api)
8. [iTunes API (Spring Boot)](#8-itunes-api)
9. [Training API (Spring Boot)](#9-training-api)
10. [AI/ML API (FastAPI)](#10-aiml-api)
11. [Audio Enrichment API (FastAPI)](#11-audio-enrichment-api)

---

## 1. 인증 API

**Base Path:** `/api/auth`

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/auth/signup` | 없음 | 회원가입 |
| POST | `/api/auth/login` | 없음 | 로그인 |
| POST | `/api/auth/logout` | Bearer | 로그아웃 |
| POST | `/api/auth/refresh` | 없음 | 액세스 토큰 갱신 |
| GET | `/api/auth/me` | Bearer | 내 정보 조회 |
| PUT | `/api/auth/me` | Bearer | 내 정보 수정 |

### POST /api/auth/signup

```json
Request:
{
  "username": "string",
  "email": "string",
  "password": "string"
}

Response 200:
{
  "userId": 1,
  "username": "string",
  "email": "string",
  "role": "USER"
}
```

### POST /api/auth/login

```json
Request:
{
  "email": "string",
  "password": "string"
}

Response 200:
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "userId": 1,
    "username": "string",
    "role": "USER"
  }
}
```

### POST /api/auth/refresh

```json
Request:
{
  "refreshToken": "eyJ..."
}

Response 200:
{
  "accessToken": "eyJ..."
}
```

---

## 2. PMS API

**Base Path:** `/api/pms`
**인증:** Bearer Token 필요

### 플레이리스트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/pms/playlists` | 내 플레이리스트 목록 |
| POST | `/api/pms/playlists` | 플레이리스트 생성 |
| GET | `/api/pms/playlists/{id}` | 플레이리스트 상세 |
| PUT | `/api/pms/playlists/{id}` | 플레이리스트 수정 |
| DELETE | `/api/pms/playlists/{id}` | 플레이리스트 삭제 |

### 트랙

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/pms/playlists/{id}/tracks` | 트랙 목록 |
| POST | `/api/pms/playlists/{id}/tracks` | 트랙 추가 |
| DELETE | `/api/pms/playlists/{id}/tracks/{trackId}` | 트랙 제거 |
| POST | `/api/pms/tracks/like` | 트랙 좋아요 |
| POST | `/api/pms/tracks/dislike` | 트랙 싫어요 |

---

## 3. EMS API

**Base Path:** `/api/ems`
**인증:** Bearer Token 필요

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/ems/playlists` | EMS 플레이리스트 목록 |
| GET | `/api/ems/playlists/{id}` | 플레이리스트 상세 + 트랙 |
| GET | `/api/ems/playlists/{id}/tracks` | 트랙 목록 |
| POST | `/api/ems/playlists/{id}/import` | PMS로 가져오기 |
| GET | `/api/ems/stats` | EMS 통계 |
| GET | `/api/ems/playlists/{id}/download` | CSV 다운로드 |

### GET /api/ems/playlists

Query Parameters:

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `page` | int | 페이지 (기본 0) |
| `size` | int | 페이지 크기 (기본 20) |
| `search` | string | 검색어 |
| `platform` | string | 플랫폼 필터 (tidal/spotify/youtube) |

---

## 4. GMS API

**Base Path:** `/api/gms`
**인증:** Bearer Token 필요

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/gms/recommendations` | AI 추천 목록 (통합) |
| POST | `/api/gms/feedback` | 추천 피드백 |

---

## 5. Tidal API

**Base Path:** `/api/tidal`
**인증:** Bearer Token 필요

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/tidal/auth/url` | OAuth 인증 URL 생성 |
| GET | `/api/tidal/callback` | OAuth 콜백 처리 |
| POST | `/api/tidal/disconnect` | 연결 해제 |
| GET | `/api/tidal/playlists` | Tidal 플레이리스트 목록 |
| POST | `/api/tidal/playlists/import` | 플레이리스트 가져오기 |
| GET | `/api/tidal/stream/{trackId}` | HLS 스트림 URL |

### Tidal OAuth 흐름

```
1. GET /api/tidal/auth/url → { authUrl, codeVerifier }
2. 사용자가 authUrl로 이동하여 Tidal 로그인
3. Tidal이 /tidal-callback?code=xxx 로 리다이렉트
4. 프론트에서 code + codeVerifier를 Spring Boot로 전송
5. Spring Boot가 Tidal 토큰 교환 및 DB 저장
```

---

## 6. Spotify API

### Spring Boot 경로 (`/api/spotify`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/spotify/auth/url` | OAuth 인증 URL |
| GET | `/api/spotify/callback` | OAuth 콜백 |
| GET | `/api/spotify/playlists` | 플레이리스트 목록 |
| POST | `/api/spotify/playlists/import` | 플레이리스트 가져오기 |
| GET | `/api/spotify/tracks/{id}/audio-features` | 오디오 특성 |
| GET | `/api/spotify/recommendations` | Spotify 추천 |

### Node.js 경로 (`/api/spotify/browser` — Playwright)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/spotify/browser/search` | 브라우저 기반 검색 |
| GET | `/api/spotify/token` | 토큰 상태 확인 |
| POST | `/api/spotify/token/refresh` | 토큰 갱신 |

---

## 7. YouTube API

**Base Path:** `/api/youtube`, `/api/youtube-music`
**인증:** Bearer Token 필요

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/youtube/search` | YouTube 영상 검색 |
| GET | `/api/youtube/video/{id}` | 영상 정보 |
| GET | `/api/youtube-music/search` | YouTube Music 검색 |

---

## 8. iTunes API

**Base Path:** `/api/itunes`
**인증:** Bearer Token 필요

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/itunes/search` | iTunes 검색 |
| GET | `/api/itunes/lookup` | Apple Music ID로 조회 |

Query Parameters:

| 파라미터 | 설명 |
|---------|------|
| `term` | 검색어 |
| `limit` | 결과 수 (최대 200) |
| `country` | 국가 코드 (기본 US) |

---

## 9. Training API

**Base Path:** `/api/training`
**인증:** Bearer Token 필요

ML 학습 데이터 관리 API입니다.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/training/data` | 내 학습 데이터 조회 |
| GET | `/api/training/data/export` | CSV 내보내기 |
| POST | `/api/training/feedback` | 피드백 기록 (좋아요/싫어요) |
| GET | `/api/training/features` | 오디오 특성 데이터 |
| GET | `/api/training/dataset` | ML 학습셋 전체 |

---

## 10. AI/ML API

**Base Path:** FastAPI `:8000` → Nginx `/api/m1`, `/api/m2`, `/api/m3`, `/api/llm`

### M1 — 하이브리드 추천

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/m1/recommend` | 개인화 추천 |
| POST | `/api/m1/train` | 모델 학습 |
| GET | `/api/m1/status/{userId}` | 모델 상태 |

```json
POST /api/m1/recommend
Request:
{
  "user_id": 1,
  "limit": 20,
  "exclude_track_ids": [101, 102]
}

Response:
{
  "recommendations": [
    {
      "track_id": 201,
      "title": "Song Title",
      "artist": "Artist Name",
      "score": 0.95
    }
  ]
}
```

### M2 — 콘텐츠 기반 추천 (TF-IDF + GBR)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/m2/recommend` | 텍스트 기반 추천 |
| POST | `/api/m2/predict-audio` | 오디오 특성 예측 |
| GET | `/api/m2/similar/{trackId}` | 유사 트랙 |

### M3 — 협업 필터링 (CatBoost)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/m3/recommend` | 협업 필터링 추천 |
| POST | `/api/m3/train` | 모델 학습 |

### LLM — 자연어 추천 (ChromaDB + Gemini)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/llm/search` | 자연어 음악 검색 |
| POST | `/api/llm/recommend` | 자연어 기반 추천 |

```json
POST /api/llm/search
Request:
{
  "query": "비 오는 날 듣기 좋은 재즈",
  "limit": 10
}

Response:
{
  "tracks": [...],
  "explanation": "선택 이유..."
}
```

### 모델 초기화 (회원가입 후)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/init-models` | 신규 사용자 모델 초기화 |

```json
POST /api/init-models
Request:
{
  "user_id": 1
}
```

---

## 11. Audio Enrichment API

**Base Path:** `/api/enrich`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/enrich-all` | 전체 미보유 트랙 배치 처리 (백그라운드) |
| POST | `/api/enrich-tracks` | 특정 트랙 리스트 처리 |
| GET | `/api/enrich-status` | 진행 상태 및 커버리지 |

```json
POST /api/enrich-tracks
Request:
{
  "track_ids": [1001, 1002, 1003]
}

Response:
{
  "processed": 3,
  "failed": 0
}

GET /api/enrich-status
Response:
{
  "total_tracks": 14685,
  "enriched": 5420,
  "missing": 9265,
  "coverage_pct": 36.9
}
```

---

## 공통 응답 형식

### 성공

```json
{
  "success": true,
  "data": {...},
  "message": "string"
}
```

### 오류

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "오류 설명"
  }
}
```

### HTTP 상태 코드

| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 201 | 생성 성공 |
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 500 | 서버 오류 |
