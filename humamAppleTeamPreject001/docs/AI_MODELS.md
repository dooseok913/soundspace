# MusicSpace — AI/ML 모델 가이드

---

## 개요

MusicSpace의 AI 추천 시스템은 4개의 독립적 모듈로 구성됩니다.

| 모듈 | 알고리즘 | 파일 크기 | 특징 |
|------|---------|---------|------|
| M1 | 오디오 벡터 + 하이브리드 | audio_predictor.pkl (297KB) | 오디오 특성 기반 개인화 |
| M2 | TF-IDF + GBR | tfidf_gbr_models.pkl (7.1MB) | 텍스트 기반 콘텐츠 필터링 |
| M3 | CatBoost | recommender_U2...cbm (1MB) | 사용자 행동 협업 필터링 |
| LLM | ChromaDB + Gemini | - | 자연어 의미 기반 검색 |

---

## M1 — 오디오 특성 기반 하이브리드 추천

### 개념

Spotify 오디오 특성(Audio Features) 벡터를 활용하여 사용자 취향 프로파일을 만들고,
개인화된 하이브리드 추천을 제공합니다.

### 오디오 특성 (9개)

| 특성 | 범위 | 설명 |
|------|------|------|
| danceability | 0.0~1.0 | 댄서블한 정도 |
| energy | 0.0~1.0 | 에너지 수준 |
| valence | 0.0~1.0 | 긍정적/행복한 정도 |
| acousticness | 0.0~1.0 | 어쿠스틱 정도 |
| instrumentalness | 0.0~1.0 | 보컬 없는 정도 |
| liveness | 0.0~1.0 | 라이브 녹음 정도 |
| speechiness | 0.0~1.0 | 음성 콘텐츠 정도 |
| tempo | BPM | 박자 |
| loudness | dB | 음량 |

### 모델 파일

```
M1/
├── audio_predictor.pkl     전역 오디오 특성 예측 모델 (297KB)
└── user_models/            사용자별 개인화 모델
    ├── {userId}/
    │   ├── model.pkl
    │   └── metadata.json
    └── ...
```

### API

```
POST /api/m1/recommend
POST /api/m1/train
GET  /api/m1/status/{userId}
```

### 학습 조건

- 사용자 PMS 트랙 수 ≥ 10개 (오디오 특성 있는 트랙)
- 오디오 특성이 부족한 경우 → `audio_enrichment`가 자동으로 채움
- Profile Fallback: 특성 데이터 부족 시 글로벌 평균 프로파일 사용

---

## M2 — 콘텐츠 기반 추천 (TF-IDF + GBR)

### 개념

아티스트명과 곡명의 텍스트 정보를 TF-IDF로 벡터화하고,
Gradient Boosting Regressor(GBR)로 오디오 특성을 예측합니다.

### 두 가지 역할

1. **오디오 특성 예측**: 아티스트/곡명만 있고 오디오 특성이 없는 트랙에 특성값 예측
2. **콘텐츠 기반 추천**: 텍스트 유사도 기반 유사 트랙 추천

### 모델 파일

```
M2/
├── tfidf_gbr_models.pkl    TF-IDF + GBR 통합 모델 (7.1MB)
└── user_svm_models/        사용자별 SVM 모델
```

### API

```
POST /api/m2/recommend
POST /api/m2/predict-audio
GET  /api/m2/similar/{trackId}
```

### 오디오 특성 예측 흐름

```
트랙 (아티스트명 + 곡명)
    │
    ▼
TF-IDF 텍스트 벡터화
    │
    ▼
GBR 모델 → 9개 오디오 특성 예측
    │
    ▼
DB 저장 (tracks 테이블 개별 컬럼 + external_metadata JSON)
```

---

## M3 — 협업 필터링 (CatBoost)

### 개념

사용자-트랙 상호작용 데이터(재생, 좋아요, 스킵)를 바탕으로
CatBoost 모델이 유사한 취향의 사용자 그룹을 찾아 추천합니다.

### 모델 파일

```
M3/
├── recommender_U2_MyInitialT_20260201.cbm   글로벌 CatBoost 모델 (1MB)
└── user_models/                              사용자별 파인튜닝 모델
    └── {userId}_.cbm
```

