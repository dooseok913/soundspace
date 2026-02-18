"""
MLflow 실험 결과 시각화
======================
PPT용 그래프 생성 (M1, M2, M3 색상 구분)

실행:
    cd D:\lecture\colab\final\integrated\FAST_API
    python mlflow_tracking/plot_results.py

출력:
    mlflow_tracking/charts/ 폴더에 PNG 파일 저장
"""

import os
import mlflow
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm

# 한글 폰트 설정
plt.rcParams['font.family'] = 'Malgun Gothic'
plt.rcParams['axes.unicode_minus'] = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 차트는 making-history3 폴더에 저장
CHARTS_DIR = r"D:\lecture\colab\final\making-history3\charts"
os.makedirs(CHARTS_DIR, exist_ok=True)

mlflow.set_tracking_uri(f"file:///{BASE_DIR}/mlruns")

# 색상 설정
COLORS = {
    'M1': '#FF6B6B',  # 빨강
    'M2': '#4ECDC4',  # 청록
    'M3': '#95E1D3',  # 연두
}

MARKERS = {
    'M1': 'o',
    'M2': 's',
    'M3': '^',
}


def get_experiment_data(experiment_name):
    """MLflow 실험 데이터 가져오기"""
    experiment = mlflow.get_experiment_by_name(experiment_name)
    if experiment is None:
        return pd.DataFrame()

    runs = mlflow.search_runs(experiment_ids=[experiment.experiment_id])
    return runs


def plot_original_comparison():
    """실험 1: 원본 모델 비교 막대 그래프"""
    print("📊 원본 모델 비교 그래프 생성 중...")

    df = get_experiment_data("1_Original_Model_Comparison")
    if df.empty:
        print("  ⚠️ 데이터 없음")
        return

    # 모델별 AUC 추출
    models = []
    aucs = []
    f1s = []

    for _, row in df.iterrows():
        model_type = row.get('tags.model_type', 'Unknown')
        auc = row.get('metrics.auc', 0)
        f1 = row.get('metrics.f1_score', 0)
        models.append(model_type)
        aucs.append(auc)
        f1s.append(f1)

    # 정렬
    data = sorted(zip(models, aucs, f1s), key=lambda x: x[0])
    models, aucs, f1s = zip(*data)

    fig, ax = plt.subplots(figsize=(10, 6))

    x = range(len(models))
    width = 0.35

    bars1 = ax.bar([i - width/2 for i in x], aucs, width,
                   label='AUC', color=[COLORS.get(m, 'gray') for m in models])
    bars2 = ax.bar([i + width/2 for i in x], f1s, width,
                   label='F1 Score', color=[COLORS.get(m, 'gray') for m in models], alpha=0.6)

    ax.set_xlabel('모델', fontsize=12)
    ax.set_ylabel('점수', fontsize=12)
    ax.set_title('M1 vs M2 vs M3 성능 비교 (원본 하이퍼파라미터)', fontsize=14, fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels([f'{m}\n({"9D Audio" if m=="M1" else "393D Text+Audio" if m=="M2" else "Categorical"})'
                        for m in models])
    ax.legend()
    ax.set_ylim(0, 1.1)

    # 값 표시
    for bar, val in zip(bars1, aucs):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02,
                f'{val:.3f}', ha='center', va='bottom', fontsize=10)

    plt.tight_layout()
    plt.savefig(os.path.join(CHARTS_DIR, '1_model_comparison.png'), dpi=150)
    plt.close()
    print("  ✅ 저장: charts/1_model_comparison.png")


