"""
LangSmith 트레이싱 테스트
=========================
이 스크립트를 실행하면 LangSmith UI에서 트레이스를 확인할 수 있습니다.
"""
import asyncio
import os
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# 환경 변수 확인
print("=" * 50)
print("Environment Check")
print("=" * 50)
print(f"LANGCHAIN_TRACING_V2: {os.getenv('LANGCHAIN_TRACING_V2')}")
print(f"LANGCHAIN_PROJECT: {os.getenv('LANGCHAIN_PROJECT')}")
print(f"LANGCHAIN_API_KEY: {os.getenv('LANGCHAIN_API_KEY', '')[:20]}...")
print(f"GOOGLE_API_KEY: {os.getenv('GOOGLE_API_KEY', '')[:20]}...")
print()

# LangSmith 트레이싱 테스트
from langsmith import traceable

@traceable(name="test_simple_trace")
def simple_test():
    """간단한 트레이싱 테스트"""
    return "Hello from LangSmith!"

# 실행
print("=" * 50)
print("Test 1: Simple Tracing")
print("=" * 50)
result = simple_test()
print(f"Result: {result}")
print()

# LLM 호출 테스트 (query_analyzer)
print("=" * 50)
print("Test 2: Query Analyzer (Gemini)")
print("=" * 50)

async def test_query_analyzer():
    from app.services.llm.query_analyzer import analyze_query

    # 한국어 쿼리로 테스트 (LLM 번역 호출 발생)
    test_queries = [
        "비오는 날 재즈",
    ]

    for query in test_queries:
        print(f"\nInput: '{query}'")
        result = await analyze_query(query)
        print(f"  -> English: {result.get('english_query')}")
        print(f"  -> Emotion: {result.get('detected_emotion')}")
        print(f"  -> Filters: {result.get('audio_filters')}")
        print(f"  -> Used LLM: {result.get('used_llm')}")

# 비동기 실행
asyncio.run(test_query_analyzer())

# LLM 설명 생성 테스트 (explainer)
print()
print("=" * 50)
print("Test 3: Recommendation Explainer (Gemini)")
print("=" * 50)

async def test_explainer():
    from app.services.llm.explainer import explain_recommendation, generate_contextual_explanation

    # 테스트용 곡 데이터
    test_track = {
        "artist": "Norah Jones",
        "title": "Come Away With Me",
        "audio_features": {
            "energy": 0.2,
            "valence": 0.4,
            "acousticness": 0.9
        },
        "artist_tags": "jazz, vocal jazz, singer-songwriter"
    }

    test_preferences = {
        "avg_energy": 0.3,
        "avg_valence": 0.5,
        "top_genres": ["jazz", "acoustic"],
        "recent_artists": ["Diana Krall", "Billie Holiday"]
    }

    print("\n[Test 3a] explain_recommendation")
    print(f"  Track: {test_track['artist']} - {test_track['title']}")
    result = await explain_recommendation(test_track, test_preferences)
    print(f"  -> Explanation: {result.get('explanation', 'N/A')[:100]}...")
    print(f"  -> Match Score: {result.get('match_score')}")

    # contextual_explanation 테스트
    print("\n[Test 3b] generate_contextual_explanation")
    test_tracks = [
        {"artist": "Norah Jones", "title": "Come Away With Me", "genre": "jazz", "tags": "vocal jazz, smooth"},
        {"artist": "Diana Krall", "title": "The Look of Love", "genre": "jazz", "tags": "jazz vocals, romantic"},
    ]
    search_context = "비오는 날 카페 음악"
    print(f"  Search: '{search_context}'")
    explanations = await generate_contextual_explanation(test_tracks, search_context)
    for i, exp in enumerate(explanations):
        print(f"  -> Track {i+1}: {exp[:80]}...")

asyncio.run(test_explainer())

print()
print("=" * 50)
print("Test Complete!")
print("=" * 50)
print()
print("Check traces at LangSmith UI:")
print("https://smith.langchain.com")
print()
