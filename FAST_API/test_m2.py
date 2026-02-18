import sys
import asyncio
sys.path.insert(0, '.')
from M2.m2 import LastFmService, AudioPredictionService

async def main():
    print("=== M2 모델 테스트 ===\n")

    # CSV 연결 테스트
    lastfm = LastFmService()

    # CSV 데이터 로드 확인
    if lastfm.csv_data is not None:
        print(f"CSV 데이터 로드 완료: {len(lastfm.csv_data)}개 아티스트")
    else:
        print("CSV 데이터 로드 실패!")
        return

    # CSV에서 태그 가져오기 (get_tags_from_csv 사용)
    tags_str = lastfm.get_tags_from_csv('Taylor Swift')
    print(f'Taylor Swift 태그: {tags_str[:100] if tags_str else "없음"}...')

    # 오디오 예측 테스트
    audio = AudioPredictionService()
    audio.load_model()

    # 태그 있을 때 (predict_single 사용)
    result1 = audio.predict_single(
        artist='Taylor Swift',
        track_name='Shake It Off',
        tags=tags_str or ''
    )
    print(f'\n태그 O: danceability={result1["danceability"]:.4f}, energy={result1["energy"]:.4f}')

    # 태그 없을 때
    result2 = audio.predict_single(
        artist='Taylor Swift',
        track_name='Shake It Off',
        tags=''
    )
    print(f'태그 X: danceability={result2["danceability"]:.4f}, energy={result2["energy"]:.4f}')

    print("\n=== 이전 테스트 결과 (참고) ===")
    print("태그 X: energy=0.6099, danceability=0.5869")
    print("태그 O: energy=0.6586, danceability=0.6251")

    # 결과 비교
    print("\n=== 결과 비교 ===")
    energy_diff = result1["energy"] - result2["energy"]
    dance_diff = result1["danceability"] - result2["danceability"]
    print(f"태그로 인한 energy 차이: {energy_diff:+.4f}")
    print(f"태그로 인한 danceability 차이: {dance_diff:+.4f}")

    if abs(energy_diff) > 0.01 or abs(dance_diff) > 0.01:
        print("\n태그가 오디오 피처 예측에 영향을 미치고 있습니다!")
    else:
        print("\n태그 영향이 미미합니다.")

asyncio.run(main())
