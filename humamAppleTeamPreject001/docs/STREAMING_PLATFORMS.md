# MusicSpace — 스트리밍 플랫폼 연동 현황

---

## 플랫폼별 연동 요약

| 플랫폼 | 인증 방식 | 재생 지원 | 플레이리스트 가져오기 | 오디오 특성 | 상태 |
|--------|----------|----------|-------------------|-----------|------|
| Tidal | OAuth 2.0 (PKCE) | HLS 스트리밍 | ✅ | ❌ | ✅ 운영 중 |
| Spotify | OAuth 2.0 + Playwright | ❌ (미리듣기 없음) | ✅ | ✅ | ✅ 운영 중 |
| YouTube | API Key + OAuth | ✅ (영상) | ❌ | ❌ | ✅ 운영 중 |
| YouTube Music | API Key | ✅ (검색 후 재생) | ❌ | ❌ | ✅ 운영 중 |
| Apple Music | MusicKit JS | ✅ (MusicKit) | ❌ | ❌ | ✅ 운영 중 |
| iTunes | Search API | ✅ (30초 미리듣기) | ❌ | ❌ | ✅ 운영 중 |

---

## 음악 재생 우선순위

트랙 재생 시 다음 순서로 시도합니다:

```
1. Tidal HLS 스트리밍  (연결된 경우, 고품질)
   ↓ 실패 시
2. YouTube 영상 재생   (hls.js 또는 react-player)
   ↓ 실패 시
3. YouTube Music 검색 후 재생
   ↓ 실패 시
4. Apple Music (MusicKit)
   ↓ 실패 시
5. iTunes 30초 미리듣기
   ↓ 실패 시
6. 재생 불가 표시
```

---

## 1. Tidal

### 인증 방식: OAuth 2.0 (PKCE)

```
사용자 → /api/tidal/auth/url
          { authUrl, codeVerifier } 반환

사용자 → Tidal 로그인 페이지

Tidal → /tidal-callback?code=xxx

프론트 → /api/tidal/callback (code + codeVerifier 전송)

Spring Boot → Tidal 토큰 교환 → DB 저장 (tidal_tokens 테이블)
```

### 기능

| 기능 | 설명 |
|------|------|
| 플레이리스트 동기화 | 내 Tidal 플레이리스트 → PMS |
| HLS 스트리밍 | tidal-music/player SDK 활용, 품질 선택 가능 |
| 토큰 자동 갱신 | 만료 전 자동 refresh |

### 환경 변수

```env
TIDAL_CLIENT_ID=
TIDAL_CLIENT_SECRET=
TIDAL_REDIRECT_URI=https://imapplepie20.tplinkdns.com:8443/tidal-callback
```

### HLS 품질 옵션

| 옵션 | 설명 |
|------|------|
| LOW | 64kbps |
| HIGH | 320kbps |
| LOSSLESS | FLAC |
| HI_RES_LOSSLESS | MQA/Hi-Res FLAC |

---

## 2. Spotify

### 인증 방식: OAuth 2.0 + Playwright 병행

**OAuth 2.0** (Spring Boot):
- 플레이리스트 가져오기
- 오디오 특성(Audio Features) 조회
- 트랙 검색

**Playwright 브라우저 자동화** (Node.js):
- 로그인 세션 유지
- 검색 결과 스크래핑
- 토큰 관리

### 기능

| 기능 | 방식 | 설명 |
|------|------|------|
| 플레이리스트 가져오기 | OAuth API | Spotify 플레이리스트 → PMS |
| 오디오 특성 | OAuth API | 9개 특성값 조회 |
| 트랙 검색 | Playwright | 브라우저 기반 검색 |
| 추천 | OAuth API | Spotify Recommendations API |

### 환경 변수

```env
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

### 오디오 특성 조회

```http
GET /api/spotify/tracks/{spotifyTrackId}/audio-features

