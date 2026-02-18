/**
 * L1 Kuka Spotify 추천 API 서비스
 * - FastAPI /api/spotify/recommend 엔드포인트 연동
 * - 오디오+텍스트 임베딩 기반 음악 추천
 */

export type KukaModel = 'ensemble' | 'knn' | 'text' | 'hybrid'

export interface KukaTrackInfo {
    rank: number
    track_name: string
    artists: string
    genres: string[]
    similarity: number
}

export interface KukaRecommendResponse {
    model: string
    query: string
    total_tracks: number
    recommendations: KukaTrackInfo[]
    explanation?: string
    diversity: number
}

export interface KukaModelInfo {
    models: Record<string, {
        description: string
        supports_diversity: boolean
        default?: boolean
    }>
    total_tracks: number
    embedding_dim: number
    audio_features: string[]
    gemini_available: boolean
}

const KUKA_BASE_URL = '/api/kuka'

export const kukaApi = {
    /**
     * 음악 추천 요청
     * @param params.artist - 아티스트명 (선택)
     * @param params.song - 곡명 (선택) - artist 또는 song 중 하나는 필수
     * @param params.k - 추천 개수 (기본값 10, 최대 50)
     * @param params.model - 추천 모델 (ensemble/knn/text/hybrid)
     * @param params.diversity - 다양성 (0.0~1.0, knn/ensemble에서 사용)
     * @param params.explain - RAG 설명 생성 여부
     */
    recommend: async (params: {
        artist?: string
        song?: string
        k?: number
        model?: KukaModel
        diversity?: number
        explain?: boolean
    }): Promise<KukaRecommendResponse> => {
        const queryParams = new URLSearchParams()

        if (params.artist) queryParams.append('artist', params.artist)
        if (params.song) queryParams.append('song', params.song)
        if (params.k) queryParams.append('k', params.k.toString())
        if (params.model) queryParams.append('model', params.model)
        if (params.diversity !== undefined) queryParams.append('diversity', params.diversity.toString())
        if (params.explain) queryParams.append('explain', 'true')

        const response = await fetch(`${KUKA_BASE_URL}/recommend?${queryParams.toString()}`)

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
            throw new Error(error.detail || `API Error: ${response.status}`)
        }

        return response.json()
    },

    /**
     * 모델 정보 조회
     */
    getModels: async (): Promise<KukaModelInfo> => {
        const response = await fetch(`${KUKA_BASE_URL}/models`)

        if (!response.ok) {
            throw new Error('Failed to get model info')
        }

        return response.json()
    }
}
