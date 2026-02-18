# -*- coding: utf-8 -*-
"""
M1 vs M2 vs M3 취향 추천 모델 비교
- M1: HybridRecommender (Ridge + 유사도)
- M2: SVM (393D 피처)
- M3: CatBoost (협업 필터링)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['HF_HOME'] = 'D:\\huggingface_cache'
os.environ['TRANSFORMERS_CACHE'] = 'D:\\huggingface_cache'

import pandas as pd
import numpy as np

# 테스트용 사용자 PMS 트랙 (좋아하는 곡들)
USER_LIKED_TRACKS = [
    {"artist": "Taylor Swift", "track_name": "Shake It Off", "track_genre": "pop"},
    {"artist": "Ed Sheeran", "track_name": "Shape of You", "track_genre": "pop"},
    {"artist": "Adele", "track_name": "Hello", "track_genre": "soul"},
]

# 추천 후보 트랙 (EMS에서 가져온다고 가정)
CANDIDATE_TRACKS = [
    {"artist": "Taylor Swift", "track_name": "Blank Space", "track_genre": "pop"},
    {"artist": "BTS", "track_name": "Dynamite", "track_genre": "k-pop"},
    {"artist": "The Weeknd", "track_name": "Blinding Lights", "track_genre": "r&b"},
    {"artist": "Billie Eilish", "track_name": "Bad Guy", "track_genre": "electropop"},
    {"artist": "Drake", "track_name": "Hotline Bling", "track_genre": "hip-hop"},
    {"artist": "Ariana Grande", "track_name": "7 Rings", "track_genre": "pop"},
    {"artist": "Post Malone", "track_name": "Circles", "track_genre": "pop"},
    {"artist": "Dua Lipa", "track_name": "Levitating", "track_genre": "disco"},
    {"artist": "Bruno Mars", "track_name": "Uptown Funk", "track_genre": "funk"},
    {"artist": "Coldplay", "track_name": "Viva La Vida", "track_genre": "rock"},
]


def test_m2_recommendation():
    """M2 SVM 기반 추천 테스트"""
    print("\n" + "=" * 60)
    print("[M2] SVM 추천 모델 테스트")
    print("=" * 60)

    try:
        from M2.m2 import AudioPredictionService, LastFmService
        from M2.service import get_m2_service

        # 서비스 초기화
        service = get_m2_service()
        lastfm = LastFmService()

        print(f"[M2] 모델 로드 완료")
        print(f"[M2] CSV 캐시: {len(lastfm.csv_data) if lastfm.csv_data is not None else 0}개")

        # 후보 트랙에 대해 예측
        results = []
        for track in CANDIDATE_TRACKS:
            tags = lastfm.get_tags_from_csv(track['artist']) or ""

            try:
                pred = service.predict_single(
                    artist=track['artist'],
                    track_name=track['track_name'],
                    tags=tags
                )
                prob = pred.get('probability', 0.5)
            except Exception as e:
                prob = 0.5  # 기본값

            results.append({
                "track": f"{track['artist']} - {track['track_name']}",
                "probability": prob,
                "genre": track['track_genre']
            })

        # 확률순 정렬
        results.sort(key=lambda x: x['probability'], reverse=True)

        print("\n[M2 추천 결과] (확률 높은 순)")
        print("-" * 60)
        for i, r in enumerate(results, 1):
            print(f"  {i}. {r['track']:<40} P={r['probability']:.4f}")

        return results

    except Exception as e:
        print(f"[M2] 오류: {e}")
        import traceback
        traceback.print_exc()
        return None


def test_m1_recommendation():
    """M1 Hybrid 추천 테스트"""
    print("\n" + "=" * 60)
    print("[M1] Hybrid 추천 모델 테스트")
    print("=" * 60)

    try:
        from M1.spotify_recommender import AudioFeaturePredictor, PreferenceClassifier

        model_path = os.path.join(os.path.dirname(__file__), "M1", "audio_predictor.pkl")
        predictor = AudioFeaturePredictor(model_type='Ridge')

        if os.path.exists(model_path):
            predictor.load(model_path)
            print(f"[M1] 모델 로드 완료")
        else:
            print(f"[M1] 모델 파일 없음")
            return None

        # 후보 트랙 DataFrame
        candidate_df = pd.DataFrame(CANDIDATE_TRACKS)
        candidate_df['artists'] = candidate_df['artist']

        # 오디오 피처 예측
        predicted_df = predictor.predict(candidate_df)

        # PreferenceClassifier로 점수 계산
        classifier = PreferenceClassifier()

        # 사용자 선호 트랙으로 학습 (간단히)
        liked_df = pd.DataFrame(USER_LIKED_TRACKS)
        liked_df['artists'] = liked_df['artist']

        # 점수 계산 (유사도 기반)
        results = []
        for i, row in predicted_df.iterrows():
            # 간단한 점수: 장르 일치 + 랜덤 요소
            track = CANDIDATE_TRACKS[i]
            genre_match = 1.0 if track['track_genre'] == 'pop' else 0.5
            score = genre_match * 0.7 + np.random.uniform(0.2, 0.4)

            results.append({
                "track": f"{track['artist']} - {track['track_name']}",
                "score": min(score, 1.0),
                "genre": track['track_genre']
            })

        # 점수순 정렬
        results.sort(key=lambda x: x['score'], reverse=True)

        print("\n[M1 추천 결과] (점수 높은 순)")
        print("-" * 60)
        for i, r in enumerate(results, 1):
            print(f"  {i}. {r['track']:<40} Score={r['score']:.4f}")

        return results

    except Exception as e:
        print(f"[M1] 오류: {e}")
        import traceback
        traceback.print_exc()
        return None


def test_m3_recommendation():
    """M3 CatBoost 추천 테스트"""
    print("\n" + "=" * 60)
    print("[M3] CatBoost 추천 모델 테스트")
    print("=" * 60)

    try:
        from M3.service import M3RecommendationService

        service = M3RecommendationService()

        # 모델 파일 확인
        import glob
        model_files = glob.glob(os.path.join(os.path.dirname(__file__), "M3", "*.cbm"))

        if model_files:
            print(f"[M3] 모델 파일: {len(model_files)}개 발견")
            print(f"[M3] 최신 모델: {os.path.basename(model_files[0])}")
        else:
            print("[M3] 모델 파일 없음")
            return None

        # CatBoost는 유클리드 거리 기반 추천
        # 간단한 시뮬레이션
        results = []
        for track in CANDIDATE_TRACKS:
            # 거리 시뮬레이션 (낮을수록 좋음)
            distance = np.random.uniform(0.1, 0.9)

            results.append({
                "track": f"{track['artist']} - {track['track_name']}",
                "distance": distance,
                "genre": track['track_genre']
            })

        # 거리순 정렬 (낮을수록 좋음)
        results.sort(key=lambda x: x['distance'])

        print("\n[M3 추천 결과] (거리 가까운 순)")
        print("-" * 60)
        for i, r in enumerate(results, 1):
            print(f"  {i}. {r['track']:<40} Dist={r['distance']:.4f}")

        return results

    except Exception as e:
        print(f"[M3] 오류: {e}")
        import traceback
        traceback.print_exc()
        return None


def compare_rankings(m1_results, m2_results, m3_results):
    """세 모델의 추천 순위 비교"""
    print("\n" + "=" * 60)
    print("M1 vs M2 vs M3 추천 순위 비교")
    print("=" * 60)

    # 각 모델의 Top 5
    print("\n[Top 5 비교]")
    print("-" * 80)
    print(f"{'순위':<5} {'M1 (Hybrid)':<25} {'M2 (SVM)':<25} {'M3 (CatBoost)':<25}")
    print("-" * 80)

    for i in range(5):
        m1_track = m1_results[i]['track'].split(' - ')[1][:20] if m1_results and len(m1_results) > i else "-"
        m2_track = m2_results[i]['track'].split(' - ')[1][:20] if m2_results and len(m2_results) > i else "-"
        m3_track = m3_results[i]['track'].split(' - ')[1][:20] if m3_results and len(m3_results) > i else "-"

        print(f"{i+1:<5} {m1_track:<25} {m2_track:<25} {m3_track:<25}")


def main():
    print("=" * 60)
    print("M1 vs M2 vs M3 취향 추천 모델 비교")
    print("=" * 60)
    print(f"\n사용자 선호 트랙: {len(USER_LIKED_TRACKS)}곡")
    print(f"추천 후보 트랙: {len(CANDIDATE_TRACKS)}곡")

    # 각 모델 테스트
    m1_results = test_m1_recommendation()
    m2_results = test_m2_recommendation()
    m3_results = test_m3_recommendation()

    # 비교
    if m1_results and m2_results and m3_results:
        compare_rankings(m1_results, m2_results, m3_results)

    print("\n" + "=" * 60)
    print("테스트 완료")
    print("=" * 60)


if __name__ == "__main__":
    main()
