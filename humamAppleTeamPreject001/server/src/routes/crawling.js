/**
 * 스트리밍 플랫폼 크롤링 API
 * - 각 플랫폼에서 차트/인기곡 크롤링
 * - 이미지 로컬 저장
 * - DB에 EMS 플레이리스트로 저장
 */
import express from 'express'
import { getConnection } from '../config/db.js'
import {
    crawlSpotifyCharts,
    crawlAppleMusicCharts,
    crawlYouTubeMusic,
    crawlTidal,
    crawlITunes,
    crawlLastfmCharts,
    crawlAllPlatforms
} from '../services/streamingCrawler.js'

const router = express.Router()

// 환경변수에서 API 키 로드
const LASTFM_API_KEY = process.env.LASTFM_API_KEY || '4cb074e4b8ec4ee9ad3eb37d6f7eb240'
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || ''
const APPLE_MUSIC_TOKEN = process.env.APPLE_MUSIC_TOKEN || ''
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || ''
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || ''

/**
 * Spotify Client Credentials로 액세스 토큰 획득
 */
async function getSpotifyClientToken() {
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        throw new Error('Spotify Client ID/Secret이 설정되지 않았습니다.')
    }
    
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials'
    })
    
    if (!response.ok) {
        throw new Error('Spotify 토큰 획득 실패')
    }
    
    const data = await response.json()
    return data.access_token
}

/**
 * 트랙을 DB에 저장 (중복 체크)
 */
