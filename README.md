# SoundSpace

AI 기반 3단계 음악 검증 시스템 (EMS → GMS → PMS)

## 프로젝트 개요

**SoundSpace**는 딥러닝과 대규모 언어 모델(LLM)을 결합한 구조화된 검증 프로세스를 통해 사용자 취향에 맞는 음악을 자동으로 분석하고 큐레이션하는 **지능형 음악 추천 플랫폼**입니다.

### 핵심 특징

- **3단계 아키텍처**: EMS(외부 음악) → GMS(AI 필터링) → PMS(개인 라이브러리)
- **오디오 특성 역추정**: Spotify API 제약 → GBRegressor로 과거 데이터 기반 역추정
- **SVM 선호도 모델링**: 개인 vs 일반 플레이리스트 이진 분류로 취향 학습
- **RAG 기반 설명 생성**: Gemini 2.5 + ChromaDB로 개인화된 추천 이유 제공
- **MLOps 인프라**: MLflow 실험 추적 + LangSmith LLM 모니터링

## 성능

| 모델/기능 | 지표 | 결과 |
|-----------|------|------|
| 오디오 역추정 (GBRegressor) | R² | 0.85+ |
| 앙상블 추천 | NDCG@50 | 0.571 (50배 향상) |
| LLM 응답 | Latency | ~500ms |

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
| **최두석** | **GBRegressor 오디오 역추적, SVM 선호도 모델링, LLM 구현** |
| 김기열 | KNN 앙상블 설계, RAG 파이프라인 |

## 담당 역할 상세 (최두석)

### 1. GBRegressor 오디오 역추적
- Spotify API 제약으로 누락된 오디오 특성을 과거 데이터(11만 건) 기반으로 역추정
- ISRC를 활용한 외부 데이터 매핑으로 특징량 확장

### 2. SVM 선호도 모델링
- 개인 플레이리스트 vs 일반 플레이리스트 이진 분류
- 사용자 취향 DNA 학습

### 3. LLM 구현
- Gemini 2.5 Flash 기반 RAG 파이프라인
- 추천 설명 생성 및 한국어 쿼리 처리

### 4. MLOps 인프라
- MLflow: 모델 실험 추적 및 하이퍼파라미터 최적화
- LangSmith: LLM 호출 트레이싱 및 모니터링

## 문제 해결 경험

### 1. Docker 포트 충돌 해결
- 기존 MariaDB(3307)와 Docker 컨테이너 포트 충돌
- 해결: `3308:3306` 포트 포워딩으로 독립 환경 구축

### 2. MariaDB + Redis 하이브리드 전략
- MariaDB: 영속성 데이터 (사용자 정보)
- Redis: 휘발성 캐시 (JWT 토큰, 세션)

### 3. Spotify API 제약 대응
- 오디오 특성 API 중단 → GBRegressor 역추적 모델 설계
- 캐글 과거 데이터(11만 건)로 역추정 모델 학습 (R² 0.85+)

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
