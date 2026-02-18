import express from 'express'
import { query, insert } from '../config/db.js'

const router = express.Router()

// FastAPI 서버 URL (환경변수 또는 기본값)
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000'

/**
 * 점수를 등급으로 변환
 */
function scoreToGrade(score) {
    if (score >= 90) return 'S'
    if (score >= 80) return 'A'
    if (score >= 70) return 'B'
    if (score >= 60) return 'C'
    if (score >= 50) return 'D'
    return 'F'
}

/**
 * 점수에 따른 추천 결정
 */
function scoreToRecommendation(score) {
    if (score >= 70) return 'approve'
    if (score >= 50) return 'pending'
    return 'reject'
}

/**
 * POST /api/fastapi/analyze
 * 플레이리스트 AI 분석 요청 및 결과를 ai_analysis_logs에 저장
 */
router.post('/analyze', async (req, res) => {
    const { playlistId, userId = 3, requestSource = 'cart' } = req.body

    if (!playlistId) {
        return res.status(400).json({ error: 'playlistId is required' })
    }

    try {
        // 1. 플레이리스트 정보 확인
        const [playlist] = await query(
            'SELECT playlist_id, title, user_id FROM playlists WHERE playlist_id = ?',
            [playlistId]
        )

        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' })
        }

        // 2. 플레이리스트 트랙 정보 가져오기
        const tracks = await query(`
            SELECT t.track_id, t.title, t.artist, t.album, t.genre, t.audio_features
            FROM playlist_tracks pt
            JOIN tracks t ON pt.track_id = t.track_id
            WHERE pt.playlist_id = ?
            ORDER BY pt.order_index
        `, [playlistId])

        // 3. FastAPI 서버로 분석 요청 (또는 로컬 분석)
        let analysisResult
        
        try {
            // FastAPI 서버가 있으면 요청
            const response = await fetch(`${FASTAPI_URL}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playlistId,
                    tracks: tracks.map(t => ({
                        title: t.title,
                        artist: t.artist,
                        genre: t.genre,
                        audioFeatures: t.audio_features
                    }))
                }),
                signal: AbortSignal.timeout(10000) // 10초 타임아웃
            })

            if (response.ok) {
                analysisResult = await response.json()
            } else {
                throw new Error('FastAPI server error')
            }
        } catch (fetchError) {
            // FastAPI 서버 없으면 로컬 분석 (간단한 휴리스틱)
            console.log('[FastAPI] Server not available, using local analysis')
            
            const trackCount = tracks.length
            const hasGenre = tracks.filter(t => t.genre).length
            const hasAudioFeatures = tracks.filter(t => t.audio_features).length
            
            // 간단한 점수 계산
            let score = 50 // 기본 점수
            score += Math.min(trackCount * 2, 20) // 트랙 수 (최대 +20)
            score += Math.min((hasGenre / trackCount) * 15, 15) // 장르 정보 (최대 +15)
            score += Math.min((hasAudioFeatures / trackCount) * 15, 15) // 오디오 특성 (최대 +15)
            
            score = Math.min(Math.round(score), 100)
            
            analysisResult = {
                score,
                grade: scoreToGrade(score),
                recommendation: scoreToRecommendation(score),
                reason: `${trackCount}곡 분석 완료. 장르 정보 ${hasGenre}/${trackCount}, 오디오 특성 ${hasAudioFeatures}/${trackCount}`,
                genres: [...new Set(tracks.map(t => t.genre).filter(Boolean).flatMap(g => g.split(',')))].slice(0, 5),
                mood: score >= 70 ? 'positive' : score >= 50 ? 'neutral' : 'needs_review'
            }
        }

        // 4. ai_analysis_logs에 저장
        const grade = analysisResult.grade || scoreToGrade(analysisResult.score)
        const recommendation = analysisResult.recommendation || scoreToRecommendation(analysisResult.score)
        
        const logId = await insert(`
            INSERT INTO ai_analysis_logs 
            (user_id, target_type, target_id, score, grade, recommendation, reason, request_source, analysis_result)
            VALUES (?, 'Playlist', ?, ?, ?, ?, ?, ?, ?)
        `, [
            userId,
            playlistId,
            analysisResult.score,
            grade,
            recommendation,
            analysisResult.reason || null,
            requestSource,
            JSON.stringify(analysisResult)
        ])

        // 5. playlists 테이블 ai_score 업데이트
        await query(`
            UPDATE playlists SET ai_score = ? WHERE playlist_id = ?
        `, [analysisResult.score, playlistId])

        // 6. 응답 반환
        res.json({
            success: true,
            playlistId,
            logId,
            score: analysisResult.score,
            grade,
            recommendation,
            reason: analysisResult.reason,
            genres: analysisResult.genres,
            mood: analysisResult.mood,
            tags: analysisResult.tags
        })

    } catch (error) {
        console.error('[FastAPI] Analysis error:', error)
        res.status(500).json({ error: error.message })
    }
})

/**
 * GET /api/fastapi/status/:playlistId
 * 분석 상태 조회
 */
router.get('/status/:playlistId', async (req, res) => {
    const { playlistId } = req.params

    try {
        const [log] = await query(`
            SELECT log_id, score, grade, recommendation, reason, analysis_result, analyzed_at
            FROM ai_analysis_logs
            WHERE target_type = 'Playlist' AND target_id = ?
            ORDER BY analyzed_at DESC
            LIMIT 1
        `, [playlistId])

        if (!log) {
            return res.json({ status: 'not_found', result: null })
        }

        res.json({
            status: 'completed',
            result: {
                playlistId: parseInt(playlistId),
                score: log.score,
                grade: log.grade,
                recommendation: log.recommendation,
                reason: log.reason,
                analyzedAt: log.analyzed_at
            }
        })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

/**
 * GET /api/fastapi/logs
 * 분석 로그 목록 조회 (사용자별)
 */
router.get('/logs', async (req, res) => {
    const { userId = 3, limit = 20, recommendation } = req.query

    try {
        let sql = `
            SELECT 
                al.log_id,
                al.target_type,
                al.target_id,
                al.score,
                al.grade,
                al.recommendation,
                al.reason,
                al.request_source,
                al.analyzed_at,
                p.title as playlist_title,
                p.cover_image
            FROM ai_analysis_logs al
            LEFT JOIN playlists p ON al.target_type = 'Playlist' AND al.target_id = p.playlist_id
            WHERE al.user_id = ?
        `
        const params = [userId]

        if (recommendation) {
            sql += ' AND al.recommendation = ?'
            params.push(recommendation)
        }

        sql += ' ORDER BY al.analyzed_at DESC LIMIT ?'
        params.push(parseInt(limit))

        const logs = await query(sql, params)

        res.json({
            logs,
            total: logs.length
        })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

/**
 * GET /api/fastapi/recommendations
 * AI 추천 목록 (approve된 항목)
 */
router.get('/recommendations', async (req, res) => {
    const { userId = 3, limit = 10 } = req.query

    try {
        const recommendations = await query(`
            SELECT 
                al.target_id as playlistId,
                al.score,
                al.grade,
                al.reason,
                al.analyzed_at,
                p.title,
                p.description,
                p.cover_image as coverImage,
                p.space_type as spaceType,
                (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.playlist_id) as trackCount
            FROM ai_analysis_logs al
            JOIN playlists p ON al.target_id = p.playlist_id
            WHERE al.user_id = ?
            AND al.target_type = 'Playlist'
            AND al.recommendation = 'approve'
            ORDER BY al.score DESC, al.analyzed_at DESC
            LIMIT ?
        `, [userId, parseInt(limit)])

        res.json({
            recommendations,
            total: recommendations.length
        })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

/**
 * GET /api/fastapi/health
 * FastAPI 서버 상태 확인
 */
router.get('/health', async (req, res) => {
    try {
        const response = await fetch(`${FASTAPI_URL}/health`, {
            signal: AbortSignal.timeout(3000)
        })
        
        if (response.ok) {
            const data = await response.json()
            res.json({ status: 'ok', fastapi: data })
        } else {
            res.json({ status: 'degraded', message: 'FastAPI server not responding properly' })
        }
    } catch (error) {
        res.json({ status: 'local_only', message: 'FastAPI server not available, using local analysis' })
    }
})

export default router
