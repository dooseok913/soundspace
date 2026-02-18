# -*- coding: utf-8 -*-
"""
M1, M2, M3 모델 비교 테스트
"""
import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8000"

TEST_TRACKS = [
    {"artist": "Taylor Swift", "track_name": "Shake It Off", "album_name": "1989"},
    {"artist": "Ed Sheeran", "track_name": "Shape of You"},
    {"artist": "The Weeknd", "track_name": "Blinding Lights"},
    {"artist": "Adele", "track_name": "Hello"},
    {"artist": "BTS", "track_name": "Dynamite"},
]

def test_m2_predict(track):
    """M2 오디오 피처 예측"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/m2/predict",
            params={"user_id": 1},
            json={
                "artist": track["artist"],
                "track_name": track["track_name"],
                "album_name": track.get("album_name", ""),
                "tags": "",
                "duration_ms": 200000
            },
            timeout=120
        )
        if resp.status_code == 200:
            return resp.json()
        else:
            return {"error": f"Status {resp.status_code}"}
    except Exception as e:
        return {"error": str(e)}

def main():
    print("=" * 60)
    print("M2 Audio Feature Prediction Test")
    print("=" * 60)

    features = ['danceability', 'energy', 'valence', 'acousticness', 'speechiness']

    results = []

    for track in TEST_TRACKS:
        print(f"\n{track['artist']} - {track['track_name']}")
        print("-" * 50)

        result = test_m2_predict(track)

        if "error" in result:
            print(f"  Error: {result['error']}")
        else:
            audio = result.get("audio_features", {})
            prob = result.get("probability", 0)

            print(f"  Probability: {prob:.4f}")
            for f in features:
                val = audio.get(f, 0)
                print(f"    {f:15}: {val:.4f}")

            results.append({
                "track": f"{track['artist']} - {track['track_name']}",
                "probability": prob,
                "audio_features": audio
            })

    # Summary
    print("\n" + "=" * 60)
    print("Summary Table")
    print("=" * 60)
    print(f"{'Track':<35} {'Dance':>8} {'Energy':>8} {'Valence':>8}")
    print("-" * 60)
    for r in results:
        af = r["audio_features"]
        print(f"{r['track'][:34]:<35} {af.get('danceability', 0):>8.4f} {af.get('energy', 0):>8.4f} {af.get('valence', 0):>8.4f}")

if __name__ == "__main__":
    main()
