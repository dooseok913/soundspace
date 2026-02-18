"""
MLflow 실험 추적: M1, M2, M3 음악 추천 모델 비교
================================================

3가지 실험 시나리오:
1. 원본 비교: 팀원들이 설계한 하이퍼파라미터로 M1 vs M2 vs M3 비교
2. 하이퍼파라미터 튜닝: 각 모델의 최적 파라미터 탐색
3. Learning Curve: PMS 곡 수 증가에 따른 성능 변화

실행 방법:
    cd D:\lecture\colab\final\integrated\FAST_API
    python mlflow_tracking/run_all_experiments.py

MLflow UI 확인:
    cd D:\lecture\colab\final\integrated\FAST_API\mlflow_tracking
    mlflow ui --port 5000
    브라우저에서 http://localhost:5000 접속
"""

import os
import warnings
warnings.filterwarnings('ignore')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FAST_API_DIR = os.path.dirname(BASE_DIR)
DATA_PATH = os.path.join(FAST_API_DIR, "data", "spotify_114k_with_tags.csv")

import mlflow
import mlflow.sklearn
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.svm import SVC

try:
    from catboost import CatBoostClassifier
    HAS_CATBOOST = True
except ImportError:
    HAS_CATBOOST = False
    print("⚠️ CatBoost 미설치 (pip install catboost)")

try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
    ST_MODEL = None  # 전역 캐시
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False
    ST_MODEL = None
    print("⚠️ sentence-transformers 미설치 (pip install sentence-transformers)")

# ============================================================
# 팀원들이 정한 원본 하이퍼파라미터
# ============================================================
ORIGINAL_PARAMS = {
    'M1': {'n_estimators': 100, 'max_depth': 5, 'learning_rate': 0.1},
    'M2': {'kernel': 'rbf', 'C': 10, 'gamma': 'scale'},
    'M3': {'iterations': 200, 'depth': 6, 'learning_rate': 0.1},
}

mlflow.set_tracking_uri(f"file:///{BASE_DIR}/mlruns")


def get_st_model():
    """SentenceTransformer 모델 캐싱"""
    global ST_MODEL
    if ST_MODEL is None and HAS_SENTENCE_TRANSFORMERS:
        print("  SentenceTransformer 로드 중...")
        ST_MODEL = SentenceTransformer('all-MiniLM-L6-v2')
    return ST_MODEL


def load_full_data():
    """전체 데이터 로드 및 전처리"""
    df = pd.read_csv(DATA_PATH)

    df['lfm_artist_tags'] = df['lfm_artist_tags'].fillna('')
    df['track_genre'] = df['track_genre'].fillna('unknown')
    df['artists'] = df['artists'].fillna('Unknown')
    df['album_name'] = df['album_name'].fillna('')
    df['track_name'] = df['track_name'].fillna('')

    audio_cols = ['danceability', 'energy', 'valence', 'acousticness',
                  'instrumentalness', 'liveness', 'speechiness', 'tempo', 'loudness']
    for col in audio_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(df[col].median())

    return df


def create_dataset(df, n_positive=500, neg_ratio=3, random_state=42):
    """
    사용자 취향 시뮬레이션 데이터셋 생성

    Args:
        n_positive: Positive 샘플 수 (PMS 곡 수)
        neg_ratio: Negative 비율 (1:neg_ratio)
    """
    preferred_genres = ['jazz', 'acoustic', 'classical', 'piano']

    # Positive
    positive_mask = df['track_genre'].str.lower().isin(preferred_genres)
    positive_pool = df[positive_mask]

    if len(positive_pool) < n_positive:
        positive_df = positive_pool.copy()
    else:
        positive_df = positive_pool.sample(n=n_positive, random_state=random_state).copy()

    # Hard Negative (같은 아티스트의 다른 장르)
    positive_artists = positive_df['artists'].unique()
    hard_neg_pool = df[
        (df['artists'].isin(positive_artists)) &
        (~df['track_genre'].str.lower().isin(preferred_genres))
    ]

    hard_neg_count = min(len(hard_neg_pool), len(positive_df))
    negative_samples = []

    if hard_neg_count > 0:
        hard_negatives = hard_neg_pool.sample(n=hard_neg_count, random_state=random_state).copy()
        hard_negatives['neg_type'] = 'hard_similar'
        negative_samples.append(hard_negatives)

    # Random Negative
    random_neg_pool = df[~positive_mask & ~df['artists'].isin(positive_artists)]
    random_neg_count = len(positive_df) * neg_ratio - hard_neg_count

    if random_neg_count > 0 and len(random_neg_pool) > 0:
        actual_count = min(random_neg_count, len(random_neg_pool))
        random_negatives = random_neg_pool.sample(n=actual_count, random_state=random_state).copy()
        random_negatives['neg_type'] = 'random'
        negative_samples.append(random_negatives)

    # 결합
    positive_df['label'] = 1
    positive_df['neg_type'] = 'positive'

    negative_df = pd.concat(negative_samples, ignore_index=True) if negative_samples else pd.DataFrame()
    negative_df['label'] = 0

    final_df = pd.concat([positive_df, negative_df], ignore_index=True)
    return final_df.sample(frac=1, random_state=random_state).reset_index(drop=True)


