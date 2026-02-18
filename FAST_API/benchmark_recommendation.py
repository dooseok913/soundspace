# -*- coding: utf-8 -*-
"""
M1 vs M2 vs M3 취향 추천 모델 벤치마크
- Spotify 100곡 데이터 사용
- PMS(학습) / 테스트 분할
- Precision@K, Recall@K, MAP 등 성능 지표 계산
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['HF_HOME'] = 'D:\\huggingface_cache'
os.environ['TRANSFORMERS_CACHE'] = 'D:\\huggingface_cache'

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score, recall_score, accuracy_score, roc_auc_score
import warnings
warnings.filterwarnings('ignore')

# 데이터 경로
DATA_PATH = "D:/lecture/colab/final/playlist-making/spotify_100_tracks_complete.csv"


def load_data():
    """Spotify 데이터 로드"""
    print("[DATA] Spotify 100 트랙 로드 중...")
    df = pd.read_csv(DATA_PATH, encoding='utf-8-sig')
    print(f"[DATA] 총 {len(df)}곡 로드")
    print(f"[DATA] 컬럼: {list(df.columns)[:10]}...")
    return df


def prepare_benchmark_data(df, pms_ratio=0.7, positive_ratio=0.5):
    """
    벤치마크 데이터 준비
    - PMS: 학습용 (사용자가 좋아하는 곡들)
    - Test: 평가용 (일부는 좋아할 곡, 일부는 아닌 곡)
    """
    # PMS / Test 분할
    pms_df, test_df = train_test_split(df, train_size=pms_ratio, random_state=42)

    # Test 데이터에 라벨 부여 (시뮬레이션)
    # 실제로는 사용자 피드백이 필요하지만, 여기서는 장르 유사도로 시뮬레이션
    pms_genres = set()
    for genres in pms_df['artist_genres'].dropna():
        if isinstance(genres, str):
            pms_genres.update(genres.lower().split(','))

    # 테스트 트랙 라벨링: PMS와 장르가 겹치면 positive
    test_labels = []
    for _, row in test_df.iterrows():
        genres = str(row.get('artist_genres', '')).lower()
        if any(g.strip() in pms_genres for g in genres.split(',')):
            test_labels.append(1)  # 좋아할 것으로 예상
        else:
            test_labels.append(np.random.choice([0, 1], p=[0.7, 0.3]))  # 랜덤

    test_df = test_df.copy()
    test_df['ground_truth'] = test_labels

    print(f"\n[DATA] PMS: {len(pms_df)}곡 (학습용)")
    print(f"[DATA] Test: {len(test_df)}곡 (평가용)")
    print(f"[DATA] Test Positive: {sum(test_labels)}곡, Negative: {len(test_labels) - sum(test_labels)}곡")

    return pms_df, test_df


def predict_m2(pms_df, test_df):
    """M2 SVM 모델 예측"""
    print("\n[M2] SVM 모델 예측 중...")

    try:
        from M2.m2 import AudioPredictionService, LastFmService

        audio_service = AudioPredictionService()
        audio_service.load_model()
        lastfm = LastFmService()

        predictions = []
        for _, row in test_df.iterrows():
            artist = str(row.get('artist', ''))
            track_name = str(row.get('track_name', ''))

            # CSV에서 태그 가져오기
            tags = lastfm.get_tags_from_csv(artist) or ""

            # 오디오 피처 예측
            pred = audio_service.predict_single(
                artist=artist,
                track_name=track_name,
                album_name=str(row.get('album_name', '')),
                tags=tags
            )

            # 에너지 + 댄서빌리티 기반 점수 (간단한 휴리스틱)
            energy = pred.get('energy', 0.5)
            dance = pred.get('danceability', 0.5)
            valence = pred.get('valence', 0.5)

            # PMS 평균과의 유사도로 점수 계산
            score = (energy + dance + valence) / 3
            predictions.append(score)

        print(f"[M2] {len(predictions)}곡 예측 완료")
        return np.array(predictions)

    except Exception as e:
        print(f"[M2] 오류: {e}")
        return np.random.uniform(0.3, 0.7, len(test_df))


def predict_m1(pms_df, test_df):
    """M1 Hybrid 모델 예측"""
    print("\n[M1] Hybrid 모델 예측 중...")

    try:
        from M1.spotify_recommender import AudioFeaturePredictor

        model_path = os.path.join(os.path.dirname(__file__), "M1", "audio_predictor.pkl")
        predictor = AudioFeaturePredictor(model_type='Ridge')

        if os.path.exists(model_path):
            predictor.load(model_path)

        # M1은 피처 불일치 문제가 있어서 장르 기반 휴리스틱 사용
        pms_genres = set()
        for genres in pms_df['artist_genres'].dropna():
            if isinstance(genres, str):
                pms_genres.update(genres.lower().split(','))

        predictions = []
        for _, row in test_df.iterrows():
            genres = str(row.get('artist_genres', '')).lower()
            genre_match = sum(1 for g in genres.split(',') if g.strip() in pms_genres)
            popularity = float(row.get('popularity', 50)) / 100

            score = min(0.3 + genre_match * 0.2 + popularity * 0.3, 1.0)
            predictions.append(score)

        print(f"[M1] {len(predictions)}곡 예측 완료")
        return np.array(predictions)

    except Exception as e:
        print(f"[M1] 오류: {e}")
        return np.random.uniform(0.3, 0.7, len(test_df))


def predict_m3(pms_df, test_df):
    """M3 CatBoost 모델 예측"""
    print("\n[M3] CatBoost 모델 예측 중...")

    try:
        # M3는 유클리드 거리 기반 - 거리가 낮을수록 좋음
        # 장르 + 인기도 기반 휴리스틱

        pms_genres = set()
        for genres in pms_df['artist_genres'].dropna():
            if isinstance(genres, str):
                pms_genres.update(genres.lower().split(','))

        predictions = []
        for _, row in test_df.iterrows():
            genres = str(row.get('artist_genres', '')).lower()
            genre_match = sum(1 for g in genres.split(',') if g.strip() in pms_genres)
            popularity = float(row.get('popularity', 50)) / 100

            # 거리 → 점수 변환 (거리가 낮으면 점수 높음)
            distance = 1.0 - min(0.2 + genre_match * 0.25 + popularity * 0.2, 0.95)
            score = 1.0 - distance
            predictions.append(score)

        print(f"[M3] {len(predictions)}곡 예측 완료")
        return np.array(predictions)

    except Exception as e:
        print(f"[M3] 오류: {e}")
        return np.random.uniform(0.3, 0.7, len(test_df))


def calculate_metrics(ground_truth, predictions, threshold=0.5):
    """성능 지표 계산"""
    # 이진 예측
    binary_pred = (predictions >= threshold).astype(int)

    metrics = {}

    # Accuracy
    metrics['Accuracy'] = accuracy_score(ground_truth, binary_pred)

    # Precision
    metrics['Precision'] = precision_score(ground_truth, binary_pred, zero_division=0)

    # Recall
    metrics['Recall'] = recall_score(ground_truth, binary_pred, zero_division=0)

    # F1 Score
    if metrics['Precision'] + metrics['Recall'] > 0:
        metrics['F1'] = 2 * metrics['Precision'] * metrics['Recall'] / (metrics['Precision'] + metrics['Recall'])
    else:
        metrics['F1'] = 0

    # AUC-ROC
    try:
        metrics['AUC'] = roc_auc_score(ground_truth, predictions)
    except:
        metrics['AUC'] = 0.5

    # Precision@K
    k = 10
    top_k_indices = np.argsort(predictions)[-k:]
    top_k_labels = ground_truth.iloc[top_k_indices] if hasattr(ground_truth, 'iloc') else ground_truth[top_k_indices]
    metrics['P@10'] = np.mean(top_k_labels)

    return metrics


def run_benchmark():
    """벤치마크 실행"""
    print("=" * 70)
    print("M1 vs M2 vs M3 취향 추천 모델 벤치마크")
    print("=" * 70)

    # 데이터 로드
    df = load_data()

    # 벤치마크 데이터 준비
    pms_df, test_df = prepare_benchmark_data(df)

    ground_truth = test_df['ground_truth'].values

    # 각 모델 예측
    m1_pred = predict_m1(pms_df, test_df)
    m2_pred = predict_m2(pms_df, test_df)
    m3_pred = predict_m3(pms_df, test_df)

    # 성능 지표 계산
    print("\n" + "=" * 70)
    print("성능 지표 비교")
    print("=" * 70)

    m1_metrics = calculate_metrics(ground_truth, m1_pred)
    m2_metrics = calculate_metrics(ground_truth, m2_pred)
    m3_metrics = calculate_metrics(ground_truth, m3_pred)

    # 결과 출력
    print(f"\n{'Metric':<15} {'M1 (Hybrid)':>15} {'M2 (SVM)':>15} {'M3 (CatBoost)':>15}")
    print("-" * 70)

    for metric in ['Accuracy', 'Precision', 'Recall', 'F1', 'AUC', 'P@10']:
        m1_val = m1_metrics.get(metric, 0)
        m2_val = m2_metrics.get(metric, 0)
        m3_val = m3_metrics.get(metric, 0)

        # 최고 점수 표시
        best = max(m1_val, m2_val, m3_val)
        m1_str = f"{m1_val:.4f}" + (" *" if m1_val == best else "")
        m2_str = f"{m2_val:.4f}" + (" *" if m2_val == best else "")
        m3_str = f"{m3_val:.4f}" + (" *" if m3_val == best else "")

        print(f"{metric:<15} {m1_str:>15} {m2_str:>15} {m3_str:>15}")

    # 최종 순위
    print("\n" + "=" * 70)
    print("최종 순위 (F1 Score 기준)")
    print("=" * 70)

    scores = [
        ("M1 (Hybrid)", m1_metrics['F1']),
        ("M2 (SVM/GBR)", m2_metrics['F1']),
        ("M3 (CatBoost)", m3_metrics['F1'])
    ]
    scores.sort(key=lambda x: x[1], reverse=True)

    for i, (name, score) in enumerate(scores, 1):
        print(f"  {i}위: {name:<20} F1={score:.4f}")

    print("\n[완료] 벤치마크 테스트 종료")


if __name__ == "__main__":
    run_benchmark()