async function saveTrackToDb(conn, track) {
    try {
        // ISRC 또는 platform_id로 중복 체크
        let existingTrack = null
        
        if (track.isrc) {
            const [rows] = await conn.execute(
                'SELECT track_id FROM tracks WHERE isrc = ?',
                [track.isrc]
            )
            if (rows.length > 0) existingTrack = rows[0]
        }
        
        if (!existingTrack && track.spotify_id) {
            const [rows] = await conn.execute(
                'SELECT track_id FROM tracks WHERE spotify_id = ?',
                [track.spotify_id]
            )
            if (rows.length > 0) existingTrack = rows[0]
        }
        
        if (!existingTrack && track.youtube_id) {
            const [rows] = await conn.execute(
                'SELECT track_id FROM tracks WHERE youtube_id = ?',
                [track.youtube_id]
            )
            if (rows.length > 0) existingTrack = rows[0]
        }
        
        if (!existingTrack) {
            // 제목+아티스트로 추가 체크
            const [rows] = await conn.execute(
                'SELECT track_id FROM tracks WHERE title = ? AND artist = ?',
                [track.title, track.artist]
            )
            if (rows.length > 0) existingTrack = rows[0]
        }
        
        if (existingTrack) {
            // 기존 트랙 업데이트 (external_metadata 병합)
            await conn.execute(`
                UPDATE tracks SET 
                    external_metadata = JSON_MERGE_PATCH(COALESCE(external_metadata, '{}'), ?),
                    popularity = COALESCE(?, popularity),
                    playcount = COALESCE(?, playcount),
                    listeners = COALESCE(?, listeners)
                WHERE track_id = ?
            `, [
                JSON.stringify(track.external_metadata || {}),
                track.popularity || null,
                track.playcount || null,
                track.listeners || null,
                existingTrack.track_id
            ])
            return { trackId: existingTrack.track_id, isNew: false }
        }
        
        // 새 트랙 삽입
        const [result] = await conn.execute(`
            INSERT INTO tracks (
                title, artist, album, duration, isrc, genre,
                spotify_id, youtube_id, 
                popularity, explicit, release_date, track_number,
                playcount, listeners, mbid,
                external_metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            track.title,
            track.artist,
            track.album || null,
            track.duration || 180,
            track.isrc || null,
            track.genre || null,
            track.spotify_id || null,
            track.youtube_id || null,
            track.popularity || null,
            track.explicit || 0,
            track.release_date || null,
            track.track_number || 1,
            track.playcount || null,
            track.listeners || null,
            track.mbid || null,
            JSON.stringify({
                ...track.external_metadata,
                artwork_url: track.artwork_url,
                local_artwork: track.local_artwork,
                source: track.source
            })
        ])
        
        return { trackId: result.insertId, isNew: true }
    } catch (err) {
        console.error(`DB 저장 오류 [${track.title}]:`, err.message)
        return null
    }
}

/**
 * EMS 플레이리스트 생성 또는 조회
 */
async function getOrCreatePlaylist(conn, playlistName, source, userId = 1) {
    // 기존 플레이리스트 확인
    const [existing] = await conn.execute(
        `SELECT playlist_id FROM playlists 
         WHERE title = ? AND space_type = 'EMS' AND user_id = ?`,
        [playlistName, userId]
    )
    
    if (existing.length > 0) {
        return existing[0].playlist_id
    }
    
    // 새 플레이리스트 생성
    const [result] = await conn.execute(`
        INSERT INTO playlists (user_id, title, description, space_type, status_flag, source_type)
        VALUES (?, ?, ?, 'EMS', 'PFP', 'Platform')
    `, [userId, playlistName, `${source} 크롤링 - ${new Date().toLocaleDateString('ko-KR')}`])
    
    return result.insertId
}

/**
 * 플레이리스트에 트랙 연결
 */
async function linkTrackToPlaylist(conn, playlistId, trackId, orderIndex) {
    try {
        await conn.execute(`
            INSERT IGNORE INTO playlist_tracks (playlist_id, track_id, order_index)
            VALUES (?, ?, ?)
        `, [playlistId, trackId, orderIndex])
        return true
    } catch {
        return false
    }
}

/**
 * 크롤링 결과를 DB에 저장
 */
async function saveCrawledTracks(tracks, source, userId = 1) {
    const conn = await getConnection()
    const stats = { total: tracks.length, newTracks: 0, updatedTracks: 0, failed: 0 }
    
    try {
        // 소스별 플레이리스트 생성
        const playlistName = `${source} Charts - ${new Date().toLocaleDateString('ko-KR')}`
        const playlistId = await getOrCreatePlaylist(conn, playlistName, source, userId)
        
        console.log(`📁 플레이리스트 생성/조회: ${playlistName} (ID: ${playlistId})`)
        
        let orderIndex = 0
        for (const track of tracks) {
            const result = await saveTrackToDb(conn, track)
            
            if (result) {
                if (result.isNew) stats.newTracks++
                else stats.updatedTracks++
                
                await linkTrackToPlaylist(conn, playlistId, result.trackId, orderIndex++)
            } else {
                stats.failed++
            }
        }
        
        // 플레이리스트 트랙 수 업데이트 (track_count 컬럼이 있으면)
        try {
            await conn.execute(
                'UPDATE playlists SET track_count = ? WHERE playlist_id = ?',
                [orderIndex, playlistId]
            )
        } catch (e) {
            // track_count 컬럼이 없어도 무시
            console.log('track_count 컬럼 업데이트 스킵')
        }
        
        console.log(`✅ ${source} 저장 완료: 신규 ${stats.newTracks}, 업데이트 ${stats.updatedTracks}, 실패 ${stats.failed}`)
        
        return { playlistId, stats }
    } finally {
        conn.release()
    }
}

// ==================== API Endpoints ====================

/**
 * GET /crawl/status - 크롤링 상태 확인
 */
router.get('/status', async (req, res) => {
    try {
        const conn = await getConnection()
        
        // EMS 플레이리스트 통계
        const [playlists] = await conn.execute(`
            SELECT p.source_type, COUNT(DISTINCT p.playlist_id) as count, COUNT(pt.track_id) as total_tracks
            FROM playlists p
            LEFT JOIN playlist_tracks pt ON p.playlist_id = pt.playlist_id
            WHERE p.space_type = 'EMS'
            GROUP BY p.source_type
        `)
        
        // 전체 트랙 수
        const [trackCount] = await conn.execute('SELECT COUNT(*) as count FROM tracks')
        
        // 이미지 저장 현황
        const fs = await import('fs')
        const path = await import('path')
        const imagesDir = path.join(process.cwd(), 'public/images')
        
        let imageStats = {}
        for (const dir of ['albums', 'tracks', 'artists', 'covers']) {
            const dirPath = path.join(imagesDir, dir)
            try {
                const files = fs.readdirSync(dirPath)
                imageStats[dir] = files.length
            } catch {
                imageStats[dir] = 0
            }
        }
        
        conn.release()
        
        res.json({
            status: 'ready',
            playlists,
            totalTracks: trackCount[0].count,
            images: imageStats
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

/**
 * POST /crawl/itunes - iTunes 검색 크롤링
 */
router.post('/itunes', async (req, res) => {
    try {
        const { searchTerms, limit = 50, userId = 1 } = req.body
        
        console.log('🎵 iTunes 크롤링 시작...')
        const tracks = await crawlITunes(searchTerms, limit)
        
        const { playlistId, stats } = await saveCrawledTracks(tracks, 'iTunes', userId)
        
        res.json({
            success: true,
            source: 'iTunes',
            playlistId,
            stats,
            message: `iTunes에서 ${stats.total}곡 수집, ${stats.newTracks}곡 신규 저장`
        })
    } catch (err) {
        console.error('iTunes 크롤링 오류:', err)
        res.status(500).json({ error: err.message })
    }
})

/**
 * POST /crawl/lastfm - Last.fm 차트 크롤링
 */
router.post('/lastfm', async (req, res) => {
    try {
        const { apiKey = LASTFM_API_KEY, limit = 100, userId = 1 } = req.body
        
        if (!apiKey) {
            return res.status(400).json({ error: 'Last.fm API Key 필요' })
        }
        
        console.log('📻 Last.fm 크롤링 시작...')
        const tracks = await crawlLastfmCharts(apiKey, limit)
        
        const { playlistId, stats } = await saveCrawledTracks(tracks, 'Last.fm', userId)
        
        res.json({
            success: true,
            source: 'Last.fm',
            playlistId,
            stats,
            message: `Last.fm에서 ${stats.total}곡 수집, ${stats.newTracks}곡 신규 저장`
        })
    } catch (err) {
        console.error('Last.fm 크롤링 오류:', err)
        res.status(500).json({ error: err.message })
    }
})

/**
 * POST /crawl/lastfm/tags - Last.fm 태그별 크롤링
 */
router.post('/lastfm/tags', async (req, res) => {
    try {
        const { 
            tags = ['k-pop', 'j-pop', 'c-pop', 'pop', 'rock', 'hip-hop', 'r&b', 'electronic', 
                    'indie', 'metal', 'punk', 'jazz', 'classical', 'country', 'latin', 
                    'reggae', 'soul', 'funk', 'disco', 'house', 'techno', 'trance', 
                    'ambient', 'folk', 'blues', 'acoustic', 'alternative'],
            limit = 50, 
            userId = 1 
        } = req.body
        
        console.log(`📻 Last.fm 태그별 크롤링 시작 (${tags.length}개 태그)...`)
        
        const allTracks = []
        
        for (const tag of tags) {
            try {
                const response = await fetch(
                    `http://ws.audioscrobbler.com/2.0/?method=tag.gettoptracks&tag=${encodeURIComponent(tag)}&api_key=${LASTFM_API_KEY}&format=json&limit=${limit}`
                )
                const data = await response.json()
                
                if (data.tracks?.track) {
                    for (const track of data.tracks.track) {
                        const artworkUrl = track.image?.find(i => i.size === 'extralarge')?.['#text']
                        
                        allTracks.push({
                            title: track.name,
                            artist: track.artist?.name || 'Unknown',
                            album: '',
                            duration: parseInt(track.duration) || 180,
                            isrc: null,
                            mbid: track.mbid || null,
                            popularity: 0,
                            explicit: 0,
                            release_date: null,
                            track_number: 1,
                            artwork_url: artworkUrl || null,
                            local_artwork: null,
                            source: 'lastfm',
                            genre: tag,
                            playcount: parseInt(track.playcount) || 0,
                            listeners: parseInt(track.listeners) || 0,
                            external_metadata: {
                                lastfm_url: track.url,
                                mbid: track.mbid,
                                tag: tag
                            }
                        })
                    }
                    console.log(`  ✅ Tag "${tag}": ${data.tracks.track.length}곡`)
                }
                
                // Rate limit
                await new Promise(r => setTimeout(r, 200))
            } catch (err) {
                console.error(`  ❌ Tag "${tag}" 실패:`, err.message)
            }
        }
        
        const { playlistId, stats } = await saveCrawledTracks(allTracks, 'Last.fm Tags', userId)
        
        res.json({
            success: true,
            source: 'Last.fm Tags',
            playlistId,
            stats,
            tagsProcessed: tags.length,
            message: `Last.fm ${tags.length}개 태그에서 ${stats.total}곡 수집, ${stats.newTracks}곡 신규 저장`
        })
    } catch (err) {
        console.error('Last.fm Tags 크롤링 오류:', err)
        res.status(500).json({ error: err.message })
    }
})