def calculate_metrics(y_true, y_pred, y_prob=None):
    metrics = {
        'accuracy': accuracy_score(y_true, y_pred),
        'precision': precision_score(y_true, y_pred, zero_division=0),
        'recall': recall_score(y_true, y_pred, zero_division=0),
        'f1_score': f1_score(y_true, y_pred, zero_division=0),
    }
    if y_prob is not None:
        try:
            metrics['auc'] = roc_auc_score(y_true, y_prob)
        except:
            metrics['auc'] = 0.0
    return metrics


def prepare_m1_features(df):
    """M1: 9D Audio Features"""
    audio_cols = ['danceability', 'energy', 'valence', 'acousticness',
                  'instrumentalness', 'liveness', 'speechiness', 'tempo', 'loudness']
    return df[audio_cols].values, df['label'].values


def prepare_m2_features(df):
    """M2: 393D (384D Text + 9D Audio)"""
    if not HAS_SENTENCE_TRANSFORMERS:
        return None, None

    st_model = get_st_model()

    texts = []
    for _, row in df.iterrows():
        text = f"{row['artists']} {row['track_name']}"
        if row['album_name']:
            text += f" {row['album_name']}"
        if row['lfm_artist_tags']:
            text += f" {row['lfm_artist_tags'].replace(',', ' ')}"
        texts.append(text)

    embeddings = st_model.encode(texts, show_progress_bar=False)

    audio_cols = ['danceability', 'energy', 'valence', 'acousticness',
                  'instrumentalness', 'liveness', 'speechiness', 'tempo', 'loudness']
    audio_features = df[audio_cols].values

    scaler = StandardScaler()
    audio_scaled = scaler.fit_transform(audio_features)

    X = np.hstack([embeddings, audio_scaled])
    return X, df['label'].values


def prepare_m3_features(df):
    """M3: Categorical Features"""
    cat_cols = ['artists', 'album_name', 'track_genre']
    X = df[cat_cols].copy()
    for col in cat_cols:
        X[col] = X[col].astype(str)
    return X, df['label'].values


def train_and_evaluate(model_type, X_train, X_test, y_train, y_test, params, cat_features=None):
    """모델 학습 및 평가"""
    if model_type == 'M1':
        model = Pipeline([
            ('scaler', StandardScaler()),
            ('clf', GradientBoostingClassifier(**params, random_state=42))
        ])
    elif model_type == 'M2':
        model = Pipeline([
            ('scaler', StandardScaler()),
            ('svm', SVC(**params, probability=True, random_state=42))
        ])
    elif model_type == 'M3':
        model = CatBoostClassifier(**params, cat_features=cat_features, random_state=42, verbose=False)

    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    return model, calculate_metrics(y_test, y_pred, y_prob)


