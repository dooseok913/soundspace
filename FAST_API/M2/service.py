"""
M2 Service - SVM + Text Embedding 기반 추천 서비스
m2.py의 핵심 로직을 서비스 클래스로 정리

주요 기능:
- 393D 피처 (384D 텍스트 임베딩 + 9D 오디오)
- SVM 기반 사용자 취향 예측
- Last.fm 태그 활용
"""
import os
import logging
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from typing import Dict, List, Optional, Any

# sentence_transformers는 optional (없으면 TF-IDF fallback)
try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False
    SentenceTransformer = None

from sklearn.svm import SVC
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent

# 오디오 피처 목록
AUDIO_FEATURES = [
    'danceability', 'energy', 'speechiness', 'acousticness',
    'instrumentalness', 'liveness', 'valence', 'tempo', 'loudness'
]


class AudioPredictionService:
    """오디오 피처 예측 서비스 (간소화 버전 - 규칙 기반)"""
    
    def __init__(self, model_path: Optional[str] = None):
        if model_path is None:
            model_path = str(BASE_DIR / 'tfidf_gbr_models.pkl')
        
        self.model_path = Path(model_path) if model_path else None
        self.models = None
        self.vectorizers = None
        self._loaded = False
    
    def load_model(self) -> bool:
        """모델 로드 시도 (실패 시 규칙 기반 사용)"""
        if self._loaded:
            return True
        
        if self.model_path and self.model_path.exists():
            try:
                logger.info(f"오디오 예측 모델 로드: {self.model_path}")
                data = joblib.load(self.model_path)
                self.models = data.get('models', {})
                self.vectorizers = data.get('vectorizers', {})
                self._loaded = True
                logger.info(f"오디오 모델 로드 완료: {list(self.models.keys())}")
                return True
            except Exception as e:
                logger.warning(f"오디오 모델 로드 실패, 규칙 기반 사용: {e}")
        
        # 모델 없으면 규칙 기반 사용
        self._loaded = True
        logger.info("오디오 피처: 규칙 기반 예측 사용")
        return True
    
    def predict_single(
        self,
        artist: str,
        track_name: str,
        album_name: str = "",
        tags: str = "",
        duration_ms: int = 200000
    ) -> Dict[str, float]:
        """단일 트랙 오디오 피처 예측 (ML 모델 우선, 실패 시 규칙 기반)"""
        self.load_model()

        # ML 모델이 로드되었으면 실제 예측 사용
        if self.models and self.vectorizers:
            try:
                from scipy.sparse import hstack, csr_matrix

                artist_vec = self.vectorizers['artist'].transform([artist])
                track_vec = self.vectorizers['track'].transform([track_name])
                tags_vec = self.vectorizers['tags'].transform([tags])

                numeric = np.array([[duration_ms, 50]])  # [duration_ms, popularity]
                num_scaler = self.vectorizers.get('num_scaler')
                if num_scaler is not None:
                    numeric = num_scaler.transform(numeric)
                numeric_sparse = csr_matrix(numeric)

                X = hstack([artist_vec, track_vec, tags_vec, numeric_sparse])

                predictions = {}
                for feature in AUDIO_FEATURES:
                    if feature in self.models:
                        pred = self.models[feature].predict(X)[0]
                        predictions[feature] = float(pred)
                    else:
                        predictions[feature] = 0.0

                return predictions
            except Exception as e:
                logger.warning(f"ML 예측 실패, 규칙 기반 사용: {e}")

        # 규칙 기반 fallback
        text = f"{artist} {track_name} {album_name} {tags}".lower()

        predictions = {
            'danceability': 0.5,
            'energy': 0.5,
            'speechiness': 0.1,
            'acousticness': 0.3,
            'instrumentalness': 0.1,
            'liveness': 0.2,
            'valence': 0.5,
            'tempo': 120.0,
            'loudness': -6.0
        }

        if any(kw in text for kw in ['edm', 'electronic', 'dance', 'club']):
            predictions['danceability'] = 0.8
            predictions['energy'] = 0.85
            predictions['acousticness'] = 0.1
        elif any(kw in text for kw in ['ballad', 'slow', 'acoustic', 'folk']):
            predictions['danceability'] = 0.3
            predictions['energy'] = 0.3
            predictions['acousticness'] = 0.8
        elif any(kw in text for kw in ['rock', 'metal', 'punk']):
            predictions['energy'] = 0.9
            predictions['loudness'] = -4.0
        elif any(kw in text for kw in ['hip hop', 'rap', 'hiphop']):
            predictions['speechiness'] = 0.3
            predictions['danceability'] = 0.7
        elif any(kw in text for kw in ['classical', 'orchestra', 'piano']):
            predictions['instrumentalness'] = 0.8
            predictions['acousticness'] = 0.9
            predictions['energy'] = 0.3
        elif any(kw in text for kw in ['jazz', 'blues']):
            predictions['acousticness'] = 0.6
            predictions['instrumentalness'] = 0.4

        if duration_ms < 180000:
            predictions['energy'] = min(predictions['energy'] + 0.1, 1.0)
        elif duration_ms > 360000:
            predictions['instrumentalness'] = min(predictions['instrumentalness'] + 0.2, 1.0)

        return predictions