### API

```
POST /api/m3/recommend
POST /api/m3/train
```

### 입력 특성

| 특성 | 설명 |
|------|------|
| user_id | 사용자 식별자 |
| track_id | 트랙 식별자 |
| play_count | 재생 횟수 |
| like_score | 좋아요(-1/0/1) |
| genre | 장르 |
| audio_features | M1/M2에서 채워진 오디오 벡터 |

---

## LLM — 자연어 추천 (ChromaDB + Gemini)

### 개념

Google Gemini로 자연어 쿼리를 임베딩으로 변환하고,
ChromaDB 벡터 데이터베이스에서 의미적으로 유사한 트랙을 검색합니다.

### 모듈 위치

```
LLM/
├── chroma_db/    ChromaDB 벡터 저장소
├── embeddings.py
└── llm_service.py
```

### API

```
POST /api/llm/search     자연어 검색
POST /api/llm/recommend  자연어 기반 추천
```

### 예시

```
쿼리: "새벽 드라이브에 어울리는 신스팝"
 ↓
Gemini Embedding → ChromaDB 유사도 검색
 ↓
트랙 목록 + 선택 이유 반환
```

### 필요 환경변수

```env
GOOGLE_API_KEY=AIza...
```

---

## Audio Enrichment — 오디오 특성 자동 채움

### 문제 배경

- tracks 테이블 전체 14,685개 트랙 중 소수만 오디오 특성 보유
- 회원가입 후 Tidal/Spotify 플레이리스트 가져올 때 대부분 특성 없음
- M1 모델이 특성 데이터 10개 미만이면 Profile Fallback → 개인화 품질 저하

### 해결책

M2의 TF-IDF+GBR 모델로 아티스트명/곡명에서 오디오 특성을 예측하여 자동 저장합니다.

### 실행 흐름

```
회원가입 → 플레이리스트 임포트 → /api/init-models
    │
    ▼
enrich_user_tracks(user_id)     ← audio_enrichment.py
    │  PMS 트랙 중 특성 없는 것들을 M2로 예측하여 DB 저장
    ▼
train_m1_model(user_id)         ← M1 학습 시작
    │  이제 오디오 특성 데이터 존재 → 정상 학습
    ▼
개인화 모델 완성
```

### DB 업데이트 쿼리

```sql
UPDATE tracks SET
  danceability = ?,
  energy = ?,
  valence = ?,
  acousticness = ?,
  instrumentalness = ?,
  liveness = ?,
  speechiness = ?,
  tempo = ?,
  loudness = ?,
  external_metadata = JSON_MERGE_PATCH(
    COALESCE(external_metadata, '{}'),
    '{"audio_features": {...}}'
  )
WHERE track_id = ?
```

### 관리자 일괄 처리

```bash
# 전체 DB 트랙 일괄 처리 (백그라운드)
curl -X POST https://imapplepie20.tplinkdns.com:8443/api/enrich-all

# 진행 상태 확인
curl https://imapplepie20.tplinkdns.com:8443/api/enrich-status
```

---

## 모델 운영

### 신규 사용자 모델 초기화

```bash
curl -X POST https://imapplepie20.tplinkdns.com:8443/api/init-models \
  -H "Content-Type: application/json" \
  -d '{"user_id": 123}'
```

### 모델 파일 경로

| 모델 | 경로 (컨테이너 내) |
|------|-----------------|
| M1 global | `/app/M1/audio_predictor.pkl` |
| M1 user | `/app/M1/user_models/{userId}/` |
| M2 | `/app/M2/tfidf_gbr_models.pkl` |
| M3 global | `/app/M3/recommender_U2_MyInitialT_20260201.cbm` |
| M3 user | `/app/M3/user_models/{userId}_.cbm` |

### 모델 용량 모니터링

```bash
docker exec musicspace-fastapi du -sh /app/M1/user_models /app/M2/user_svm_models /app/M3/user_models
```

### 오래된 사용자 모델 정리

```bash
# 90일 이상 미사용 모델 삭제
docker exec musicspace-fastapi find /app/M1/user_models -mtime +90 -type d -exec rm -rf {} +
```
