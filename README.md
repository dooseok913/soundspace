# SoundSpace

AI 기반 3단계 음악 검증 시스템 (EMS → GMS → PMS)

## 프로젝트 개요

**SoundSpace**는 머신러닝·딥러닝과 대규모 언어 모델(LLM)을 결합한 구조화된 검증 프로세스를 통해 사용자 취향에 맞는 음악을 자동으로 분석·추천하고, 추천 이유를 설명하는 **지능형 음악 추천 플랫폼**입니다.

### 핵심 특징

- **3단계 아키텍처**: EMS(외부 음악) → GMS(AI 필터링) → PMS(개인 라이브러리)
- **오디오 특성 역추정**: Spotify API 제약 → GBRegressor로 과거 데이터 기반 역추정
- **SVM 선호도 모델링**: 개인 vs 일반 플레이리스트 이진 분류로 취향 학습
- **RAG 기반 설명 생성**: Gemini 2.5 + ChromaDB로 개인화된 추천 이유 제공
- **MLOps 인프라**: MLflow 실험 추적 + LangSmith LLM 모니터링

## 성능

| 모델/기능 | 성능 지표 |
|-----------|-----------|
| GBRegressor 오디오 역추정 | R² ~0.50 (9개 특성) |
| SVM 선호도 분류 | AUC 0.82 |
| LLM 응답 (Gemini 2.5) | Latency ~500ms |

## 기술 스택

### Frontend
- React, Next.js, TypeScript

### Backend
- Spring Boot 3.5.9 (Java/JDK17)
- FastAPI (Python 3.10.6)
- MariaDB, Redis

### AI/ML
- **LLM**: Gemini 2.5 Flash
- **Vector DB**: ChromaDB, FAISS
- **Embeddings**: Sentence-Transformers (all-MiniLM-L6-v2)
- **ML Models**: CatBoost, SVM, KNN, Ridge Regression, Gradient Boosting
- **MLOps**: MLflow, LangSmith

### Infrastructure
- Docker, Jenkins (CI/CD)

## 프로젝트 구조

```
soundspace/
├── 2TeamFinalProject-BE/     # Spring Boot 백엔드
├── FAST_API/                  # FastAPI AI 서버
│   ├── data/                  # 음악 데이터셋
│   └── ...
└── music_space_backup.sql     # DB 백업
```

## 팀 구성

| 팀원 | 역할 |
|------|------|
| 이성훈 (PM) | RESTful API 통합, CI/CD 자동화, 인증 시스템 |
| 정혜원 (PL) | Ridge Regression 모델링, DB 스키마, 오디오 특성 예측 |
| 조우성 | 프론트엔드 구현, 스트리밍 연동 |
| **최두석** | **GBRegressor 오디오 역추적, SVM 선호도 모델링, RAG + ChromaDB 기반 LLM 구현** |
| 김기열 | KNN 앙상블 설계, 20개 모델 비교 분석 |

## 담당 역할 상세 (최두석)

### 1. GBRegressor 오디오 역추적
- Spotify API 제약으로 누락된 오디오 특성을 과거 데이터(11만 건) 기반으로 역추정
- 9개 오디오 특성(danceability, energy, valence 등) 복원

### 2. SVM 선호도 모델링
- 개인 플레이리스트 vs 일반 플레이리스트 이진 분류
- 사용자 취향 DNA 학습

### 3. RAG 기반 LLM 구현
- Gemini 2.5 Flash + ChromaDB 벡터 검색
- 추천 설명 생성 및 한국어 쿼리 처리

### 4. MLOps 인프라
- MLflow: 모델 실험 추적 및 하이퍼파라미터 최적화
- LangSmith: LLM 호출 트레이싱 및 모니터링

## 문제 해결 경험

### 1. 인프라 환경 구축: 포트 충돌 해결 및 가상화 이해

**문제 상황**
- Docker를 이용해 DB 인프라 구축 중, 기존 MariaDB(3307)와 Docker 컨테이너 포트 충돌
- `Port not available` 에러 발생

**해결 및 깨달음**
- **포트 바인딩 최적화**: Docker 포트 포워딩을 `3308:3306`으로 변경하여 독립된 가상 DB 환경 구축
- **Server vs Client 구조 이해**: DB 서버는 포트를 '점유'하는 주체, DBeaver/Spring Boot는 '클라이언트'라는 구분 명확화
- **인프라 설계 능력**: 하나의 포트에는 하나의 서비스만 바인딩 가능하다는 원칙 체득

### 2. 데이터 저장 전략: MariaDB와 Redis 하이브리드 활용

**문제 상황**
- 관계형 DB(MariaDB)만으로 잦은 토큰 검증/세션 관리 시 I/O 부하 발생
- Redis 인메모리 캐시 데이터베이스의 필요성 검토

**해결 및 깨달음**
- **MariaDB**: ID, 비밀번호 등 영속성과 안정성이 중요한 데이터 저장
- **Redis**: JWT 토큰, 캐시 데이터 등 빠른 응답이 필요한 휘발성 데이터 저장
- **기술적 시야 확장**: 데이터 성격(생명 주기, 접근 빈도)에 따른 적절한 저장 매체 선택이 아키텍처 핵심

### 3. Spotify API 제약 대응 및 역추적 모델 설계

**문제 상황**
- Spotify API 정책 변경으로 오디오 특성(audio features) 메타데이터 제공 중단
- 가수명, 곡명 등 제한적 메타데이터만 수집 가능
- 오디오 특성 없이 ML 모델 학습 자체의 의미에 대한 논의 필요

**해결 및 깨달음**
- **역추적 모델 설계**: 캐글에서 확보한 11만 건의 과거 오디오 데이터로 GBRegressor 역추정 모델 학습 (9개 특성, R² ~0.50)
- **오디오 특성 복원**: 현재 플레이리스트에도 오디오 특성을 보완적으로 부여
- **이진 분류 모델**: 개인 플레이리스트 vs 일반 플레이리스트를 분류하여 개인 취향 학습
- **핵심 통찰**: API 제약을 한계로 받아들이지 않고, 과거 데이터 기반 역추적으로 문제 해결

## 실행 방법

```bash
# 백엔드 실행
cd 2TeamFinalProject-BE
./gradlew bootRun

# FastAPI 실행
cd FAST_API
uvicorn main:app --reload
```

## 시연 영상

[![SoundSpace Demo](https://img.youtube.com/vi/ruBitRz-Oo0/0.jpg)](https://www.youtube.com/watch?v=ruBitRz-Oo0)

## 라이선스

This project is for educational purposes.

---

**Contact**: cds1745@naver.com | [GitHub](https://github.com/dooseok913)
