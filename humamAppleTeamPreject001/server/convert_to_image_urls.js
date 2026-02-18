/**
 * 플레이리스트 cover_image를 외부 URL로 변환
 * - Spotify: API에서 이미지 URL 가져오기
 * - 그 외: 포함된 트랙의 artwork 중 하나 사용
 */
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
})

async function getSpotifyToken() {
    const clientId = process.env.SPOTIFY_CLIENT_ID
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
    if (!clientId || !clientSecret) {
        console.log('⚠️ Spotify API 키 없음')
        return null
    }
    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    })
    const data = await res.json()
    return data.access_token
}

async function getSpotifyPlaylistImage(spotifyId, token) {
    try {
        const res = await fetch(`https://api.spotify.com/v1/playlists/${spotifyId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await res.json()
        return data.images?.[0]?.url || null
    } catch (e) {
        return null
    }
}

async function getTrackArtworkFromPlaylist(playlistId) {
    // 플레이리스트에 포함된 트랙 중 artwork가 있는 첫 번째 트랙의 이미지 사용
    const [tracks] = await pool.execute(`
        SELECT t.artwork
        FROM tracks t
        JOIN playlist_tracks pt ON t.track_id = pt.track_id
        WHERE pt.playlist_id = ?
        AND t.artwork IS NOT NULL
        AND t.artwork LIKE 'http%'
        LIMIT 1
    `, [playlistId])

    return tracks.length > 0 ? tracks[0].artwork : null
}

async function main() {
    console.log('🔄 플레이리스트 이미지를 외부 URL로 변환 시작...\n')

    // Spotify 토큰 획득
    const spotifyToken = await getSpotifyToken()
    console.log(`🔑 Spotify API: ${spotifyToken ? '✓ 연결됨' : '✗ 키 없음'}\n`)

    // 로컬 경로를 사용하는 플레이리스트 조회
    const [playlists] = await pool.execute(`
        SELECT playlist_id, title, external_id, cover_image, space_type
        FROM playlists
        WHERE cover_image LIKE '/images/%'
    `)

    console.log(`📋 변환 대상: ${playlists.length}개 플레이리스트\n`)

    let spotifySuccess = 0, trackArtwork = 0, skipped = 0

    for (const p of playlists) {
        let imageUrl = null

        // 1. Spotify 플레이리스트면 API에서 가져오기
        if (p.external_id?.startsWith('spotify_') && spotifyToken) {
            const spotifyId = p.external_id.replace('spotify_', '')
            imageUrl = await getSpotifyPlaylistImage(spotifyId, spotifyToken)
            if (imageUrl) {
                await pool.execute(
                    'UPDATE playlists SET cover_image = ? WHERE playlist_id = ?',
                    [imageUrl, p.playlist_id]
                )
                console.log(`✅ [Spotify] ${p.title}`)
                spotifySuccess++
                await new Promise(r => setTimeout(r, 100)) // Rate limiting
                continue
            }
        }

        // 2. 그 외: 포함된 트랙의 artwork 사용
        imageUrl = await getTrackArtworkFromPlaylist(p.playlist_id)
        if (imageUrl) {
            await pool.execute(
                'UPDATE playlists SET cover_image = ? WHERE playlist_id = ?',
                [imageUrl, p.playlist_id]
            )
            console.log(`✅ [Track] ${p.title} → 트랙 이미지 사용`)
            trackArtwork++
        } else {
            console.log(`⚠️ ${p.title} - 이미지 없음 (기존 유지)`)
            skipped++
        }
    }

    await pool.end()

    console.log(`\n🎉 완료!`)
    console.log(`  ✅ Spotify API: ${spotifySuccess}`)
    console.log(`  ✅ 트랙 이미지: ${trackArtwork}`)
    console.log(`  ⚠️ 스킵 (이미지 없음): ${skipped}`)
}

main().catch(console.error)
