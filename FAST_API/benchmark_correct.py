# -*- coding: utf-8 -*-
"""
M1 vs M2 vs M3 취향 추천 모델 벤치마크 (올바른 데이터)
- model-check/data/full_dataset.csv 사용 (1,751곡)
- Positive 431 / Negative 1,320 (1:3 비율)
- Hard Negative + Random Negative 포함
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
    roc_auc_score, f1_score, confusion_matrix
)
from sklearn.preprocessing import StandardScaler
import warnings
import time
warnings.filterwarnings('ignore')

# 데이터 경로 (실제 학습에 사용된 데이터)
DATA_PATH = "D:/lecture/colab/final/model-check/data/full_dataset.csv"

# 오디오 피처 (예측된 것 사용)
PREDICTED_AUDIO_PATH = "D:/lecture/colab/final/model-check/data/predicted_audio_features.csv"


def load_data():
    """실제 학습 데이터 로드"""
    print("\n" + "="*70)
    print("[DATA] 실제 학습 데이터 로드")
    print("="*70)

    df = pd.read_csv(DATA_PATH, encoding='utf-8-sig')
    print(f"[DATA] 총 {len(df)}곡 로드")

    # 라벨 분포
    positive = df[df['label'] == 1]
    negative = df[df['label'] == 0]
    print(f"[DATA] Positive: {len(positive)}곡")
    print(f"[DATA] Negative: {len(negative)}곡")

    # Negative 유형
    if 'neg_type' in df.columns:
        neg_types = negative['neg_type'].value_counts()
        print(f"[DATA] Negative 유형:")
        for t, c in neg_types.items():
            print(f"       - {t}: {c}곡")

    # 예측된 오디오 피처 로드
    if os.path.exists(PREDICTED_AUDIO_PATH):
        audio_df = pd.read_csv(PREDICTED_AUDIO_PATH)
        print(f"\n[AUDIO] 예측된 오디오 피처 로드: {len(audio_df)}곡")
        print(f"[AUDIO] 피처: {list(audio_df.columns)}")

        # 병합 (인덱스 기준)
        if len(audio_df) == len(df):
            for col in audio_df.columns:
                if col not in ['trackTitle', 'artist']:
                    df[col] = audio_df[col].values
    else:
        print(f"[WARNING] 오디오 피처 파일 없음: {PREDICTED_AUDIO_PATH}")

    return df


def prepare_features(df):
    """피처 준비"""
    # 오디오 피처 컬럼
    audio_cols = [
        'danceability', 'energy', 'speechiness', 'acousticness',
        'instrumentalness', 'liveness', 'valence', 'tempo', 'loudness'
    ]

    # 예측된 오디오 피처 컬럼
    predicted_cols = [
        'predicted_danceability', 'predicted_energy', 'predicted_speechiness',
        'predicted_acousticness', 'predicted_instrumentalness',
        'predicted_liveness', 'predicted_valence', 'predicted_tempo',
        'predicted_loudness'
    ]

    # 사용 가능한 컬럼 확인
    available_cols = []
    for col in predicted_cols:
        if col in df.columns:
            available_cols.append(col)

    if not available_cols:
        for col in audio_cols:
            if col in df.columns:
                available_cols.append(col)

    print(f"\n[FEATURE] 사용 피처: {available_cols}")

    if not available_cols:
        print("[ERROR] 사용 가능한 오디오 피처 없음")
        return None, None

    # 피처와 라벨
    X = df[available_cols].fillna(0.5).values
    y = df['label'].values

    return X, y


def train_m1_gradientboosting(X_train, y_train, X_test, y_test):
    """M1 GradientBoosting (PreferenceClassifier)"""
    print("\n" + "="*70)
    print("[M1] GradientBoosting (PreferenceClassifier)")
    print("="*70)

    from sklearn.ensemble import GradientBoostingClassifier

    start = time.time()

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

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

    # Train 성능
    y_train_pred = model.predict(X_train_scaled)
    y_train_prob = model.predict_proba(X_train_scaled)[:, 1]
    train_auc = roc_auc_score(y_train, y_train_prob)

    metrics = {
        'model': 'M1 (GradientBoosting)',
        'train_auc': train_auc,
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

    print(f"  Train AUC: {train_auc:.4f}")
    print(f"  Test AUC:  {metrics['auc_roc']:.4f}")
    print(f"  Gap:       {train_auc - metrics['auc_roc']:.4f}")
    print(f"  CV AUC:    {metrics['cv_auc_mean']:.4f} ± {metrics['cv_auc_std']:.4f}")

    return metrics


def train_m2_svm(X_train, y_train, X_test, y_test):
    """M2 SVM (RBF kernel, C=10)"""
    print("\n" + "="*70)
    print("[M2] SVM (RBF, C=10)")
    print("="*70)

    from sklearn.svm import SVC

    start = time.time()

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = SVC(
        kernel='rbf',
        C=10,
        gamma='scale',
        probability=True,
        random_state=42
    )
    model.fit(X_train_scaled, y_train)

    elapsed = time.time() - start

    y_pred = model.predict(X_test_scaled)
    y_prob = model.predict_proba(X_test_scaled)[:, 1]

    # Train 성능
    y_train_prob = model.predict_proba(X_train_scaled)[:, 1]
    train_auc = roc_auc_score(y_train, y_train_prob)

    metrics = {
        'model': 'M2 (SVM)',
        'train_auc': train_auc,
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

    print(f"  Train AUC: {train_auc:.4f}")
    print(f"  Test AUC:  {metrics['auc_roc']:.4f}")
    print(f"  Gap:       {train_auc - metrics['auc_roc']:.4f}")
    print(f"  CV AUC:    {metrics['cv_auc_mean']:.4f} ± {metrics['cv_auc_std']:.4f}")

    return metrics


def train_m3_catboost(X_train, y_train, X_test, y_test):
    """M3 CatBoost (또는 RandomForest 대체)"""
    print("\n" + "="*70)
    print("[M3] CatBoost / RandomForest")
    print("="*70)

    try:
        from catboost import CatBoostClassifier

        start = time.time()

        X_tr, X_eval, y_tr, y_eval = train_test_split(
            X_train, y_train, test_size=0.2, random_state=42, stratify=y_train
        )

        model = CatBoostClassifier(
            iterations=500,
            learning_rate=0.05,
            depth=6,
            random_seed=42,
            verbose=False,
            early_stopping_rounds=50
        )
        model.fit(X_tr, y_tr, eval_set=(X_eval, y_eval), verbose=False)

        elapsed = time.time() - start
        model_name = 'M3 (CatBoost)'

    except ImportError:
        print("  [INFO] CatBoost 미설치, RandomForest 사용")
        from sklearn.ensemble import RandomForestClassifier

        start = time.time()
        model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
        model.fit(X_train, y_train)
        elapsed = time.time() - start
        model_name = 'M3 (RandomForest)'

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    # Train 성능
    y_train_prob = model.predict_proba(X_train)[:, 1]
    train_auc = roc_auc_score(y_train, y_train_prob)

    metrics = {
        'model': model_name,
        'train_auc': train_auc,
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

    print(f"  Train AUC: {train_auc:.4f}")
    print(f"  Test AUC:  {metrics['auc_roc']:.4f}")
    print(f"  Gap:       {train_auc - metrics['auc_roc']:.4f}")
    print(f"  CV AUC:    {metrics['cv_auc_mean']:.4f} ± {metrics['cv_auc_std']:.4f}")

    return metrics


def run_benchmark():
    """벤치마크 실행"""
    print("\n" + "="*70)
    print("M1 vs M2 vs M3 취향 추천 모델 벤치마크")
    print("(실제 데이터: 1,751곡, Hard Negative 포함)")
    print("="*70)

    # 데이터 로드
    df = load_data()

    # 피처 준비
    X, y = prepare_features(df)

    if X is None:
        print("[ERROR] 피처 준비 실패")
        return

    print(f"\n[DATA] 피처 shape: {X.shape}")
    print(f"[DATA] Positive: {sum(y)}, Negative: {len(y) - sum(y)}")

    # Train/Test 분할 (85:15, 보고서와 동일)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42, stratify=y
    )

    print(f"\n[SPLIT] Train: {len(X_train)} (Pos={sum(y_train)}, Neg={len(y_train)-sum(y_train)})")
    print(f"[SPLIT] Test:  {len(X_test)} (Pos={sum(y_test)}, Neg={len(y_test)-sum(y_test)})")

    results = []

    # M1 학습
    m1 = train_m1_gradientboosting(X_train, y_train, X_test, y_test)
    results.append(m1)

    # M2 학습
    m2 = train_m2_svm(X_train, y_train, X_test, y_test)
    results.append(m2)

    # M3 학습
    m3 = train_m3_catboost(X_train, y_train, X_test, y_test)
    results.append(m3)

    # 결과 출력
    print("\n" + "="*70)
    print("최종 성능 비교")
    print("="*70)

    print(f"\n{'Model':<25} {'Train AUC':>10} {'Test AUC':>10} {'Gap':>8} {'F1':>8} {'Precision':>10} {'Recall':>8}")
    print("-"*85)

    for r in results:
        gap = r['train_auc'] - r['auc_roc']
        print(f"{r['model']:<25} {r['train_auc']:>10.4f} {r['auc_roc']:>10.4f} {gap:>8.4f} {r['f1']:>8.4f} {r['precision']:>10.4f} {r['recall']:>8.4f}")

    print("-"*85)

    # CV 결과
    print(f"\n{'Model':<25} {'CV AUC Mean':>12} {'CV AUC Std':>12}")
    print("-"*55)

    for r in results:
        print(f"{r['model']:<25} {r['cv_auc_mean']:>12.4f} {r['cv_auc_std']:>12.4f}")

    # 순위
    print("\n" + "="*70)
    print("순위 (Test AUC 기준)")
    print("="*70)

    sorted_results = sorted(results, key=lambda x: x['auc_roc'], reverse=True)
    for i, r in enumerate(sorted_results, 1):
        gap = r['train_auc'] - r['auc_roc']
        overfit = "과적합 위험" if gap > 0.05 else "정상"
        print(f"  {i}위: {r['model']:<25} Test AUC={r['auc_roc']:.4f} (Gap={gap:.4f}, {overfit})")

    print("\n[완료] 벤치마크 종료")

    return results


if __name__ == "__main__":
    run_benchmark()