# ============================================================
# 실험 1: 원본 하이퍼파라미터 비교
# ============================================================
def run_original_comparison(df):
    """팀원들이 설계한 원본 하이퍼파라미터로 M1 vs M2 vs M3 비교"""
    mlflow.set_experiment("1_Original_Model_Comparison")

    print("\n" + "=" * 60)
    print("실험 1: 원본 하이퍼파라미터 비교 (팀원 설계)")
    print("=" * 60)

    dataset = create_dataset(df, n_positive=500)
    print(f"데이터: Positive {(dataset['label']==1).sum()}, Negative {(dataset['label']==0).sum()}")

    # M1
    print("\n[M1] GradientBoosting + 9D Audio")
    X, y = prepare_m1_features(dataset)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    with mlflow.start_run(run_name="M1_Original"):
        mlflow.set_tag("model_type", "M1")
        mlflow.set_tag("experiment_type", "original_comparison")
        mlflow.log_params(ORIGINAL_PARAMS['M1'])
        mlflow.log_param("feature_dim", 9)

        model, metrics = train_and_evaluate('M1', X_train, X_test, y_train, y_test, ORIGINAL_PARAMS['M1'])
        mlflow.log_metrics(metrics)
        mlflow.sklearn.log_model(model, "model")
        print(f"  → AUC: {metrics['auc']:.4f}, F1: {metrics['f1_score']:.4f}")

    # M2
    if HAS_SENTENCE_TRANSFORMERS:
        print("\n[M2] SVM + 393D (Text + Audio)")
        X, y = prepare_m2_features(dataset)
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        with mlflow.start_run(run_name="M2_Original"):
            mlflow.set_tag("model_type", "M2")
            mlflow.set_tag("experiment_type", "original_comparison")
            mlflow.log_params(ORIGINAL_PARAMS['M2'])
            mlflow.log_param("feature_dim", 393)

            model, metrics = train_and_evaluate('M2', X_train, X_test, y_train, y_test, ORIGINAL_PARAMS['M2'])
            mlflow.log_metrics(metrics)
            mlflow.sklearn.log_model(model, "model")
            print(f"  → AUC: {metrics['auc']:.4f}, F1: {metrics['f1_score']:.4f}")

    # M3
    if HAS_CATBOOST:
        print("\n[M3] CatBoost + Categorical")
        X, y = prepare_m3_features(dataset)
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        with mlflow.start_run(run_name="M3_Original"):
            mlflow.set_tag("model_type", "M3")
            mlflow.set_tag("experiment_type", "original_comparison")
            mlflow.log_params(ORIGINAL_PARAMS['M3'])
            mlflow.log_param("feature_dim", 3)

            model, metrics = train_and_evaluate('M3', X_train, X_test, y_train, y_test,
                                                ORIGINAL_PARAMS['M3'], cat_features=[0,1,2])
            mlflow.log_metrics(metrics)
            mlflow.catboost.log_model(model, "model")
            print(f"  → AUC: {metrics['auc']:.4f}, F1: {metrics['f1_score']:.4f}")


# ============================================================
# 실험 2: 하이퍼파라미터 튜닝
# ============================================================
def run_hyperparameter_tuning(df):
    """각 모델의 최적 하이퍼파라미터 탐색"""
    mlflow.set_experiment("2_Hyperparameter_Tuning")

    print("\n" + "=" * 60)
    print("실험 2: 하이퍼파라미터 튜닝")
    print("=" * 60)

    dataset = create_dataset(df, n_positive=500)

    # M1 튜닝
    print("\n[M1] 하이퍼파라미터 튜닝")
    X, y = prepare_m1_features(dataset)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    m1_params = [
        {'n_estimators': 100, 'max_depth': 3, 'learning_rate': 0.1},
        {'n_estimators': 100, 'max_depth': 5, 'learning_rate': 0.1},
        {'n_estimators': 200, 'max_depth': 5, 'learning_rate': 0.05},
        {'n_estimators': 150, 'max_depth': 4, 'learning_rate': 0.08},
    ]

    for i, params in enumerate(m1_params):
        with mlflow.start_run(run_name=f"M1_tuning_{i+1}"):
            mlflow.set_tag("model_type", "M1")
            mlflow.set_tag("experiment_type", "hyperparameter_tuning")
            mlflow.log_params(params)

            model, metrics = train_and_evaluate('M1', X_train, X_test, y_train, y_test, params)
            mlflow.log_metrics(metrics)
            print(f"  {params} → AUC: {metrics['auc']:.4f}")

    # M2 튜닝
    if HAS_SENTENCE_TRANSFORMERS:
        print("\n[M2] 하이퍼파라미터 튜닝")
        X, y = prepare_m2_features(dataset)
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        m2_params = [
            {'kernel': 'rbf', 'C': 1, 'gamma': 'scale'},
            {'kernel': 'rbf', 'C': 10, 'gamma': 'scale'},
            {'kernel': 'rbf', 'C': 100, 'gamma': 'scale'},
            {'kernel': 'rbf', 'C': 10, 'gamma': 'auto'},
        ]

        for i, params in enumerate(m2_params):
            with mlflow.start_run(run_name=f"M2_tuning_{i+1}"):
                mlflow.set_tag("model_type", "M2")
                mlflow.set_tag("experiment_type", "hyperparameter_tuning")
                mlflow.log_params(params)

                model, metrics = train_and_evaluate('M2', X_train, X_test, y_train, y_test, params)
                mlflow.log_metrics(metrics)
                print(f"  {params} → AUC: {metrics['auc']:.4f}")

    # M3 튜닝
    if HAS_CATBOOST:
        print("\n[M3] 하이퍼파라미터 튜닝")
        X, y = prepare_m3_features(dataset)
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        m3_params = [
            {'iterations': 100, 'depth': 4, 'learning_rate': 0.1},
            {'iterations': 200, 'depth': 6, 'learning_rate': 0.1},
            {'iterations': 100, 'depth': 6, 'learning_rate': 0.05},
            {'iterations': 150, 'depth': 5, 'learning_rate': 0.08},
        ]

        for i, params in enumerate(m3_params):
            with mlflow.start_run(run_name=f"M3_tuning_{i+1}"):
                mlflow.set_tag("model_type", "M3")
                mlflow.set_tag("experiment_type", "hyperparameter_tuning")
                mlflow.log_params(params)

                model, metrics = train_and_evaluate('M3', X_train, X_test, y_train, y_test,
                                                    params, cat_features=[0,1,2])
                mlflow.log_metrics(metrics)
                print(f"  {params} → AUC: {metrics['auc']:.4f}")


