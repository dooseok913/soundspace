# -*- coding: utf-8 -*-
"""
M1 vs M2 vs M3 취향 추천 모델 벤치마크 (실제 학습)
- Spotify 100곡 PMS (Positive)
- 114k EMS에서 Negative 샘플링
- 각 모델 실제 학습 후 성능 비교
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['HF_HOME'] = 'D:\\huggingface_cache'
os.environ['TRANSFORMERS_CACHE'] = 'D:\\huggingface_cache'

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import (
    precision_score, recall_score, accuracy_score,
    roc_auc_score, f1_score, classification_report
)
from sklearn.preprocessing import StandardScaler
import warnings
import time
warnings.filterwarnings('ignore')

# 데이터 경로
PMS_PATH = "D:/lecture/colab/final/playlist-making/spotify_100_tracks_complete.csv"
EMS_PATH = "D:/lecture/colab/final/app-coding/fastapi/data/spotify_114k_with_tags.csv"

# 오디오 피처
AUDIO_FEATURES = [
    'danceability', 'energy', 'speechiness', 'acousticness',
    'instrumentalness', 'liveness', 'valence', 'tempo', 'loudness'
]


def load_data():
    """PMS / EMS 데이터 로드"""
    print("\n" + "="*70)
    print("[DATA] 데이터 로드")
    print("="*70)

    # PMS: 100곡 (사용자가 좋아하는 곡)
    pms_df = pd.read_csv(PMS_PATH, encoding='utf-8-sig')
    print(f"[PMS] {len(pms_df)}곡 로드 (Positive)")

    # EMS: 114k곡 (Negative 샘플링용)
    ems_df = pd.read_csv(EMS_PATH, encoding='utf-8-sig')
    print(f"[EMS] {len(ems_df)}곡 로드 (Negative Pool)")

    # 컬럼명 통일
    if 'artists' not in pms_df.columns and 'artist' in pms_df.columns:
        pms_df['artists'] = pms_df['artist']
    if 'artist' not in pms_df.columns and 'artists' in pms_df.columns:
        pms_df['artist'] = pms_df['artists']

    return pms_df, ems_df


def sample_negatives_hard(pms_df, ems_df, ratio=3):
    """Hard Negative 샘플링 (M2 방식)
    - 50% Hard Negative: 같은 아티스트의 다른 곡
    - 50% Random Negative: 랜덤 곡
    """
    print(f"\n[Negative] Hard Negative 샘플링 (1:{ratio})")

    n_positive = len(pms_df)
    n_negative = n_positive * ratio

    # PMS 아티스트/트랙 목록
    pms_artists = set()
    if 'artist' in pms_df.columns:
        pms_artists = set(pms_df['artist'].str.lower().unique())
    elif 'artists' in pms_df.columns:
        pms_artists = set(pms_df['artists'].str.lower().unique())

    pms_tracks = set()
    artist_col = 'artist' if 'artist' in pms_df.columns else 'artists'
    track_col = 'track_name' if 'track_name' in pms_df.columns else 'name'

    for _, row in pms_df.iterrows():
        key = f"{str(row.get(artist_col, '')).lower()}|{str(row.get(track_col, '')).lower()}"
        pms_tracks.add(key)

    # EMS 중복 제거
    ems_df = ems_df.copy()
    ems_artist_col = 'artists' if 'artists' in ems_df.columns else 'artist'
    ems_track_col = 'track_name' if 'track_name' in ems_df.columns else 'name'

    ems_df['_key'] = ems_df[ems_artist_col].fillna('').str.lower() + '|' + ems_df[ems_track_col].fillna('').str.lower()
    ems_df = ems_df[~ems_df['_key'].isin(pms_tracks)]

    # Hard Negative: 같은 아티스트의 다른 곡
    hard_negatives = ems_df[ems_df[ems_artist_col].fillna('').str.lower().isin(pms_artists)]
    n_hard = min(len(hard_negatives), n_negative // 2)

    if n_hard > 0:
        hard_sample = hard_negatives.sample(n=n_hard, random_state=42)
    else:
        hard_sample = pd.DataFrame()

    # Random Negative
    remaining = ems_df[~ems_df.index.isin(hard_sample.index)]
    n_random = n_negative - n_hard

    if len(remaining) >= n_random:
        random_sample = remaining.sample(n=n_random, random_state=42)
    else:
        random_sample = remaining

    negative_df = pd.concat([hard_sample, random_sample], ignore_index=True)

    print(f"  - Hard Negative: {n_hard}곡 (같은 아티스트)")
    print(f"  - Random Negative: {len(random_sample)}곡")
    print(f"  - Total Negative: {len(negative_df)}곡")

    return negative_df


def prepare_training_data(pms_df, negative_df):
    """학습 데이터 준비"""
    # Positive 라벨
    pms_df = pms_df.copy()
    pms_df['label'] = 1

    # Negative 라벨
    negative_df = negative_df.copy()
    negative_df['label'] = 0

    # 컬럼 통일
    cols_to_keep = ['label']
    for col in AUDIO_FEATURES:
        if col in pms_df.columns:
            cols_to_keep.append(col)

    # 병합
    combined = pd.concat([
        pms_df[cols_to_keep] if all(c in pms_df.columns for c in cols_to_keep) else pms_df,
        negative_df[cols_to_keep] if all(c in negative_df.columns for c in cols_to_keep) else negative_df
    ], ignore_index=True)

    # 셔플
    combined = combined.sample(frac=1, random_state=42).reset_index(drop=True)

    return combined


def train_m1_preference(X_train, y_train, X_test, y_test):
    """M1 PreferenceClassifier 학습 (GradientBoosting)"""
    print("\n" + "="*70)
    print("[M1] GradientBoosting 취향 모델 학습")
    print("="*70)

    from sklearn.ensemble import GradientBoostingClassifier

    start = time.time()

    # 스케일링
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 모델 학습
    model = GradientBoostingClassifier(
        n_estimators=100,
        max_depth=3,
        random_state=42
    )
    model.fit(X_train_scaled, y_train)

    elapsed = time.time() - start

    # 예측
    y_pred = model.predict(X_test_scaled)
    y_prob = model.predict_proba(X_test_scaled)[:, 1]

    # 메트릭
    metrics = {
        'model': 'M1 (GradientBoosting)',
        'accuracy': accuracy_score(y_test, y_pred),
        'precision': precision_score(y_test, y_pred, zero_division=0),
        'recall': recall_score(y_test, y_pred, zero_division=0),
        'f1': f1_score(y_test, y_pred, zero_division=0),
        'auc_roc': roc_auc_score(y_test, y_prob),
        'train_time': elapsed
    }

    # CV (5-Fold)
    cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5, scoring='roc_auc')
    metrics['cv_auc_mean'] = cv_scores.mean()
    metrics['cv_auc_std'] = cv_scores.std()

    print(f"  학습 시간: {elapsed:.2f}초")
    print(f"  Accuracy: {metrics['accuracy']:.4f}")
    print(f"  AUC-ROC: {metrics['auc_roc']:.4f}")
    print(f"  CV AUC: {metrics['cv_auc_mean']:.4f} ± {metrics['cv_auc_std']:.4f}")

    return metrics


def train_m2_svm(X_train, y_train, X_test, y_test, use_393d=True):
    """M2 SVM 모델 학습 (393D 피처 또는 9D 오디오)"""
    print("\n" + "="*70)
    if use_393d:
        print("[M2] SVM 모델 학습 (384D 임베딩 + 9D 오디오 = 393D)")
    else:
        print("[M2] SVM 모델 학습 (9D 오디오 피처)")
    print("="*70)

    from sklearn.svm import SVC

    start = time.time()

    # 스케일링
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # SVM with RBF kernel (Grid Search 최적값 사용: C=10, gamma=scale)
    model = SVC(
        kernel='rbf',
        C=10,
        gamma='scale',
        probability=True,
        random_state=42
    )
    model.fit(X_train_scaled, y_train)

    elapsed = time.time() - start

    # 예측
    y_pred = model.predict(X_test_scaled)
    y_prob = model.predict_proba(X_test_scaled)[:, 1]

    # 메트릭
    metrics = {
        'model': 'M2 (SVM/393D)' if use_393d else 'M2 (SVM/9D)',
        'accuracy': accuracy_score(y_test, y_pred),
        'precision': precision_score(y_test, y_pred, zero_division=0),
        'recall': recall_score(y_test, y_pred, zero_division=0),
        'f1': f1_score(y_test, y_pred, zero_division=0),
        'auc_roc': roc_auc_score(y_test, y_prob),
        'train_time': elapsed
    }

    # CV
    cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5, scoring='roc_auc')
    metrics['cv_auc_mean'] = cv_scores.mean()
    metrics['cv_auc_std'] = cv_scores.std()

    print(f"  학습 시간: {elapsed:.2f}초")
    print(f"  Accuracy: {metrics['accuracy']:.4f}")
    print(f"  AUC-ROC: {metrics['auc_roc']:.4f}")
    print(f"  CV AUC: {metrics['cv_auc_mean']:.4f} ± {metrics['cv_auc_std']:.4f}")

    return metrics


def train_m3_catboost(X_train, y_train, X_test, y_test):
    """M3 CatBoost 분류 모델 학습"""
    print("\n" + "="*70)
    print("[M3] CatBoost 분류 모델 학습")
    print("="*70)

    try:
        from catboost import CatBoostClassifier
    except ImportError:
        print("  [WARNING] CatBoost 미설치, 대체 모델 사용")
        from sklearn.ensemble import RandomForestClassifier

        start = time.time()
        model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
        model.fit(X_train, y_train)
        elapsed = time.time() - start

        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test)[:, 1]

        metrics = {
            'model': 'M3 (RandomForest-대체)',
            'accuracy': accuracy_score(y_test, y_pred),
            'precision': precision_score(y_test, y_pred, zero_division=0),
            'recall': recall_score(y_test, y_pred, zero_division=0),
            'f1': f1_score(y_test, y_pred, zero_division=0),
            'auc_roc': roc_auc_score(y_test, y_prob),
            'train_time': elapsed
        }
        return metrics

    start = time.time()

    # CatBoost 분류기
    model = CatBoostClassifier(
        iterations=500,
        learning_rate=0.05,
        depth=6,
        random_seed=42,
        verbose=False,
        early_stopping_rounds=50
    )

    # Train/Eval 분할
    X_tr, X_eval, y_tr, y_eval = train_test_split(X_train, y_train, test_size=0.2, random_state=42)
    model.fit(X_tr, y_tr, eval_set=(X_eval, y_eval), verbose=False)

    elapsed = time.time() - start

    # 예측
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    # 메트릭
    metrics = {
        'model': 'M3 (CatBoost)',
        'accuracy': accuracy_score(y_test, y_pred),
        'precision': precision_score(y_test, y_pred, zero_division=0),
        'recall': recall_score(y_test, y_pred, zero_division=0),
        'f1': f1_score(y_test, y_pred, zero_division=0),
        'auc_roc': roc_auc_score(y_test, y_prob),
        'train_time': elapsed
    }

    # CV
    cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='roc_auc')
    metrics['cv_auc_mean'] = cv_scores.mean()
    metrics['cv_auc_std'] = cv_scores.std()

    print(f"  학습 시간: {elapsed:.2f}초")
    print(f"  Accuracy: {metrics['accuracy']:.4f}")
    print(f"  AUC-ROC: {metrics['auc_roc']:.4f}")
    print(f"  CV AUC: {metrics['cv_auc_mean']:.4f} ± {metrics['cv_auc_std']:.4f}")

    return metrics


def create_text_embeddings(df, pms_df, ems_df):
    """393D 피처 생성 (텍스트 임베딩 + 오디오)"""
    print("\n[FEATURE] 393D 피처 생성 (384D 임베딩 + 9D 오디오)")

    try:
        from sentence_transformers import SentenceTransformer

        print("  SentenceTransformer 로드 중...")
        model = SentenceTransformer('all-MiniLM-L6-v2')

        # 텍스트 구성
        texts = []
        for _, row in df.iterrows():
            # 아티스트, 트랙명, 앨범명, 태그 조합
            parts = []
            for col in ['artist', 'artists', 'track_name', 'name', 'album_name', 'album', 'lfm_artist_tags', 'tags']:
                if col in row and pd.notna(row[col]):
                    parts.append(str(row[col]))
            texts.append(' '.join(parts) if parts else 'unknown')

        print(f"  임베딩 생성 중 ({len(texts)}개)...")
        embeddings = model.encode(texts, show_progress_bar=True)
        print(f"  임베딩 완료: {embeddings.shape}")

        return embeddings

    except ImportError:
        print("  [WARNING] sentence-transformers 미설치, 랜덤 임베딩 사용")
        return np.random.randn(len(df), 384)


def run_benchmark():
    """벤치마크 실행"""
    print("\n" + "="*70)
    print("M1 vs M2 vs M3 취향 추천 모델 벤치마크")
    print("="*70)
    print("- 실제 학습 기반 성능 비교")
    print("- Hard Negative 샘플링 적용 (1:3 비율)")
    print("="*70)

    # 1. 데이터 로드
    pms_df, ems_df = load_data()

    # 2. Hard Negative 샘플링
    negative_df = sample_negatives_hard(pms_df, ems_df, ratio=3)

    # 3. 오디오 피처 확인
    print("\n[FEATURE] 오디오 피처 확인")
    pms_audio_cols = [c for c in AUDIO_FEATURES if c in pms_df.columns]
    ems_audio_cols = [c for c in AUDIO_FEATURES if c in ems_df.columns]
    print(f"  PMS 오디오 피처: {pms_audio_cols}")
    print(f"  EMS 오디오 피처: {ems_audio_cols}")

    # 공통 오디오 피처
    common_audio = list(set(pms_audio_cols) & set(ems_audio_cols))
    if not common_audio:
        print("  [WARNING] 공통 오디오 피처 없음, 기본 피처 사용")
        common_audio = AUDIO_FEATURES

    # 4. 학습 데이터 준비 (9D 오디오)
    print(f"\n[DATA] 학습 데이터 준비 (9D 오디오 피처)")

    # Positive 데이터
    pms_features = pms_df.copy()
    for col in AUDIO_FEATURES:
        if col not in pms_features.columns:
            pms_features[col] = 0.5  # 기본값
    pms_features['label'] = 1

    # Negative 데이터
    neg_features = negative_df.copy()
    for col in AUDIO_FEATURES:
        if col not in neg_features.columns:
            neg_features[col] = 0.5
    neg_features['label'] = 0

    # 병합
    combined = pd.concat([
        pms_features[AUDIO_FEATURES + ['label']],
        neg_features[AUDIO_FEATURES + ['label']]
    ], ignore_index=True)

    # 결측치 처리
    for col in AUDIO_FEATURES:
        combined[col] = combined[col].fillna(0.5)

    # 셔플
    combined = combined.sample(frac=1, random_state=42).reset_index(drop=True)

    X_audio = combined[AUDIO_FEATURES].values
    y = combined['label'].values

    print(f"  Total: {len(combined)}개 (Pos={sum(y)}, Neg={len(y)-sum(y)})")

    # 5. Train/Test 분할
    X_train, X_test, y_train, y_test = train_test_split(
        X_audio, y, test_size=0.15, random_state=42, stratify=y
    )
    print(f"  Train: {len(X_train)}개, Test: {len(X_test)}개")

    results = []

    # 6. M1 학습 (GradientBoosting, 9D 오디오)
    m1_metrics = train_m1_preference(X_train, y_train, X_test, y_test)
    results.append(m1_metrics)

    # 7. M2 학습 (SVM, 9D 오디오)
    m2_metrics_9d = train_m2_svm(X_train, y_train, X_test, y_test, use_393d=False)
    results.append(m2_metrics_9d)

    # 8. M3 학습 (CatBoost, 9D 오디오)
    m3_metrics = train_m3_catboost(X_train, y_train, X_test, y_test)
    results.append(m3_metrics)

    # 9. M2 with 393D (텍스트 임베딩 추가)
    print("\n" + "="*70)
    print("[393D] 텍스트 임베딩 포함 피처 생성")
    print("="*70)

    # 전체 데이터로 임베딩 생성
    combined_full = pd.concat([pms_features, neg_features], ignore_index=True)
    combined_full = combined_full.sample(frac=1, random_state=42).reset_index(drop=True)

    embeddings = create_text_embeddings(combined_full, pms_df, ems_df)

    # 393D = 384D 임베딩 + 9D 오디오
    X_audio_full = combined_full[AUDIO_FEATURES].fillna(0.5).values
    X_393d = np.hstack([embeddings, X_audio_full])
    y_full = combined_full['label'].values

    print(f"  393D 피처: {X_393d.shape}")

    # Train/Test 분할
    X_train_393d, X_test_393d, y_train_393d, y_test_393d = train_test_split(
        X_393d, y_full, test_size=0.15, random_state=42, stratify=y_full
    )

    # M2 with 393D
    m2_metrics_393d = train_m2_svm(X_train_393d, y_train_393d, X_test_393d, y_test_393d, use_393d=True)
    results.append(m2_metrics_393d)

    # 10. 결과 출력
    print("\n" + "="*70)
    print("최종 성능 비교")
    print("="*70)

    print(f"\n{'Model':<25} {'Accuracy':>10} {'Precision':>10} {'Recall':>10} {'F1':>10} {'AUC-ROC':>10}")
    print("-"*75)

    for r in results:
        print(f"{r['model']:<25} {r['accuracy']:>10.4f} {r['precision']:>10.4f} {r['recall']:>10.4f} {r['f1']:>10.4f} {r['auc_roc']:>10.4f}")

    print("-"*75)

    # CV 결과
    print(f"\n{'Model':<25} {'CV AUC Mean':>12} {'CV AUC Std':>12} {'Train Time':>12}")
    print("-"*65)

    for r in results:
        cv_mean = r.get('cv_auc_mean', 0)
        cv_std = r.get('cv_auc_std', 0)
        print(f"{r['model']:<25} {cv_mean:>12.4f} {cv_std:>12.4f} {r['train_time']:>10.2f}s")

    # 최고 성능 모델
    print("\n" + "="*70)
    print("순위 (AUC-ROC 기준)")
    print("="*70)

    sorted_results = sorted(results, key=lambda x: x['auc_roc'], reverse=True)
    for i, r in enumerate(sorted_results, 1):
        print(f"  {i}위: {r['model']:<25} AUC={r['auc_roc']:.4f}")

    print("\n[완료] 벤치마크 종료")

    return results


if __name__ == "__main__":
    run_benchmark()