/**
 * POST /crawl/spotify - Spotify 차트 크롤링 (Client Credentials 자동 사용)
 */
router.post('/spotify', async (req, res) => {
    try {
        let { accessToken, limit = 50, userId = 1 } = req.body
        
        // accessToken이 없으면 Client Credentials로 획득
        if (!accessToken) {
            try {
                accessToken = await getSpotifyClientToken()
                console.log('🔑 Spotify Client Credentials 토큰 획득 성공')
            } catch (err) {
                return res.status(400).json({ error: err.message })
            }
        }
        
        console.log('🎵 Spotify 크롤링 시작...')
        const tracks = await crawlSpotifyCharts(accessToken, limit)
        
        const { playlistId, stats } = await saveCrawledTracks(tracks, 'Spotify', userId)
        
        res.json({
            success: true,
            source: 'Spotify',
            playlistId,
            stats,
            message: `Spotify에서 ${stats.total}곡 수집, ${stats.newTracks}곡 신규 저장`
        })
    } catch (err) {
        console.error('Spotify 크롤링 오류:', err)
        res.status(500).json({ error: err.message })
    }
})

/**
 * POST /crawl/spotify/playlists - Spotify 공개 플레이리스트 크롤링
 */
router.post('/spotify/playlists', async (req, res) => {
    try {
        const { playlistIds, userId = 1 } = req.body
        
        // 기본 인기 플레이리스트 ID
        const defaultPlaylists = [
            '37i9dQZEVXbMDoHDwVN2tF', // Global Top 50
            '37i9dQZEVXbLiRSasKsNU9', // Viral 50 Global
            '37i9dQZEVXbNxXF4SkHj9F', // Korea Top 50
            '37i9dQZF1DXD6XHuolO5KE', // K-Pop ON!
            '37i9dQZF1DX9tPFwDMOaN1', // Today's Top Hits
            '37i9dQZF1DXcBWIGoYBM5M', // Today's Top Hits
            '37i9dQZF1DX0XUsuxWHRQd', // RapCaviar
            '37i9dQZF1DX4JAvHpjipBk', // New Music Friday
            '37i9dQZF1DX4dyzvuaRJ0n', // mint
            '37i9dQZF1DWXRqgorJj26U', // Rock Classics
            '37i9dQZF1DX4sWSpwq3LiO', // Peaceful Piano
            '37i9dQZF1DX1lVhptIYRda', // Hot Hits Korea
        ]
        
        const targetPlaylists = playlistIds || defaultPlaylists
        
        // Spotify 토큰 획득
        let accessToken
        try {
            accessToken = await getSpotifyClientToken()
        } catch (err) {
            return res.status(400).json({ error: err.message })
        }
        
        console.log(`🎵 Spotify 플레이리스트 ${targetPlaylists.length}개 크롤링 시작...`)
        
        const results = []
        let totalTracks = 0
        let totalNew = 0
        
        for (const playlistId of targetPlaylists) {
            try {
                // 플레이리스트 정보 가져오기
                const playlistResponse = await fetch(
                    `https://api.spotify.com/v1/playlists/${playlistId}`,
                    { headers: { 'Authorization': `Bearer ${accessToken}` } }
                )
                
                if (!playlistResponse.ok) {
                    console.log(`  ❌ 플레이리스트 ${playlistId} 실패: ${playlistResponse.status}`)
                    continue
                }
                
                const playlist = await playlistResponse.json()
                const tracks = []
                
                // 플레이리스트 커버 이미지 다운로드
                const { downloadPlaylistCover } = await import('../utils/imageDownloader.js')
                let localCover = null
                if (playlist.images?.[0]?.url) {
                    localCover = await downloadPlaylistCover(playlist.images[0].url, playlistId)
                }
                
                // 트랙 처리
                for (const item of (playlist.tracks?.items || [])) {
                    const track = item.track
                    if (!track) continue
                    
                    // 앨범 이미지 다운로드
                    const { default: streamingCrawler } = await import('../services/streamingCrawler.js')
                    let localArtwork = null
                    if (track.album?.images?.[0]?.url) {
                        // 직접 다운로드
                        const fs = await import('fs')
                        const path = await import('path')
                        const ALBUMS_DIR = path.join(process.cwd(), 'public/images/albums')
                        
                        const safeId = String(track.album.id).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
                        const safeName = String(track.album.name).replace(/[^a-zA-Z0-9가-힣]/g, '_').substring(0, 20)
                        const filename = `album_${safeId}_${safeName}.jpg`
                        const filepath = path.join(ALBUMS_DIR, filename)
                        localArtwork = `/images/albums/${filename}`
                        
                        if (!fs.existsSync(filepath)) {
                            try {
                                const imgResponse = await fetch(track.album.images[0].url)
                                if (imgResponse.ok) {
                                    const buffer = await imgResponse.arrayBuffer()
                                    fs.writeFileSync(filepath, Buffer.from(buffer))
                                }
                            } catch {}
                        }
                    }
                    
                    tracks.push({
                        title: track.name,
                        artist: track.artists?.map(a => a.name).join(', ') || 'Unknown',
                        album: track.album?.name || '',
                        duration: Math.floor(track.duration_ms / 1000),
                        isrc: track.external_ids?.isrc || null,
                        spotify_id: track.id,
                        popularity: track.popularity || 0,
                        explicit: track.explicit ? 1 : 0,
                        release_date: track.album?.release_date || null,
                        track_number: track.track_number || 1,
                        artwork_url: track.album?.images?.[0]?.url || null,
                        local_artwork: localArtwork,
                        source: 'spotify',
                        external_metadata: {
                            spotify_id: track.id,
                            preview_url: track.preview_url,
                            album_id: track.album?.id,
                            playlist_id: playlistId,
                            playlist_name: playlist.name
                        }
                    })
                }
                
                // DB에 저장
                const { playlistId: dbPlaylistId, stats } = await saveCrawledTracks(
                    tracks, 
                    `Spotify - ${playlist.name}`, 
                    userId
                )
                
                results.push({
                    playlistId,
                    name: playlist.name,
                    dbPlaylistId,
                    trackCount: tracks.length,
                    newTracks: stats.newTracks,
                    localCover
                })
                
                totalTracks += tracks.length
                totalNew += stats.newTracks
                
                console.log(`  ✅ "${playlist.name}": ${tracks.length}곡`)
                
            } catch (err) {
                console.error(`  ❌ 플레이리스트 ${playlistId} 오류:`, err.message)
                results.push({ playlistId, error: err.message })
            }
        }
        
        res.json({
            success: true,
            source: 'Spotify Playlists',
            results,
            totalTracks,
            totalNew,
            message: `Spotify에서 ${results.length}개 플레이리스트, ${totalTracks}곡 수집 완료`
        })
        
    } catch (err) {
        console.error('Spotify 플레이리스트 크롤링 오류:', err)
        res.status(500).json({ error: err.message })
    }
})