Response:
{
  "danceability": 0.735,
  "energy": 0.578,
  "valence": 0.624,
  "acousticness": 0.102,
  "instrumentalness": 0.0,
  "liveness": 0.159,
  "speechiness": 0.0461,
  "tempo": 98.002,
  "loudness": -11.84
}
```

---

## 3. YouTube

### 인증 방식: API Key (검색) + OAuth (채널/재생목록)

### 기능

| 기능 | 설명 |
|------|------|
| 트랙 검색 | YouTube Data API v3 검색 |
| 영상 재생 | react-player, iframe embed |
| 재생 폴백 | Tidal 없을 때 자동 YouTube 검색 재생 |

### 환경 변수

```env
YOUTUBE_KEY=AIza...
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
```

---

## 4. YouTube Music

### 인증 방식: API Key (비공식 API 포함)

YouTube Music은 공식 API가 없어 YouTube Data API와 비공식 방식을 병행합니다.

### 기능

| 기능 | 설명 |
|------|------|
| 음악 검색 | "type=music" 필터로 YouTube 검색 |
| 뮤직비디오 재생 | iframe 임베드 |

---

## 5. Apple Music

### 인증 방식: MusicKit JS (브라우저 내)

Apple Music은 서버 API 없이 클라이언트 측 MusicKit JS SDK를 사용합니다.

### 기능

| 기능 | 설명 |
|------|------|
| 카탈로그 검색 | MusicKit API |
| 스트리밍 재생 | MusicKit Player (Apple Music 구독 필요) |
| 미리듣기 | 30초 미리듣기 (구독 불필요) |

### Nginx 프록시

Apple Music API 요청은 CORS 우회를 위해 Nginx 프록시를 사용합니다:

```nginx
location /apple-proxy/ {
    proxy_pass https://amp-api-edge.music.apple.com/v1/;
    proxy_set_header Origin https://music.apple.com;
    proxy_set_header Referer https://music.apple.com/;
}
```

Vite dev에서는 `vite.config.ts`의 `/apple-proxy` 프록시 설정으로 처리합니다.

---

## 6. iTunes

### 인증 방식: 없음 (공개 Search API)

### 기능

| 기능 | 설명 |
|------|------|
| 트랙 검색 | iTunes Search API |
| 30초 미리듣기 | previewUrl 재생 |
| Apple Music ID 조회 | lookup API |

### API 예시

```http
GET /api/itunes/search?term=coldplay&limit=20

Response:
{
  "resultCount": 20,
  "results": [
    {
      "trackId": 12345,
      "trackName": "Yellow",
      "artistName": "Coldplay",
      "previewUrl": "https://audio-ssl.itunes.apple.com/...",
      "artworkUrl100": "https://..."
    }
  ]
}
```

---

## MusicConnections — 플랫폼 연결 UI

`src/pages/music/MusicConnections.tsx`에서 플랫폼 연결 상태 확인 및 관리:

- 각 플랫폼 연결/해제 버튼
- 연결 상태 배지 (연결됨/미연결)
- OAuth 로그인 팝업 처리
- 연결된 계정 정보 표시

### 연결 상태 확인 API

```http
GET /api/auth/me
Response:
{
  "tidal_connected": true,
  "spotify_connected": false,
  "youtube_connected": true,
  ...
}
```

---

## 플랫폼별 트랙 데이터 구조

```typescript
interface Track {
  track_id: number;
  title: string;
  artist: string;
  album?: string;
  duration?: number;         // 초
  platform: 'tidal' | 'spotify' | 'youtube' | 'itunes' | 'apple_music';
  platform_track_id: string; // 각 플랫폼의 고유 ID
  thumbnail?: string;
  preview_url?: string;      // iTunes 미리듣기
  stream_url?: string;       // Tidal HLS URL
  youtube_id?: string;       // YouTube 영상 ID

  // 오디오 특성 (있는 경우)
  danceability?: number;
  energy?: number;
  valence?: number;
  tempo?: number;
  // ...
}
```
