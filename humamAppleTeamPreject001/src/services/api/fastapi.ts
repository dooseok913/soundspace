/**
 * FastAPI 분석 서비스
 * - 플레이리스트 ID를 받아 AI 분석 수행
 * - FastAPI 서버: http://localhost:8000 (개발) 또는 Nginx 프록시
 * - M1/M2/M3 모델 선택 지원
 */

export type AIModel = 'M1' | 'M2' | 'M3'

export interface AnalysisRequest {
    playlistId: number
}

export interface AnalysisResponse {
    success: boolean
    playlistId: number
    score: number          // 0-100
    grade: string          // S, A, B, C, D, F
    recommendation: string // GMS 이동 추천 여부: 'approve' | 'reject' | 'pending'
    reason?: string        // 분석 결과 설명
    genres?: string[]      // 감지된 장르
    mood?: string          // 감지된 분위기
    tags?: string[]        // 추천 태그
}

export interface RecommendResponse {
    success: boolean
    model: string
    user_id: number
    playlist_id?: number
    count: number
    recommendations: Array<{
        track_id?: number
        title?: string
        artist?: string
        album?: string
        score?: number
        final_score?: number
        recommendation_score?: number
    }>
    message?: string
    error?: string
}

export interface ModelHealthResponse {
    status: string
    module: string
    model_loaded: boolean
    model_path?: string
    features?: Record<string, string>
}

const FASTAPI_BASE_URL = '/api/fastapi'

// 현재 선택된 모델 가져오기
const getSelectedModel = (): AIModel => {
    return (localStorage.getItem('selected_ai_model') as AIModel) || 'M1'
}

// 현재 설정된 EMS 곡 수 가져오기
const getEmsTrackLimit = (): number => {
    const limit = localStorage.getItem('ems_track_limit')
    return limit ? parseInt(limit) : 300  // 기본값 100 → 300으로 증가
}