# ============================================================
# 실험 3: Learning Curve (PMS 곡 수 증가에 따른 성능 변화)
# ============================================================
def run_learning_curve(df):
    """PMS 곡 수가 증가할 때 성능이 어떻게 변하는지"""
    mlflow.set_experiment("3_Learning_Curve")

    print("\n" + "=" * 60)
    print("실험 3: Learning Curve (PMS 곡 수 vs 성능)")
    print("=" * 60)

    # PMS 곡 수 단계별 증가
    pms_sizes = [50, 100, 150, 200, 300, 400, 500]

    for n_positive in pms_sizes:
        print(f"\n[PMS {n_positive}곡]")
        dataset = create_dataset(df, n_positive=n_positive)

        # M1
        X, y = prepare_m1_features(dataset)
        if len(np.unique(y)) < 2:
            continue
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        with mlflow.start_run(run_name=f"M1_pms{n_positive}"):
            mlflow.set_tag("model_type", "M1")
            mlflow.set_tag("experiment_type", "learning_curve")
            mlflow.log_param("pms_size", n_positive)
            mlflow.log_param("total_samples", len(dataset))
            mlflow.log_params(ORIGINAL_PARAMS['M1'])

            model, metrics = train_and_evaluate('M1', X_train, X_test, y_train, y_test, ORIGINAL_PARAMS['M1'])
            mlflow.log_metrics(metrics)
            print(f"  M1: AUC={metrics['auc']:.4f}")

        # M2
        if HAS_SENTENCE_TRANSFORMERS:
            X, y = prepare_m2_features(dataset)
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

            with mlflow.start_run(run_name=f"M2_pms{n_positive}"):
                mlflow.set_tag("model_type", "M2")
                mlflow.set_tag("experiment_type", "learning_curve")
                mlflow.log_param("pms_size", n_positive)
                mlflow.log_param("total_samples", len(dataset))
                mlflow.log_params(ORIGINAL_PARAMS['M2'])

                model, metrics = train_and_evaluate('M2', X_train, X_test, y_train, y_test, ORIGINAL_PARAMS['M2'])
                mlflow.log_metrics(metrics)
                print(f"  M2: AUC={metrics['auc']:.4f}")

        # M3
        if HAS_CATBOOST:
            X, y = prepare_m3_features(dataset)
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

            with mlflow.start_run(run_name=f"M3_pms{n_positive}"):
                mlflow.set_tag("model_type", "M3")
                mlflow.set_tag("experiment_type", "learning_curve")
                mlflow.log_param("pms_size", n_positive)
                mlflow.log_param("total_samples", len(dataset))
                mlflow.log_params(ORIGINAL_PARAMS['M3'])

                model, metrics = train_and_evaluate('M3', X_train, X_test, y_train, y_test,
                                                    ORIGINAL_PARAMS['M3'], cat_features=[0,1,2])
                mlflow.log_metrics(metrics)
                print(f"  M3: AUC={metrics['auc']:.4f}")


def main():
    print("=" * 60)
    print("MLflow 실험 추적 시작")
    print("=" * 60)

    # 데이터 로드
    print("\n데이터 로드 중...")
    df = load_full_data()
    print(f"전체 데이터: {len(df):,}곡")

    # 실험 1: 원본 비교
    run_original_comparison(df)

    # 실험 2: 하이퍼파라미터 튜닝
    run_hyperparameter_tuning(df)

    # 실험 3: Learning Curve
    run_learning_curve(df)

    print("\n" + "=" * 60)
    print("모든 실험 완료!")
    print("=" * 60)
    print("\nMLflow UI 실행:")
    print(f"  cd {BASE_DIR}")
    print("  mlflow ui --port 5000")
    print("  → http://localhost:5000")
    print("=" * 60)


if __name__ == "__main__":
    main()