def plot_hyperparameter_tuning():
    """실험 2: 하이퍼파라미터 튜닝 결과"""
    print("📊 하이퍼파라미터 튜닝 그래프 생성 중...")

    df = get_experiment_data("2_Hyperparameter_Tuning")
    if df.empty:
        print("  ⚠️ 데이터 없음")
        return

    fig, axes = plt.subplots(1, 3, figsize=(15, 5))

    for idx, model_type in enumerate(['M1', 'M2', 'M3']):
        ax = axes[idx]
        model_df = df[df['tags.model_type'] == model_type].copy()

        if model_df.empty:
            continue

        aucs = model_df['metrics.auc'].values
        run_names = [f"설정 {i+1}" for i in range(len(aucs))]

        bars = ax.bar(run_names, aucs, color=COLORS.get(model_type, 'gray'))
        ax.set_title(f'{model_type} 하이퍼파라미터 튜닝', fontsize=12, fontweight='bold')
        ax.set_ylabel('AUC')
        ax.set_ylim(0, 1.1)

        # 최고 성능 강조
        max_idx = aucs.argmax()
        bars[max_idx].set_color('gold')
        bars[max_idx].set_edgecolor('black')
        bars[max_idx].set_linewidth(2)

        for bar, val in zip(bars, aucs):
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02,
                    f'{val:.3f}', ha='center', va='bottom', fontsize=9)

    plt.suptitle('하이퍼파라미터 튜닝 결과 (금색 = 최고 성능)', fontsize=14, fontweight='bold')
    plt.tight_layout()
    plt.savefig(os.path.join(CHARTS_DIR, '2_hyperparameter_tuning.png'), dpi=150)
    plt.close()
    print("  ✅ 저장: charts/2_hyperparameter_tuning.png")


def plot_learning_curve():
    """실험 3: Learning Curve (PMS 곡 수 vs 성능)"""
    print("📊 Learning Curve 그래프 생성 중...")

    df = get_experiment_data("3_Learning_Curve")
    if df.empty:
        print("  ⚠️ 데이터 없음")
        return

    fig, ax = plt.subplots(figsize=(12, 7))

    for model_type in ['M1', 'M2', 'M3']:
        model_df = df[df['tags.model_type'] == model_type].copy()

        if model_df.empty:
            continue

        # pms_size를 숫자로 변환 후 정렬 (문자열 정렬 방지)
        model_df['pms_size_int'] = model_df['params.pms_size'].astype(int)
        model_df = model_df.sort_values('pms_size_int')
        pms_sizes = model_df['pms_size_int'].values
        aucs = model_df['metrics.auc'].values

        ax.plot(pms_sizes, aucs,
                marker=MARKERS.get(model_type, 'o'),
                markersize=10,
                linewidth=2,
                color=COLORS.get(model_type, 'gray'),
                label=f'{model_type} ({"9D Audio" if model_type=="M1" else "393D Text+Audio" if model_type=="M2" else "Categorical"})')

    ax.set_xlabel('PMS 곡 수 (사용자가 등록한 곡)', fontsize=12)
    ax.set_ylabel('AUC', fontsize=12)
    ax.set_title('Learning Curve: PMS 곡 수에 따른 모델 성능 변화', fontsize=14, fontweight='bold')
    ax.legend(loc='lower right', fontsize=10)
    ax.grid(True, alpha=0.3)
    ax.set_ylim(0.4, 1.05)

    # 주요 포인트 표시
    ax.axhline(y=0.8, color='green', linestyle='--', alpha=0.5, label='AUC 0.8 기준선')
    ax.text(520, 0.81, 'AUC 0.8', fontsize=9, color='green')

    plt.tight_layout()
    plt.savefig(os.path.join(CHARTS_DIR, '3_learning_curve.png'), dpi=150)
    plt.close()
    print("  ✅ 저장: charts/3_learning_curve.png")


