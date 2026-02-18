# -*- coding: utf-8 -*-
"""
M1 vs M2 오디오 피처 예측 비교
- M1: Ridge Regression
- M2: TF-IDF + GradientBoosting (dooseok 모델)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['HF_HOME'] = 'D:\\huggingface_cache'
os.environ['TRANSFORMERS_CACHE'] = 'D:\\huggingface_cache'

import pandas as pd
import numpy as np

# 테스트 트랙
TEST_TRACKS = [
    {"artist": "Taylor Swift", "track_name": "Shake It Off", "album_name": "1989", "track_genre": "pop"},
    {"artist": "Ed Sheeran", "track_name": "Shape of You", "album_name": "Divide", "track_genre": "pop"},
    {"artist": "The Weeknd", "track_name": "Blinding Lights", "album_name": "After Hours", "track_genre": "r&b"},
    {"artist": "Adele", "track_name": "Hello", "album_name": "25", "track_genre": "soul"},
    {"artist": "BTS", "track_name": "Dynamite", "album_name": "BE", "track_genre": "k-pop"},
]

FEATURES = ['danceability', 'energy', 'valence', 'acousticness', 'speechiness']

def test_m1_prediction():
    """M1 Ridge Regression 오디오 피처 예측"""
    print("\n[M1] Ridge Regression 모델 로드...")

    from M1.spotify_recommender import AudioFeaturePredictor

    model_path = os.path.join(os.path.dirname(__file__), "M1", "audio_predictor.pkl")
    predictor = AudioFeaturePredictor(model_type='Ridge')

    if os.path.exists(model_path):
        predictor.load(model_path)
        print(f"[M1] 모델 로드 완료: {model_path}")
    else:
        print(f"[M1] 모델 파일 없음: {model_path}")
        return None

    # DataFrame 생성
    df = pd.DataFrame(TEST_TRACKS)
    df['artists'] = df['artist']  # M1은 'artists' 컬럼 사용

    # 예측
    result_df = predictor.predict(df)

    results = []
    for i, track in enumerate(TEST_TRACKS):
        row = result_df.iloc[i]
        pred = {}
        for f in FEATURES:
            col = f'predicted_{f}'
            if col in row:
                pred[f] = float(row[col])
            else:
                pred[f] = 0.0
        results.append({
            "track": f"{track['artist']} - {track['track_name']}",
            "predictions": pred
        })

    return results

def test_m2_prediction():
    """M2 TF-IDF + GBR 오디오 피처 예측"""
    print("\n[M2] TF-IDF + GradientBoosting 모델 로드...")

    from M2.m2 import AudioPredictionService, LastFmService

    audio_service = AudioPredictionService()
    audio_service.load_model()
    print("[M2] 오디오 예측 모델 로드 완료")

    lastfm = LastFmService()
    print(f"[M2] CSV 캐시: {len(lastfm.csv_data) if lastfm.csv_data is not None else 0}개 아티스트")

    results = []
    for track in TEST_TRACKS:
        # CSV에서 태그 가져오기
        tags = lastfm.get_tags_from_csv(track['artist']) or ""

        # 예측
        pred = audio_service.predict_single(
            artist=track['artist'],
            track_name=track['track_name'],
            album_name=track.get('album_name', ''),
            tags=tags
        )

        results.append({
            "track": f"{track['artist']} - {track['track_name']}",
            "tags": tags[:50] + "..." if len(tags) > 50 else tags,
            "predictions": {f: pred.get(f, 0) for f in FEATURES}
        })

    return results

def compare_results(m1_results, m2_results):
    """M1 vs M2 비교"""
    print("\n" + "=" * 80)
    print("M1 (Ridge) vs M2 (TF-IDF + GBR) 오디오 피처 예측 비교")
    print("=" * 80)

    # 헤더
    print(f"\n{'Track':<30} {'Feature':<15} {'M1':>10} {'M2':>10} {'Diff':>10}")
    print("-" * 80)

    total_diff = {f: [] for f in FEATURES}

    for m1, m2 in zip(m1_results, m2_results):
        track = m1['track'][:29]
        for i, f in enumerate(FEATURES):
            m1_val = m1['predictions'].get(f, 0)
            m2_val = m2['predictions'].get(f, 0)
            diff = m2_val - m1_val
            total_diff[f].append(abs(diff))

            if i == 0:
                print(f"{track:<30} {f:<15} {m1_val:>10.4f} {m2_val:>10.4f} {diff:>+10.4f}")
            else:
                print(f"{'':<30} {f:<15} {m1_val:>10.4f} {m2_val:>10.4f} {diff:>+10.4f}")
        print()

    # 평균 차이
    print("=" * 80)
    print("평균 절대 차이 (MAE)")
    print("-" * 80)
    for f in FEATURES:
        mae = np.mean(total_diff[f])
        print(f"  {f:<15}: {mae:.4f}")

    overall_mae = np.mean([np.mean(total_diff[f]) for f in FEATURES])
    print(f"\n  전체 평균 MAE: {overall_mae:.4f}")

def main():
    print("=" * 80)
    print("M1 vs M2 오디오 피처 예측 비교 테스트")
    print("=" * 80)

    # M1 테스트
    m1_results = test_m1_prediction()

    # M2 테스트
    m2_results = test_m2_prediction()

    if m1_results and m2_results:
        compare_results(m1_results, m2_results)
    else:
        print("테스트 실패: 모델 로드 오류")

if __name__ == "__main__":
    main()