export const fastapiService = {
    /**
     * 플레이리스트 AI 분석 요청
     */
    analyze: async (playlistId: number): Promise<AnalysisResponse> => {
        const response = await fetch(`${FASTAPI_BASE_URL}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ playlistId })
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Analysis failed' }))
            throw new Error(error.message || 'Analysis request failed')
        }

        return response.json()
    },

    /**
     * 분석 상태 조회 (비동기 분석용)
     */
    getStatus: async (playlistId: number): Promise<{ status: string; result?: AnalysisResponse }> => {
        const response = await fetch(`${FASTAPI_BASE_URL}/status/${playlistId}`)
        
        if (!response.ok) {
            throw new Error('Failed to get analysis status')
        }

        return response.json()
    },

/**
     * 헬스 체크
     */
    health: async (): Promise<{ status: string }> => {
        const response = await fetch(`${FASTAPI_BASE_URL}/health`)
        return response.json()
    },

    /**
     * EMS 랜덤 트랙 추출 (설정된 곡 수 사용)
     */
    getRandomEMSTracks: async (userId: number, limit?: number): Promise<{
        message: string
        user_id: number
        track_count: number
        tracks: Array<{
            track_id: number
            title: string
            artist: string
            album: string
            duration: number
        }>
    }> => {
        const trackLimit = limit ?? getEmsTrackLimit()
        
        const response = await fetch('/api/m1/random-ems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userid: userId, limit: trackLimit })
        })

        if (!response.ok) {
            throw new Error('Failed to get random EMS tracks')
        }

        return response.json()
    },

    /**
     * EMS 트랙 전달 및 GMS 추천 생성
     */
    transferEMSToGMS: async (userId: number, trackIds?: number[]): Promise<{
        message: string
        user_id: number
        track_count: number
        ems_tracks: any[]
        recommendations: any[]
        gms_playlist_id?: number
    }> => {
        const response = await fetch('/api/m1/transfer-ems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userid: userId, track_ids: trackIds })
        })

        if (!response.ok) {
            throw new Error('Failed to transfer EMS tracks to GMS')
        }

        return response.json()
    },

    /**
     * 트랙 삭제 + AI 모델 재학습
     * - 트랙을 플레이리스트에서 삭제
     * - 삭제된 트랙을 '싫어요'로 학습
     */
    deleteTrackAndRetrain: async (userId: number, playlistId: number, trackId: number): Promise<{
        message: string
        retrain_metrics?: Record<string, any>
    }> => {
        const response = await fetch('/api/m1/deleted-track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                users_id: userId,
                playlists_id: playlistId,
                tracks_id: trackId
            })
        })

        if (!response.ok) {
            throw new Error('Failed to delete track and retrain model')
        }

        return response.json()
    },

    /**
     * 피드백 기반 모델 재학습 (다수 트랙)
     * - 삭제된 트랙들을 '싫어요' 데이터로 활용
     */
    retrainModel: async (userId: number, deletedTrackIds: number[]): Promise<{
        message: string
        metrics?: Record<string, any>
    }> => {
        const response = await fetch(`/api/m1/retrain/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                deleted_track_ids: deletedTrackIds
            })
        })

        if (!response.ok) {
            throw new Error('Failed to retrain model')
        }

        return response.json()
    },

    /**
     * 사용자 음악 취향 프로필 조회
     */
    getUserProfile: async (userId: number): Promise<{
        user_id: number
        profile: Record<string, any>
    }> => {
        const response = await fetch(`/api/m1/user/${userId}/profile`)

        if (!response.ok) {
            throw new Error('Failed to get user profile')
        }

        return response.json()
    },

    // ==================== 모델 선택 관련 API ====================

    /**
     * 현재 선택된 AI 모델 조회
     */
    getSelectedModel: (): AIModel => {
        return getSelectedModel()
    },

    /**
     * AI 모델 선택 저장
     */
    setSelectedModel: (model: AIModel): void => {
        localStorage.setItem('selected_ai_model', model)
    },

    /**
     * EMS 곡 수 설정 조회
     */
    getEmsTrackLimit: (): number => {
        return getEmsTrackLimit()
    },

    /**
     * EMS 곡 수 설정 저장
     */
    setEmsTrackLimit: (limit: number): void => {
        localStorage.setItem('ems_track_limit', limit.toString())
    },

    /**
     * 통합 분석 API - 선택된 모델로 사용자 분석
     */
    analyzeWithModel: async (userId: number, model?: AIModel): Promise<{
        success: boolean
        model: string
        user_id: number
        message?: string
        track_count?: number
        model_path?: string
        error?: string
    }> => {
        const selectedModel = model || getSelectedModel()
        
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userid: userId,
                model: selectedModel
            })
        })

        if (!response.ok) {
            throw new Error('Failed to analyze with model')
        }

        return response.json()
    },

    /**
     * 통합 추천 API - 선택된 모델로 추천 생성
     * @param userId - 사용자 ID
     * @param model - AI 모델 (M1/M2/M3)
     * @param topK - 추천 곡 수
     * @param emsTrackLimit - EMS에서 가져올 곡 수 (optional, 기본값 localStorage에서 로드)
     */
    getRecommendations: async (
        userId: number, 
        model?: AIModel, 
        topK: number = 20,
        emsTrackLimit?: number
    ): Promise<RecommendResponse> => {
        const selectedModel = model || getSelectedModel()
        const emsLimit = emsTrackLimit ?? getEmsTrackLimit()
        
        const response = await fetch('/api/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                model: selectedModel,
                top_k: topK,
                ems_track_limit: emsLimit
            })
        })

        if (!response.ok) {
            throw new Error('Failed to get recommendations')
        }

        return response.json()
    },

    /**
     * 모델별 Health 체크
     */
    checkModelHealth: async (model: AIModel): Promise<ModelHealthResponse> => {
        const response = await fetch(`/api/${model.toLowerCase()}/health`)
        
        if (!response.ok) {
            return {
                status: 'unhealthy',
                module: model,
                model_loaded: false
            }
        }

        return response.json()
    },

    /**
     * 모든 모델 Health 체크
     */
    checkAllModelsHealth: async (): Promise<{
        M1: ModelHealthResponse
        M2: ModelHealthResponse
        M3: ModelHealthResponse
    }> => {
        const [m1, m2, m3] = await Promise.all([
            fastapiService.checkModelHealth('M1'),
            fastapiService.checkModelHealth('M2'),
            fastapiService.checkModelHealth('M3')
        ])

        return { M1: m1, M2: m2, M3: m3 }
    },

    /**
     * 선택된 모델로 트랙 삭제 및 재학습
     */
    deleteTrackAndRetrainWithModel: async (
        userId: number, 
        playlistId: number, 
        trackId: number,
        model?: AIModel
    ): Promise<{
        message: string
        retrain_metrics?: Record<string, any>
    }> => {
        const selectedModel = model || getSelectedModel()
        
        // 현재는 M1만 구현됨, M2/M3는 동일한 엔드포인트 사용
        const endpoint = selectedModel === 'M1' 
            ? '/api/m1/deleted-track'
            : selectedModel === 'M2'
            ? '/api/m2/feedback'
            : '/api/m1/deleted-track'  // M3는 M1 fallback

        const body = selectedModel === 'M2'
            ? { user_id: userId, track_id: trackId, feedback_type: 'deleted' }
            : { users_id: userId, playlists_id: playlistId, tracks_id: trackId }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })

        if (!response.ok) {
            throw new Error('Failed to delete track and retrain model')
        }

        return response.json()
    }
}
