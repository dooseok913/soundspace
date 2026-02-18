# 작업 기록 (2026-02-13)

## 1. Footer 컴포넌트 추가
- `src/components/layout/Footer.tsx` 생성
- `MusicHomeLayout.tsx`, `MusicLayout.tsx`에 Footer 적용
- MusicSpace 로고 + 저작권 표시

## 2. 전역 테마 관리 (Global Theme)
MASTER(관리자)가 설정한 테마가 모든 사용자에게 동일 적용되도록 수정.

### Backend (Spring Boot)
- `SystemSettings.java` 엔티티 생성 (system_settings 테이블)
- `SystemSettingsRepository.java` 생성
- `SystemSettingsController.java` 생성
  - `GET /api/settings/theme` — 현재 테마 조회 (공개, 인증 불필요)
  - `PUT /api/settings/theme` — 테마 변경 (MASTER 전용)
- `SecurityConfig.java` — GET /api/settings/theme permitAll 추가

### Frontend (React)
- `src/services/api/index.ts` — PUT 메서드 추가
- `src/services/api/settings.ts` 생성 (getTheme, setTheme API)
- `src/contexts/ThemeContext.tsx` 수정
  - mount 시 API에서 글로벌 테마 fetch
  - setTheme에서 API PUT 동시 호출
  - toggleTheme 버그 수정 (setTheme 위임)

### DB
- `system_settings` 테이블 생성 (setting_key, setting_value, updated_at)

## 3. 연동 시 중복 Import 방지 (user_dismissed_playlists)
사용자가 삭제한 외부 재생목록이 재연동 시 다시 import되는 문제 해결.

### 설계
- playlists 테이블에 is_hidden 플래그 방식 → 다중 사용자 환경 문제로 폐기
- 별도 `user_dismissed_playlists` 테이블로 사용자별 개인화

### Backend (Spring Boot)
- `UserDismissedPlaylist.java` 엔티티 생성
- `UserDismissedPlaylistRepository.java` 생성
- `PlaylistServiceImpl.deletePlaylist()` — hard delete 유지 + externalId 있으면 dismissed 테이블에 기록
- `PlaylistController.deletePlaylist()` — @AuthenticationPrincipal에서 userId 전달
- `YoutubeServiceImpl.importPlaylist()` — dismissed 체크 추가
- `TidalServiceImpl.importPlaylist()` — dismissed 체크 추가 (2곳)
- `SpotifyServiceImpl.importPlaylist()` — 중복 체크 + dismissed 체크 추가

### DB
- `user_dismissed_playlists` 테이블 생성
  - user_id, external_id (UNIQUE 복합키), dismissed_at
  - FK: users(user_id) ON DELETE CASCADE