class EmbeddingService:
    """텍스트 임베딩 서비스 (Sentence-Transformers 384D - 원래 M2 설계)"""

    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = None
        self.embedding_dim = 384  # SentenceTransformer all-MiniLM-L6-v2 = 384D
        self._loaded = False

    def load_model(self) -> bool:
        """SentenceTransformer 모델 로드 (원래 M2 설계: 384D)"""
        if self._loaded and self.model is not None:
            return True

        if not HAS_SENTENCE_TRANSFORMERS:
            logger.error("sentence-transformers 미설치! pip install sentence-transformers 필요")
            return False

        try:
            logger.info(f"SentenceTransformer 로드: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            self._loaded = True
            logger.info(f"SentenceTransformer 로드 완료 (384D)")
            return True
        except Exception as e:
            logger.error(f"SentenceTransformer 로드 실패: {e}")
            return False

    def encode_track(self, artist: str, track_name: str, album_name: str = "", tags: str = "") -> np.ndarray:
        """단일 트랙 임베딩 (384D)"""
        if not self.load_model():
            return np.zeros(self.embedding_dim)

        text = f"{artist} {track_name}"
        if album_name:
            text += f" {album_name}"
        if tags:
            text += f" {tags.replace('|', ' ')}"

        return self.model.encode([text])[0]

    def encode_tracks(self, tracks: List[Dict]) -> np.ndarray:
        """여러 트랙 임베딩 (N x 384D)"""
        if not self.load_model():
            return np.zeros((len(tracks), self.embedding_dim))

        texts = []
        for t in tracks:
            text = f"{t.get('artist', '')} {t.get('track_name', '')}"
            if t.get('album_name'):
                text += f" {t.get('album_name')}"
            if t.get('tags'):
                text += f" {t.get('tags', '').replace('|', ' ')}"
            texts.append(text)

        return self.model.encode(texts, show_progress_bar=False)


class M2RecommendationService:
    """M2 SVM 기반 추천 서비스 (원래 설계: 393D = 384D 임베딩 + 9D 오디오)"""

    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.audio_service = AudioPredictionService()
        self.user_models: Dict[int, Any] = {}  # user_id -> SVM model
        self.models_dir = BASE_DIR / 'user_models'
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self._feature_dim = 393  # 384D 임베딩 + 9D 오디오

    def _create_features(
        self,
        artist: str,
        track_name: str,
        album_name: str = "",
        tags: str = "",
        audio_features: Optional[Dict[str, float]] = None,
        duration_ms: int = 200000
    ) -> np.ndarray:
        """393D 피처 벡터 생성 (384D 텍스트 임베딩 + 9D 오디오) - 원래 M2 설계"""
        # 1. 텍스트 임베딩 (384D - SentenceTransformer)
        embedding = self.embedding_service.encode_track(artist, track_name, album_name, tags)

        # 2. 오디오 피처 (9D)
        if audio_features is None:
            audio_features = self.audio_service.predict_single(
                artist=artist,
                track_name=track_name,
                album_name=album_name,
                tags=tags,
                duration_ms=duration_ms
            )

        audio_vector = np.array([
            audio_features.get(f, 0.5) for f in AUDIO_FEATURES
        ])

        # 3. 결합 (393D = 384 + 9)
        features = np.concatenate([embedding, audio_vector])

        return features
    
    def predict_single(
        self,
        user_id: int,
        artist: str,
        track_name: str,
        album_name: str = "",
        tags: str = "",
        duration_ms: int = 200000
    ) -> Dict:
        """단일 트랙 SVM 예측 (393D 피처)"""
        # 사용자 모델 로드
        model = self._load_user_model(user_id)

        # 393D 피처 생성
        features = self._create_features(
            artist=artist,
            track_name=track_name,
            album_name=album_name,
            tags=tags,
            duration_ms=duration_ms
        )

        X = features.reshape(1, -1)

        if model is None:
            # 모델 없으면 기본 확률 반환
            return {
                'probability': 0.5,
                'prediction': 0,
                'audio_features': self.audio_service.predict_single(
                    artist, track_name, album_name, tags, duration_ms
                )
            }

        try:
            prediction = model.predict(X)[0]
            probability = model.predict_proba(X)[0]

            return {
                'probability': float(probability[1]) if len(probability) > 1 else 0.5,
                'prediction': int(prediction),
                'audio_features': self.audio_service.predict_single(
                    artist, track_name, album_name, tags, duration_ms
                )
            }
        except Exception as e:
            logger.error(f"SVM 예측 오류: {e}")
            return {
                'probability': 0.5,
                'prediction': 0,
                'audio_features': {}
            }
    
    def get_recommendations(
        self,
        user_id: int,
        candidate_tracks: List[Dict],
        top_k: int = 10,
        threshold: float = 0.5
    ) -> List[Dict]:
        """후보 트랙 중 추천 선정"""
        results = []
        
        for track in candidate_tracks:
            result = self.predict_single(
                user_id=user_id,
                artist=track.get('artist', ''),
                track_name=track.get('track_name', ''),
                album_name=track.get('album_name', ''),
                tags=track.get('tags', ''),
                duration_ms=track.get('duration_ms', 200000)
            )
            
            result['artist'] = track.get('artist', '')
            result['track_name'] = track.get('track_name', '')
            result['track_id'] = track.get('track_id')
            results.append(result)
        
        # threshold 이상만 필터링
        filtered = [r for r in results if r['probability'] >= threshold]
        
        # 확률 높은 순 정렬
        sorted_results = sorted(filtered, key=lambda x: x['probability'], reverse=True)
        
        return sorted_results[:top_k]
    
    def _load_user_model(self, user_id: int) -> Optional[Any]:
        """사용자 SVM 모델 로드"""
        if user_id in self.user_models:
            return self.user_models[user_id]

        model_path = self.models_dir / f"user_{user_id}_svm.pkl"

        if not model_path.exists():
            logger.info(f"사용자 {user_id} SVM 모델 없음")
            return None

        try:
            model = joblib.load(model_path)
            self.user_models[user_id] = model
            logger.info(f"사용자 {user_id} SVM 모델 로드 완료 (393D)")
            return model
        except Exception as e:
            logger.error(f"사용자 {user_id} SVM 모델 로드 실패: {e}")
            return None
    
    def train_user_model(
        self,
        db,
        user_id: int,
        email: str = ""
    ) -> Dict:
        """
        사용자 SVM 모델 학습 (PMS 데이터 기반) - 원래 M2 설계 (393D)
        - 393D 피처: 384D SentenceTransformer + 9D 오디오
        - 저장 위치: user_models/user_{user_id}_svm.pkl
        """
        from sqlalchemy import text as sql_text

        # SentenceTransformer 로드 확인
        if not self.embedding_service.load_model():
            return {
                "success": False,
                "message": "SentenceTransformer 로드 실패. pip install sentence-transformers 필요"
            }

        # 1. PMS 트랙 조회 (Positive - 사용자 선호)
        pms_query = sql_text("""
            SELECT t.track_id, t.title as track_name, t.artist,
                   t.album as album_name, COALESCE(t.genre, 'unknown') as tags,
                   COALESCE(t.duration, 200) * 1000 as duration_ms
            FROM tracks t
            JOIN playlist_tracks pt ON t.track_id = pt.track_id
            JOIN playlists p ON pt.playlist_id = p.playlist_id
            WHERE p.user_id = :user_id AND p.space_type = 'PMS'
        """)
        pms_result = db.execute(pms_query, {"user_id": user_id}).fetchall()

        if not pms_result or len(pms_result) < 5:
            return {
                "success": False,
                "message": f"PMS 데이터 부족 ({len(pms_result) if pms_result else 0}개, 최소 5개 필요)"
            }

        # 2. EMS 트랙 조회 (Negative - 1:3 비율)
        negative_count = len(pms_result) * 3
        ems_query = sql_text("""
            SELECT t.track_id, t.title as track_name, t.artist,
                   t.album as album_name, COALESCE(t.genre, 'unknown') as tags,
                   COALESCE(t.duration, 200) * 1000 as duration_ms
            FROM tracks t
            JOIN playlist_tracks pt ON t.track_id = pt.track_id
            JOIN playlists p ON pt.playlist_id = p.playlist_id
            WHERE p.space_type = 'EMS'
            ORDER BY RAND()
            LIMIT :limit
        """)
        ems_result = db.execute(ems_query, {"limit": negative_count}).fetchall()

        # DataFrame 변환
        columns = ['track_id', 'track_name', 'artist', 'album_name', 'tags', 'duration_ms']
        positive_tracks = [dict(zip(columns, row)) for row in pms_result]
        negative_tracks = [dict(zip(columns, row)) for row in ems_result]

        logger.info(f"[M2] 사용자 {user_id}: PMS {len(positive_tracks)}곡 (positive), EMS {len(negative_tracks)}곡 (negative)")
        logger.info(f"[M2] 393D 피처 생성 (384D SentenceTransformer + 9D 오디오)")

        try:
            # 3. 393D 피처 생성
            X_list = []
            y_list = []

            for track in positive_tracks:
                features = self._create_features(
                    artist=track.get('artist', ''),
                    track_name=track.get('track_name', ''),
                    album_name=track.get('album_name', ''),
                    tags=track.get('tags', ''),
                    duration_ms=track.get('duration_ms', 200000)
                )
                X_list.append(features)
                y_list.append(1)

            for track in negative_tracks:
                features = self._create_features(
                    artist=track.get('artist', ''),
                    track_name=track.get('track_name', ''),
                    album_name=track.get('album_name', ''),
                    tags=track.get('tags', ''),
                    duration_ms=track.get('duration_ms', 200000)
                )
                X_list.append(features)
                y_list.append(0)

            X = np.array(X_list)
            y = np.array(y_list)

            logger.info(f"[M2] 피처 shape: {X.shape} (393D = 384 + 9)")

            # SVM 학습 (C=10, RBF kernel - 원래 설정)
            pipeline = Pipeline([
                ('scaler', StandardScaler()),
                ('svm', SVC(kernel='rbf', C=10, gamma='scale', probability=True, random_state=42))
            ])

            pipeline.fit(X, y)

            # 모델 저장
            model_path = self.models_dir / f"user_{user_id}_svm.pkl"
            joblib.dump(pipeline, model_path)

            # 캐시 업데이트
            self.user_models[user_id] = pipeline

            logger.info(f"[M2] 사용자 {user_id} SVM 모델 학습 완료: {model_path}")

            return {
                "success": True,
                "message": f"사용자 {user_id} 모델 학습 완료 (393D)",
                "user_id": user_id,
                "model_path": str(model_path),
                "feature_dim": 393,
                "positive_count": len(positive_tracks),
                "negative_count": len(negative_tracks)
            }

        except Exception as e:
            logger.error(f"SVM 모델 학습 오류: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"학습 오류: {str(e)}"
            }


# 싱글톤 인스턴스
_m2_service: Optional[M2RecommendationService] = None

def get_m2_service() -> M2RecommendationService:
    """M2 서비스 싱글톤"""
    global _m2_service
    if _m2_service is None:
        _m2_service = M2RecommendationService()
    return _m2_service