/**
 * POST /crawl/apple - Apple Music 크롤링
 */
router.post('/apple', async (req, res) => {
    try {
        const { developerToken, limit = 100, userId = 1 } = req.body
        
        if (!developerToken) {
            return res.status(400).json({ error: 'Apple Music Developer Token 필요' })
        }
        
        console.log('🍎 Apple Music 크롤링 시작...')
        const tracks = await crawlAppleMusicCharts(developerToken, limit)
        
        const { playlistId, stats } = await saveCrawledTracks(tracks, 'Apple Music', userId)
        
        res.json({
            success: true,
            source: 'Apple Music',
            playlistId,
            stats,
            message: `Apple Music에서 ${stats.total}곡 수집, ${stats.newTracks}곡 신규 저장`
        })
    } catch (err) {
        console.error('Apple Music 크롤링 오류:', err)
        res.status(500).json({ error: err.message })
    }
})

/**
 * POST /crawl/youtube - YouTube Music 크롤링
 */
router.post('/youtube', async (req, res) => {
    try {
        const { apiKey = YOUTUBE_API_KEY, limit = 50, userId = 1 } = req.body
        
        if (!apiKey) {
            return res.status(400).json({ error: 'YouTube API Key 필요' })
        }
        
        console.log('📺 YouTube 크롤링 시작...')
        const tracks = await crawlYouTubeMusic(apiKey, limit)
        
        const { playlistId, stats } = await saveCrawledTracks(tracks, 'YouTube', userId)
        
        res.json({
            success: true,
            source: 'YouTube',
            playlistId,
            stats,
            message: `YouTube에서 ${stats.total}곡 수집, ${stats.newTracks}곡 신규 저장`
        })
    } catch (err) {
        console.error('YouTube 크롤링 오류:', err)
        res.status(500).json({ error: err.message })
    }
})

