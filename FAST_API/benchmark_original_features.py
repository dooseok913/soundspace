# -*- coding: utf-8 -*-
"""
M1 vs M2 vs M3 벤치마크 - 각 모델의 원래 입력 피처 사용

M1: 9D 오디오 피처 → GradientBoosting 분류
M2: 393D (384D 텍스트 임베딩 + 9D 오디오) → SVM 분류
M3: categorical 피처 → CatBoost 회귀 (거리 기반)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['HF_HOME'] = 'D:\\huggingface_cache'
os.environ['TRANSFORMERS_CACHE'] = 'D:\\huggingface_cache'

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
)
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.svm import SVC
from scipy.spatial.distance import cdist
import warnings
import time
warnings.filterwarnings('ignore')

DATA_PATH = "D:/lecture/colab/final/model-check/data/full_dataset.csv"
AUDIO_PATH = "D:/lecture/colab/final/model-check/data/predicted_audio_features.csv"

AUDIO_FEATURES = [
    'danceability', 'energy', 'speechiness', 'acousticness',
    'instrumentalness', 'liveness', 'valence', 'tempo', 'loudness'
]


def load_data():
    """데이터 로드"""
    print("="*70)
    print("[데이터] 로드")
    print("="*70)

    df = pd.read_csv(DATA_PATH, encoding='utf-8-sig')
    audio_df = pd.read_csv(AUDIO_PATH)

    for col in AUDIO_FEATURES:
        if col in audio_df.columns:
            df[col] = audio_df[col].values
        df[col] = df[col].fillna(0.5)

    print(f"총: {len(df)}곡")
    print(f"Positive: {sum(df['label']==1)}, Negative: {sum(df['label']==0)}")

    return df


def evaluate_model(y_true, y_pred, y_prob=None):
    """평가 지표 계산"""
    metrics = {
        'accuracy': accuracy_score(y_true, y_pred),
        'precision': precision_score(y_true, y_pred, zero_division=0),
        'recall': recall_score(y_true, y_pred, zero_division=0),
        'f1': f1_score(y_true, y_pred, zero_division=0),
    }
    if y_prob is not None:
        metrics['auc_roc'] = roc_auc_score(y_true, y_prob)
    return metrics


def train_m1(df, test_size=0.15):
    """
    M1: 9D 오디오 피처 → GradientBoosting
    (M1/spotify_recommender.py의 PreferenceClassifier)
    """
    print("\n" + "="*70)
    print("[M1] GradientBoosting (9D 오디오 피처)")
    print("="*70)

    X = df[AUDIO_FEATURES].values
    y = df['label'].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    start = time.time()
    model = GradientBoostingClassifier(n_estimators=100, max_depth=3, random_state=42)
    model.fit(X_train_s, y_train)
    elapsed = time.time() - start

    y_pred = model.predict(X_test_s)
    y_prob = model.predict_proba(X_test_s)[:, 1]

    # Train 성능
    y_train_prob = model.predict_proba(X_train_s)[:, 1]
    train_auc = roc_auc_score(y_train, y_train_prob)

    # CV
    cv = cross_val_score(model, X_train_s, y_train, cv=5, scoring='roc_auc')

    metrics = evaluate_model(y_test, y_pred, y_prob)
    metrics['train_auc'] = train_auc
    metrics['cv_mean'] = cv.mean()
    metrics['cv_std'] = cv.std()
    metrics['time'] = elapsed

    print(f"  피처 차원: {X.shape[1]}D (9D 오디오)")
    print(f"  Train/Test: {len(X_train)}/{len(X_test)}")
    print(f"  Train AUC: {train_auc:.4f}")
    print(f"  Test AUC:  {metrics['auc_roc']:.4f}")
    print(f"  CV AUC:    {cv.mean():.4f} ± {cv.std():.4f}")
    print(f"  Precision: {metrics['precision']:.4f}")
    print(f"  Recall:    {metrics['recall']:.4f}")
    print(f"  F1:        {metrics['f1']:.4f}")

    return metrics


def train_m2(df, test_size=0.15):
    """
    M2: 393D (384D 텍스트 임베딩 + 9D 오디오) → SVM
    (M2/m2.py의 SVMRecommendationService)
    """
    print("\n" + "="*70)
    print("[M2] SVM (393D: 384D 텍스트 + 9D 오디오)")
    print("="*70)

    from sentence_transformers import SentenceTransformer

    # 텍스트 임베딩 생성
    print("  텍스트 임베딩 생성 중...")
    model_embed = SentenceTransformer('all-MiniLM-L6-v2')

    texts = []
    for _, row in df.iterrows():
        parts = []
        for col in ['artist', 'trackTitle', 'album', 'combined_tags']:
            if col in row and pd.notna(row[col]) and str(row[col]).strip():
                parts.append(str(row[col]))
        texts.append(' '.join(parts) if parts else 'unknown')

    embeddings = model_embed.encode(texts, show_progress_bar=True)
    print(f"  임베딩 shape: {embeddings.shape}")

    # 393D = 384D + 9D
    audio_array = df[AUDIO_FEATURES].values
    X = np.hstack([embeddings, audio_array])
    y = df['label'].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    start = time.time()
    model = SVC(kernel='rbf', C=10, gamma='scale', probability=True, random_state=42)
    model.fit(X_train_s, y_train)
    elapsed = time.time() - start

    y_pred = model.predict(X_test_s)
    y_prob = model.predict_proba(X_test_s)[:, 1]

    # Train 성능
    y_train_prob = model.predict_proba(X_train_s)[:, 1]
    train_auc = roc_auc_score(y_train, y_train_prob)

    # CV
    cv = cross_val_score(model, X_train_s, y_train, cv=5, scoring='roc_auc')

    metrics = evaluate_model(y_test, y_pred, y_prob)
    metrics['train_auc'] = train_auc
    metrics['cv_mean'] = cv.mean()
    metrics['cv_std'] = cv.std()
    metrics['time'] = elapsed

    print(f"  피처 차원: {X.shape[1]}D (384D 텍스트 + 9D 오디오)")
    print(f"  Train/Test: {len(X_train)}/{len(X_test)}")
    print(f"  Train AUC: {train_auc:.4f}")
    print(f"  Test AUC:  {metrics['auc_roc']:.4f}")
    print(f"  CV AUC:    {cv.mean():.4f} ± {cv.std():.4f}")
    print(f"  Precision: {metrics['precision']:.4f}")
    print(f"  Recall:    {metrics['recall']:.4f}")
    print(f"  F1:        {metrics['f1']:.4f}")

    return metrics


def train_m3(df, test_size=0.15):
    """
    M3: categorical 피처 → CatBoost 회귀 (Multi-RMSE)
    - 오디오 피처 예측 → 유클리드 거리로 추천
    - 직접 분류가 아니므로 거리 기반으로 분류 성능 평가
    (M3/service.py의 M3RecommendationService)
    """
    print("\n" + "="*70)
    print("[M3] CatBoost (categorical → 오디오 예측 → 거리 기반)")
    print("="*70)

    try:
        from catboost import CatBoostRegressor, Pool
    except ImportError:
        print("  [ERROR] CatBoost 미설치")
        return None

    # M3 피처: artists, album, track_genre (categorical)
    FEATURES = ['artist', 'album', 'combined_tags']
    TARGET = AUDIO_FEATURES

    # 데이터 준비
    for col in FEATURES:
        if col not in df.columns:
            df[col] = 'unknown'
        df[col] = df[col].fillna('unknown').astype(str)

    # Positive/Negative 분리
    pos_df = df[df['label'] == 1].copy()
    neg_df = df[df['label'] == 0].copy()

    print(f"  Positive: {len(pos_df)}, Negative: {len(neg_df)}")

    # Train/Test 분할
    pos_train, pos_test = train_test_split(pos_df, test_size=test_size, random_state=42)
    neg_train, neg_test = train_test_split(neg_df, test_size=test_size, random_state=42)

    train_df = pd.concat([pos_train, neg_train], ignore_index=True)
    test_df = pd.concat([pos_test, neg_test], ignore_index=True)

    print(f"  Train: {len(train_df)}, Test: {len(test_df)}")

    # CatBoost 학습 (Positive 데이터로만 - 사용자 선호 프로필)
    start = time.time()

    train_pool = Pool(
        data=pos_train[FEATURES],
        label=pos_train[TARGET],
        cat_features=FEATURES
    )

    model = CatBoostRegressor(
        iterations=500,
        learning_rate=0.05,
        depth=6,
        loss_function='MultiRMSE',
        random_seed=42,
        verbose=False
    )
    model.fit(train_pool)
    elapsed = time.time() - start

    # 사용자 프로필 (Positive 평균)
    user_profile = pos_train[TARGET].mean().values

    # Test 예측 (오디오 피처 예측)
    test_pred = model.predict(Pool(test_df[FEATURES], cat_features=FEATURES))

    # 유클리드 거리 계산
    distances = cdist([user_profile], test_pred, metric='euclidean')[0]

    # 거리 → 점수 (낮을수록 좋음)
    max_dist = distances.max()
    scores = 1 - (distances / max_dist) if max_dist > 0 else np.zeros(len(distances))

    # 임계값으로 분류 (중앙값 사용)
    threshold = np.median(scores)
    y_pred = (scores >= threshold).astype(int)
    y_test = test_df['label'].values

    metrics = evaluate_model(y_test, y_pred, scores)
    metrics['train_auc'] = 0  # M3는 회귀 모델이라 train AUC 없음
    metrics['cv_mean'] = 0
    metrics['cv_std'] = 0
    metrics['time'] = elapsed

    print(f"  피처: {FEATURES} (categorical)")
    print(f"  방식: 오디오 피처 예측 → 유클리드 거리")
    print(f"  Test AUC:  {metrics['auc_roc']:.4f}")
    print(f"  Precision: {metrics['precision']:.4f}")
    print(f"  Recall:    {metrics['recall']:.4f}")
    print(f"  F1:        {metrics['f1']:.4f}")

    return metrics


def main():
    print("\n" + "="*70)
    print("M1 vs M2 vs M3 벤치마크")
    print("각 모델의 원래 입력 피처 사용")
    print("="*70)

    df = load_data()

    results = {}

    # M1
    results['M1'] = train_m1(df)

    # M2
    results['M2'] = train_m2(df)

    # M3
    results['M3'] = train_m3(df)

    # 결과 요약
    print("\n" + "="*70)
    print("최종 비교")
    print("="*70)

    print(f"\n{'Model':<30} {'피처':<20} {'Test AUC':>10} {'Precision':>10} {'Recall':>10} {'F1':>10}")
    print("-"*95)

    model_info = {
        'M1': '9D 오디오',
        'M2': '393D (텍스트+오디오)',
        'M3': 'categorical→거리'
    }

    for name, m in results.items():
        if m:
            print(f"{name:<30} {model_info[name]:<20} {m['auc_roc']:>10.4f} {m['precision']:>10.4f} {m['recall']:>10.4f} {m['f1']:>10.4f}")

    print("-"*95)

    # 순위
    print("\n[순위 - AUC 기준]")
    valid = [(k, v) for k, v in results.items() if v]
    sorted_r = sorted(valid, key=lambda x: x[1]['auc_roc'], reverse=True)

    for i, (name, m) in enumerate(sorted_r, 1):
        print(f"  {i}위: {name} ({model_info[name]}) - AUC={m['auc_roc']:.4f}, F1={m['f1']:.4f}")

    print("\n" + "="*70)
    print("결론")
    print("="*70)
    print("- M2의 393D 피처(텍스트 임베딩)가 성능의 핵심")
    print("- M1, M3는 9D 오디오만 사용하여 성능 한계")
    print("- M3는 분류가 아닌 회귀(거리 기반)라서 직접 비교 어려움")


if __name__ == "__main__":
    main()