def plot_m1_vs_m2_only():
    """M1 vs M2 비교 (M3 제외 - 공정한 비교)"""
    print("📊 M1 vs M2 비교 그래프 생성 중...")

    df = get_experiment_data("3_Learning_Curve")
    if df.empty:
        print("  ⚠️ 데이터 없음")
        return

    fig, ax = plt.subplots(figsize=(12, 7))

    for model_type in ['M1', 'M2']:
        model_df = df[df['tags.model_type'] == model_type].copy()

        if model_df.empty:
            continue

        # pms_size를 숫자로 변환 후 정렬
        model_df['pms_size_int'] = model_df['params.pms_size'].astype(int)
        model_df = model_df.sort_values('pms_size_int')
        pms_sizes = model_df['pms_size_int'].values
        aucs = model_df['metrics.auc'].values

        ax.plot(pms_sizes, aucs,
                marker=MARKERS.get(model_type, 'o'),
                markersize=12,
                linewidth=3,
                color=COLORS.get(model_type, 'gray'),
                label=f'{model_type} ({"9D Audio Features" if model_type=="M1" else "393D Text Embedding + Audio"})')

    ax.set_xlabel('PMS 곡 수 (사용자가 등록한 곡)', fontsize=12)
    ax.set_ylabel('AUC', fontsize=12)
    ax.set_title('M1 vs M2 성능 비교: 텍스트 임베딩의 효과', fontsize=14, fontweight='bold')
    ax.legend(loc='lower right', fontsize=11)
    ax.grid(True, alpha=0.3)
    ax.set_ylim(0.4, 0.9)

    # 분석 텍스트
    ax.annotate('M2가 M1보다 일관되게 높은 성능\n→ 텍스트 임베딩의 효과',
                xy=(300, 0.8), fontsize=10,
                bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

    plt.tight_layout()
    plt.savefig(os.path.join(CHARTS_DIR, '4_m1_vs_m2_comparison.png'), dpi=150)
    plt.close()
    print("  ✅ 저장: charts/4_m1_vs_m2_comparison.png")


def plot_summary_table():
    """요약 테이블 이미지"""
    print("📊 요약 테이블 생성 중...")

    df = get_experiment_data("1_Original_Model_Comparison")
    if df.empty:
        print("  ⚠️ 데이터 없음")
        return

    # 테이블 데이터 준비
    table_data = []
    for _, row in df.iterrows():
        model = row.get('tags.model_type', '')
        table_data.append({
            '모델': model,
            '피처': '9D Audio' if model == 'M1' else '393D (Text+Audio)' if model == 'M2' else 'Categorical',
            'AUC': f"{row.get('metrics.auc', 0):.4f}",
            'F1': f"{row.get('metrics.f1_score', 0):.4f}",
            'Precision': f"{row.get('metrics.precision', 0):.4f}",
            'Recall': f"{row.get('metrics.recall', 0):.4f}",
        })

    table_df = pd.DataFrame(table_data).sort_values('모델')

    fig, ax = plt.subplots(figsize=(10, 4))
    ax.axis('tight')
    ax.axis('off')

    table = ax.table(
        cellText=table_df.values,
        colLabels=table_df.columns,
        cellLoc='center',
        loc='center',
        colColours=['#4ECDC4']*len(table_df.columns)
    )
    table.auto_set_font_size(False)
    table.set_fontsize(11)
    table.scale(1.2, 1.8)

    plt.title('모델 성능 비교 요약', fontsize=14, fontweight='bold', pad=20)
    plt.tight_layout()
    plt.savefig(os.path.join(CHARTS_DIR, '5_summary_table.png'), dpi=150, bbox_inches='tight')
    plt.close()
    print("  ✅ 저장: charts/5_summary_table.png")


def main():
    print("=" * 50)
    print("MLflow 결과 시각화")
    print("=" * 50)

    plot_original_comparison()
    plot_hyperparameter_tuning()
    plot_learning_curve()
    plot_m1_vs_m2_only()
    plot_summary_table()

    print("\n" + "=" * 50)
    print(f"✅ 모든 그래프 저장 완료!")
    print(f"📁 위치: {CHARTS_DIR}")
    print("=" * 50)


if __name__ == "__main__":
    main()