/**
 * POST /crawl/tidal - Tidal 크롤링
 */
router.post('/tidal', async (req, res) => {
    try {
        const { accessToken, countryCode = 'KR', limit = 50, userId = 1 } = req.body
        
        if (!accessToken) {
            return res.status(400).json({ error: 'Tidal Access Token 필요' })
        }
        
        console.log('🌊 Tidal 크롤링 시작...')
        const tracks = await crawlTidal(accessToken, countryCode, limit)
        
        const { playlistId, stats } = await saveCrawledTracks(tracks, 'Tidal', userId)
        
        res.json({
            success: true,
            source: 'Tidal',
            playlistId,
            stats,
            message: `Tidal에서 ${stats.total}곡 수집, ${stats.newTracks}곡 신규 저장`
        })
    } catch (err) {
        console.error('Tidal 크롤링 오류:', err)
        res.status(500).json({ error: err.message })
    }
})

/**
 * POST /crawl/all - 전체 플랫폼 크롤링 (토큰 있는 것만)
 */
router.post('/all', async (req, res) => {
    try {
        const { 
            spotifyAccessToken,
            appleMusicToken,
            youtubeApiKey = YOUTUBE_API_KEY,
            tidalAccessToken,
            lastfmApiKey = LASTFM_API_KEY,
            userId = 1 
        } = req.body
        
        console.log('🚀 전체 플랫폼 크롤링 시작...')
        
        const results = []
        
        // iTunes (토큰 불필요)
        try {
            const tracks = await crawlITunes()
            const { playlistId, stats } = await saveCrawledTracks(tracks, 'iTunes', userId)
            results.push({ source: 'iTunes', playlistId, stats, success: true })
        } catch (err) {
            results.push({ source: 'iTunes', error: err.message, success: false })
        }
        
        // Last.fm
        if (lastfmApiKey) {
            try {
                const tracks = await crawlLastfmCharts(lastfmApiKey)
                const { playlistId, stats } = await saveCrawledTracks(tracks, 'Last.fm', userId)
                results.push({ source: 'Last.fm', playlistId, stats, success: true })
            } catch (err) {
                results.push({ source: 'Last.fm', error: err.message, success: false })
            }
        }
        
        // Spotify
        if (spotifyAccessToken) {
            try {
                const tracks = await crawlSpotifyCharts(spotifyAccessToken)
                const { playlistId, stats } = await saveCrawledTracks(tracks, 'Spotify', userId)
                results.push({ source: 'Spotify', playlistId, stats, success: true })
            } catch (err) {
                results.push({ source: 'Spotify', error: err.message, success: false })
            }
        }
        
        // Apple Music
        if (appleMusicToken) {
            try {
                const tracks = await crawlAppleMusicCharts(appleMusicToken)
                const { playlistId, stats } = await saveCrawledTracks(tracks, 'Apple Music', userId)
                results.push({ source: 'Apple Music', playlistId, stats, success: true })
            } catch (err) {
                results.push({ source: 'Apple Music', error: err.message, success: false })
            }
        }
        
        // YouTube
        if (youtubeApiKey) {
            try {
                const tracks = await crawlYouTubeMusic(youtubeApiKey)
                const { playlistId, stats } = await saveCrawledTracks(tracks, 'YouTube', userId)
                results.push({ source: 'YouTube', playlistId, stats, success: true })
            } catch (err) {
                results.push({ source: 'YouTube', error: err.message, success: false })
            }
        }
        
        // Tidal
        if (tidalAccessToken) {
            try {
                const tracks = await crawlTidal(tidalAccessToken)
                const { playlistId, stats } = await saveCrawledTracks(tracks, 'Tidal', userId)
                results.push({ source: 'Tidal', playlistId, stats, success: true })
            } catch (err) {
                results.push({ source: 'Tidal', error: err.message, success: false })
            }
        }
        
        // 통계 집계
        const totalStats = results.reduce((acc, r) => {
            if (r.stats) {
                acc.total += r.stats.total
                acc.newTracks += r.stats.newTracks
                acc.updatedTracks += r.stats.updatedTracks
            }
            return acc
        }, { total: 0, newTracks: 0, updatedTracks: 0 })
        
        res.json({
            success: true,
            results,
            totalStats,
            message: `전체 크롤링 완료: ${totalStats.total}곡 수집, ${totalStats.newTracks}곡 신규 저장`
        })
    } catch (err) {
        console.error('전체 크롤링 오류:', err)
        res.status(500).json({ error: err.message })
    }
})

/**
 * DELETE /crawl/cleanup - 오래된 크롤링 데이터 정리
 */
router.delete('/cleanup', async (req, res) => {
    try {
        const { daysOld = 30 } = req.body
        const conn = await getConnection()
        
        // 오래된 크롤링 플레이리스트 삭제
        const [result] = await conn.execute(`
            DELETE FROM playlists 
            WHERE space_type = 'EMS' 
            AND source_type = 'Platform'
            AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [daysOld])
        
        conn.release()
        
        res.json({
            success: true,
            deletedPlaylists: result.affectedRows,
            message: `${daysOld}일 이상 된 플레이리스트 ${result.affectedRows}개 삭제`
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

export default router
