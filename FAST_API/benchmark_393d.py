# -*- coding: utf-8 -*-
"""
M1 vs M2 vs M3 취향 추천 모델 벤치마크 (393D 피처)
- 384D 텍스트 임베딩 (all-MiniLM-L6-v2) + 9D 오디오
- model-check/data/full_dataset.csv 사용 (1,751곡)
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
    precision_score, recall_score, accuracy_score,
    roc_auc_score, f1_score
)
from sklearn.preprocessing import StandardScaler
import warnings
import time
warnings.filterwarnings('ignore')

# 데이터 경로
DATA_PATH = "D:/lecture/colab/final/model-check/data/full_dataset.csv"
AUDIO_PATH = "D:/lecture/colab/final/model-check/data/predicted_audio_features.csv"

AUDIO_FEATURES = [
    'danceability', 'energy', 'speechiness', 'acousticness',
    'instrumentalness', 'liveness', 'valence', 'tempo', 'loudness'
]


def load_and_prepare_data():
    """데이터 로드 및 393D 피처 생성"""
    print("\n" + "="*70)
    print("[DATA] 데이터 로드 및 393D 피처 생성")
    print("="*70)

    # 메인 데이터
    df = pd.read_csv(DATA_PATH, encoding='utf-8-sig')
    print(f"[DATA] {len(df)}곡 로드")
    print(f"[DATA] Positive: {sum(df['label']==1)}, Negative: {sum(df['label']==0)}")

    # 오디오 피처
    if os.path.exists(AUDIO_PATH):
        audio_df = pd.read_csv(AUDIO_PATH)
        for col in AUDIO_FEATURES:
            if col in audio_df.columns:
                df[col] = audio_df[col].values

    # 결측 오디오 피처 채우기
    for col in AUDIO_FEATURES:
        if col not in df.columns:
            df[col] = 0.5
        else:
            df[col] = df[col].fillna(0.5)

    # 텍스트 임베딩 생성
    print("\n[EMBED] 텍스트 임베딩 생성 중...")
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer('all-MiniLM-L6-v2')

    texts = []
    for _, row in df.iterrows():
        parts = []
        for col in ['artist', 'trackTitle', 'album', 'combined_tags']:
            if col in row and pd.notna(row[col]) and str(row[col]).strip():
                parts.append(str(row[col]))
        text = ' '.join(parts) if parts else 'unknown'
        texts.append(text)

    print(f"[EMBED] {len(texts)}개 텍스트 임베딩 생성...")
    embeddings = model.encode(texts, show_progress_bar=True)
    print(f"[EMBED] 임베딩 shape: {embeddings.shape}")

    # 오디오 피처 배열
    audio_array = df[AUDIO_FEATURES].values

    # 393D = 384D + 9D
    X = np.hstack([embeddings, audio_array])
    y = df['label'].values

    print(f"\n[FEATURE] 최종 피처: {X.shape} (384D 텍스트 + 9D 오디오)")

    return X, y, df


def train_m1(X_train, y_train, X_test, y_test):
    """M1 GradientBoosting"""
    print("\n" + "="*70)
    print("[M1] GradientBoosting (393D)")
    print("="*70)

    from sklearn.ensemble import GradientBoostingClassifier

    start = time.time()

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    model = GradientBoostingClassifier(n_estimators=100, max_depth=3, random_state=42)
    model.fit(X_train_s, y_train)

    elapsed = time.time() - start

    y_pred = model.predict(X_test_s)
    y_prob = model.predict_proba(X_test_s)[:, 1]
    y_train_prob = model.predict_proba(X_train_s)[:, 1]

    train_auc = roc_auc_score(y_train, y_train_prob)
    test_auc = roc_auc_score(y_test, y_prob)

    cv = cross_val_score(model, X_train_s, y_train, cv=5, scoring='roc_auc')

    print(f"  Train AUC: {train_auc:.4f}")
    print(f"  Test AUC:  {test_auc:.4f}")
    print(f"  Gap:       {train_auc - test_auc:.4f}")
    print(f"  CV AUC:    {cv.mean():.4f} ± {cv.std():.4f}")

    return {
        'model': 'M1 (GradientBoosting)',
        'train_auc': train_auc,
        'test_auc': test_auc,
        'cv_mean': cv.mean(),
        'cv_std': cv.std(),
        'accuracy': accuracy_score(y_test, y_pred),
        'precision': precision_score(y_test, y_pred),
        'recall': recall_score(y_test, y_pred),
        'f1': f1_score(y_test, y_pred),
        'time': elapsed
    }


def train_m2(X_train, y_train, X_test, y_test):
    """M2 SVM (보고서와 동일 설정: C=10, RBF, gamma=scale)"""
    print("\n" + "="*70)
    print("[M2] SVM (393D, C=10, RBF)")
    print("="*70)

    from sklearn.svm import SVC

    start = time.time()

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    model = SVC(kernel='rbf', C=10, gamma='scale', probability=True, random_state=42)
    model.fit(X_train_s, y_train)

    elapsed = time.time() - start

    y_pred = model.predict(X_test_s)
    y_prob = model.predict_proba(X_test_s)[:, 1]
    y_train_prob = model.predict_proba(X_train_s)[:, 1]

    train_auc = roc_auc_score(y_train, y_train_prob)
    test_auc = roc_auc_score(y_test, y_prob)

    cv = cross_val_score(model, X_train_s, y_train, cv=5, scoring='roc_auc')

    print(f"  Train AUC: {train_auc:.4f}")
    print(f"  Test AUC:  {test_auc:.4f}")
    print(f"  Gap:       {train_auc - test_auc:.4f}")
    print(f"  CV AUC:    {cv.mean():.4f} ± {cv.std():.4f}")

    return {
        'model': 'M2 (SVM)',
        'train_auc': train_auc,
        'test_auc': test_auc,
        'cv_mean': cv.mean(),
        'cv_std': cv.std(),
        'accuracy': accuracy_score(y_test, y_pred),
        'precision': precision_score(y_test, y_pred),
        'recall': recall_score(y_test, y_pred),
        'f1': f1_score(y_test, y_pred),
        'time': elapsed
    }


def train_m3(X_train, y_train, X_test, y_test):
    """M3 CatBoost/RandomForest"""
    print("\n" + "="*70)
    print("[M3] CatBoost/RandomForest (393D)")
    print("="*70)

    try:
        from catboost import CatBoostClassifier
        start = time.time()

        X_tr, X_val, y_tr, y_val = train_test_split(X_train, y_train, test_size=0.2, random_state=42)

        model = CatBoostClassifier(
            iterations=500, learning_rate=0.05, depth=6,
            random_seed=42, verbose=False, early_stopping_rounds=50
        )
        model.fit(X_tr, y_tr, eval_set=(X_val, y_val), verbose=False)
        model_name = 'M3 (CatBoost)'
        elapsed = time.time() - start

    except ImportError:
        print("  CatBoost 미설치, RandomForest 사용")
        from sklearn.ensemble import RandomForestClassifier
        start = time.time()
        model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
        model.fit(X_train, y_train)
        model_name = 'M3 (RandomForest)'
        elapsed = time.time() - start

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    y_train_prob = model.predict_proba(X_train)[:, 1]

    train_auc = roc_auc_score(y_train, y_train_prob)
    test_auc = roc_auc_score(y_test, y_prob)

    cv = cross_val_score(model, X_train, y_train, cv=5, scoring='roc_auc')

    print(f"  Train AUC: {train_auc:.4f}")
    print(f"  Test AUC:  {test_auc:.4f}")
    print(f"  Gap:       {train_auc - test_auc:.4f}")
    print(f"  CV AUC:    {cv.mean():.4f} ± {cv.std():.4f}")

    return {
        'model': model_name,
        'train_auc': train_auc,
        'test_auc': test_auc,
        'cv_mean': cv.mean(),
        'cv_std': cv.std(),
        'accuracy': accuracy_score(y_test, y_pred),
        'precision': precision_score(y_test, y_pred),
        'recall': recall_score(y_test, y_pred),
        'f1': f1_score(y_test, y_pred),
        'time': elapsed
    }


def main():
    print("\n" + "="*70)
    print("M1 vs M2 vs M3 취향 추천 모델 벤치마크")
    print("(393D 피처: 384D 텍스트 + 9D 오디오)")
    print("="*70)

    # 데이터 준비
    X, y, df = load_and_prepare_data()

    # Train/Test 분할 (85:15)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42, stratify=y
    )

    print(f"\n[SPLIT] Train: {len(X_train)} (Pos={sum(y_train)})")
    print(f"[SPLIT] Test:  {len(X_test)} (Pos={sum(y_test)})")

    results = []

    # M1
    results.append(train_m1(X_train, y_train, X_test, y_test))

    # M2
    results.append(train_m2(X_train, y_train, X_test, y_test))

    # M3
    results.append(train_m3(X_train, y_train, X_test, y_test))

    # 결과 출력
    print("\n" + "="*70)
    print("최종 성능 비교 (393D 피처)")
    print("="*70)

    print(f"\n{'Model':<25} {'Train AUC':>10} {'Test AUC':>10} {'CV AUC':>12} {'Gap':>8} {'F1':>8}")
    print("-"*80)

    for r in results:
        gap = r['train_auc'] - r['test_auc']
        cv_str = f"{r['cv_mean']:.4f}±{r['cv_std']:.3f}"
        print(f"{r['model']:<25} {r['train_auc']:>10.4f} {r['test_auc']:>10.4f} {cv_str:>12} {gap:>8.4f} {r['f1']:>8.4f}")

    print("-"*80)

    # 순위
    print("\n[순위 - Test AUC 기준]")
    sorted_r = sorted(results, key=lambda x: x['test_auc'], reverse=True)
    for i, r in enumerate(sorted_r, 1):
        gap = r['train_auc'] - r['test_auc']
        status = "과적합" if gap > 0.05 else "정상"
        print(f"  {i}위: {r['model']:<25} AUC={r['test_auc']:.4f} (Gap={gap:.4f}, {status})")

    # 보고서 비교
    print("\n" + "="*70)
    print("보고서 결과와 비교")
    print("="*70)
    print("보고서 M2 SVM (393D): CV AUC=0.9987, Test AUC=0.9995")
    m2_result = next((r for r in results if 'SVM' in r['model']), None)
    if m2_result:
        print(f"현재 M2 SVM (393D): CV AUC={m2_result['cv_mean']:.4f}, Test AUC={m2_result['test_auc']:.4f}")

    print("\n[완료]")


if __name__ == "__main__":
    main()
