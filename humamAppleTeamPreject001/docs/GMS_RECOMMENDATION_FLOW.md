# GMS "새 추천 생성" 프로세스 분석

## 전체 흐름도

```
[프론트엔드]                    [FastAPI]                      [DB]
사용자 클릭                      POST /api/recommend
"새 추천 생성"                         │
     │                                │
     ▼                                ▼
GatewayMusicSpace.tsx         main.py: unified_recommend()
handleGenerateRecommendations()       │
     │                                ├─ M1 → M1Service.get_recommendations()
     │                                ├─ M2 → M2Service.get_recommendations()
     │                                └─ M3 → M3Service.get_recommendations()
     │                                         │
     │                                         ▼
     │                                  save_gms_playlist()
     │                                  (GMS 플레이리스트 생성 + 트랙 매핑)
     │                                         │
     │                                         ▼
     │                                   playlists 테이블 INSERT
     │                                   (space_type='GMS', source_type='System')
     │                                   playlist_tracks 테이블 INSERT
     │                                         │
     ▼                                         │
fetchPlaylists() ◄──────────────── 결과 반환 (playlist_id, count, recommendations)
(GMS 플레이리스트 목록 갱신)
```

---

## Step 1. 프론트엔드 — 버튼 클릭

**파일**: `src/pages/music/GatewayMusicSpace.tsx` (106-159행)

```typescript
handleGenerateRecommendations()
```

- `selectedModel` (M1/M2/M3) — localStorage에서 로드 (Settings 페이지에서 변경)
- `emsTrackLimit` — localStorage에서 로드 (기본값 300)
- 프로그레스바 애니메이션 (15% → 30% → 50% → 70% → 85%)은 **UI 연출용** (실제 진행률 아님)
- 호출: `fastapiService.getRecommendations(userId, selectedModel, 20, emsTrackLimit)`

---

## Step 2. API 호출

**파일**: `src/services/api/fastapi.ts` (295-320행)

```
POST /api/recommend
Body: { user_id, model, top_k: 20, ems_track_limit }
```

- Nginx 프록시를 통해 FastAPI 서버(8000번 포트)로 전달

---

## Step 3. FastAPI — 통합 추천 라우터

**파일**: `FAST_API/main.py` (425-593행) `unified_recommend()`

모델에 따라 분기:

### M1 (Audio Feature Prediction)

1. `M1RecommendationService` 로드 (`M1/audio_predictor.pkl`)
2. `service.get_recommendations(db, user_id, ems_limit)` 호출
   - 사용자 PMS 트랙에서 **취향 프로필** 생성 (audio features 평균)
   - EMS의 **후보 트랙** 랜덤 추출 (ems_track_limit개)
   - Ridge 모델로 각 후보 트랙의 **적합도 점수** 예측
   - 점수 상위 top_k개 반환
3. `service.save_gms_playlist(db, user_id, results)` → DB에 GMS 플레이리스트 저장

### M2 (SVM + Text Embedding)

1. EMS 트랙을 DB에서 직접 조회 (`space_type = 'EMS'`, `ORDER BY RAND()`, `LIMIT`)
2. `m2_service.get_recommendations(user_id, candidate_tracks, top_k, threshold=0.5)`
   - 사용자별 SVM 모델 로드 (`M2/user_svm_models/`)
   - TF-IDF 텍스트 임베딩 (제목+아티스트+앨범)으로 393차원 벡터 생성
   - SVM이 각 후보 트랙의 **좋아요 확률** 예측
   - threshold(0.5) 이상인 트랙만 필터링
3. `save_recommendations_to_gms(db, user_id, recommendations, "M2")` → DB 저장

### M3 (CatBoost Collaborative Filtering)

1. `m3_service.get_recommendations(db, user_id, top_k)`
   - CatBoost 모델로 추천 (사용자별 모델 또는 기본 모델)
2. `save_recommendations_to_gms(db, user_id, recommendations, "M3")` → DB 저장

---

## Step 4. GMS 플레이리스트 DB 저장

**파일**: `FAST_API/main.py` (357-414행) `save_recommendations_to_gms()`

```sql
-- 1. 플레이리스트 생성
INSERT INTO playlists (user_id, title, description, space_type, status_flag, source_type, ai_score)
VALUES (:user_id, 'AI 추천 (M1) - 2026-02-13 15:30', '...', 'GMS', 'PTP', 'System', :avg_score)

-- 2. 추천 트랙 매핑
INSERT INTO playlist_tracks (playlist_id, track_id, order_index)
VALUES (:playlist_id, :track_id, :idx)
```

| 필드 | 값 | 설명 |
|------|-----|------|
| `space_type` | `GMS` | Gateway Music Space |
| `status_flag` | `PTP` | 임시 상태 (사용자 승인 대기) |
| `source_type` | `System` | AI 시스템 생성 |
| `ai_score` | 평균점수 × 100 | 추천 트랙들의 평균 점수 (0-100) |

---

## Step 5. 프론트엔드 — 결과 표시

```
fetchPlaylists() → GET /api/playlists?spaceType=GMS
```

GMS 플레이리스트 목록 갱신 후, 사용자가 할 수 있는 후속 액션:

| 액션 | 동작 | AI 학습 |
|------|------|---------|
| **승인** | 플레이리스트를 PMS로 이동 | 삭제한 트랙만 부정 피드백 |
| **거절** | 플레이리스트 삭제 | 전체 트랙을 부정 피드백으로 재학습 |
| **트랙 삭제** | 개별 트랙 제거 | 해당 트랙을 부정 피드백으로 학습 |

---

## 데이터 흐름 핵심

```
EMS (외부 플랫폼에서 가져온 곡들)
    ↓ 후보 트랙 풀 (ems_track_limit개, 기본 300)
AI 모델 (M1/M2/M3)
    ↓ 점수 기반 필터링 (top_k개, 기본 20)
GMS (AI 추천 대기 공간)
    ↓ 사용자 승인/거절
PMS (개인 공간) ← 승인된 플레이리스트
    ↓ 삭제된 트랙은 부정 피드백으로 재학습
```

---

## 관련 파일 목록

### 프론트엔드
| 파일 | 역할 |
|------|------|
| `src/pages/music/GatewayMusicSpace.tsx` | GMS 페이지 UI + 이벤트 핸들러 |
| `src/services/api/fastapi.ts` | FastAPI 호출 (getRecommendations, deleteTrackAndRetrain 등) |
| `src/services/api/playlists.ts` | 플레이리스트 CRUD API |
| `src/pages/music/MusicSettings.tsx` | AI 모델 선택 + EMS 곡 수 설정 |

### FastAPI
| 파일 | 역할 |
|------|------|
| `FAST_API/main.py` | 통합 추천 라우터 (`/api/recommend`) + GMS 저장 |
| `FAST_API/M1/service.py` | M1 추천 서비스 (Ridge 모델) |
| `FAST_API/M2/service.py` | M2 추천 서비스 (SVM + TF-IDF) |
| `FAST_API/M3/service.py` | M3 추천 서비스 (CatBoost) |
| `FAST_API/database.py` | DB 연결 (SQLAlchemy) |

### DB 테이블
| 테이블 | 역할 |
|--------|------|
| `playlists` | GMS 플레이리스트 저장 (space_type='GMS') |
| `playlist_tracks` | 추천 트랙 매핑 |
| `tracks` | 트랙 메타데이터 + audio features |
| `user_preferences` | 사용자별 AI 모델 설정 |
