import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import https from 'https'
import fs from 'fs'
import path from 'path'

dotenv.config()

const COVERS_DIR = path.join(process.cwd(), '..', 'public', 'images', 'covers')
if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true })

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
})

// 이미지 다운로드
function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        if (!url?.startsWith('http')) return resolve(null)
        const file = fs.createWriteStream(filepath)
        https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                file.close()
                fs.unlinkSync(filepath)
                return downloadImage(res.headers.location, filepath).then(resolve).catch(reject)
            }
            if (res.statusCode !== 200) {
                file.close()
                fs.unlinkSync(filepath)
                return resolve(null)
            }
            res.pipe(file)
            file.on('finish', () => { file.close(); resolve(true) })
        }).on('error', () => { file.close(); resolve(null) })
    })
}

// 랜덤 셔플
function shuffle(arr) {
    return arr.sort(() => Math.random() - 0.5)
}

// Tidal
async function getTidal() {
    console.log('\n🎵 Tidal...')
    const clientId = process.env.TIDAL_CLIENT_ID
    const clientSecret = process.env.TIDAL_CLIENT_SECRET
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const authRes = await fetch('https://auth.tidal.com/v1/oauth2/token', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
    })
    const auth = await authRes.json()

    const res = await fetch('https://api.tidal.com/v1/pages/home?countryCode=KR&deviceType=BROWSER', {
        headers: { 'Authorization': `Bearer ${auth.access_token}`, 'Accept': 'application/vnd.tidal.v1+json' }
    })
    const data = await res.json()

    const playlists = []
    data.rows?.forEach(row => {
        row.modules?.forEach(mod => {
            mod.pagedList?.items?.forEach(item => {
                if (item.uuid && item.title) {
                    playlists.push({
                        title: item.title,
                        externalId: `tidal_${item.uuid}`,
                        coverImage: item.squareImage ? `https://resources.tidal.com/images/${item.squareImage.replace(/-/g, '/')}/640x640.jpg` : null,
                        platform: 'Tidal'
                    })
                }
            })
        })
    })
    return shuffle(playlists).slice(0, 5)
}

// Apple Music
async function getAppleMusic() {
    console.log('🍎 Apple Music...')
    const genres = ['K-Pop', 'Pop', 'Hip-Hop', 'R&B', 'Rock', 'Jazz', 'Classical', 'EDM']
    const playlists = []

    for (const genre of shuffle(genres).slice(0, 3)) {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(genre)}&entity=album&country=KR&limit=10`)
        const data = await res.json()
        data.results?.forEach(album => {
            playlists.push({
                title: album.collectionName,
                description: `Apple Music: ${album.artistName}`,
                externalId: `itunes_${album.collectionId}`,
                coverImage: album.artworkUrl100?.replace('100x100', '600x600'),
                platform: 'Apple Music'
            })
        })
    }
    return shuffle(playlists).slice(0, 5)
}

// Spotify
async function getSpotify() {
    console.log('💚 Spotify...')
    const clientId = process.env.SPOTIFY_CLIENT_ID
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

    const authRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    })
    const auth = await authRes.json()

    const queries = ['K-Pop hits', 'Top 50', 'Chill vibes', 'Workout', 'Party mix']
    const playlists = []

    for (const q of shuffle(queries)) {
        const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=playlist&limit=5&market=KR`, {
            headers: { 'Authorization': `Bearer ${auth.access_token}` }
        })
        const data = await res.json()
        data.playlists?.items?.forEach(p => {
            if (p) {
                playlists.push({
                    title: p.name,
                    description: `Spotify: ${p.owner.display_name}`,
                    externalId: `spotify_${p.id}`,
                    coverImage: p.images?.[0]?.url,
                    platform: 'Spotify'
                })
            }
        })
    }
    return shuffle(playlists).slice(0, 5)
}

// YouTube
async function getYouTube() {
    console.log('📺 YouTube...')
    const apiKey = process.env.YOUTUBE_KEY
    const queries = ['music playlist 2024', 'kpop playlist', 'chill music', 'workout music', 'top hits']
    const playlists = []

    for (const q of shuffle(queries).slice(0, 2)) {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=playlist&maxResults=10&key=${apiKey}`)
        const data = await res.json()
        data.items?.forEach(item => {
            playlists.push({
                title: item.snippet.title,
                description: `YouTube: ${item.snippet.channelTitle}`,
                externalId: `youtube_${item.id.playlistId}`,
                coverImage: item.snippet.thumbnails?.high?.url,
                platform: 'YouTube'
            })
        })
    }
    return shuffle(playlists).slice(0, 5)
}

async function main() {
    console.log('🚀 플랫폼별 플레이리스트 수집 시작...\n')

    const allPlaylists = []

    try { allPlaylists.push(...await getTidal()) } catch (e) { console.log('Tidal 오류:', e.message) }
    try { allPlaylists.push(...await getAppleMusic()) } catch (e) { console.log('Apple 오류:', e.message) }
    try { allPlaylists.push(...await getSpotify()) } catch (e) { console.log('Spotify 오류:', e.message) }
    try { allPlaylists.push(...await getYouTube()) } catch (e) { console.log('YouTube 오류:', e.message) }

    console.log(`\n📦 총 ${allPlaylists.length}개 플레이리스트 수집됨`)
    console.log('\n💾 DB 저장 중...')

    let saved = 0
    for (const p of allPlaylists) {
        try {
            // 중복 체크
            const [existing] = await pool.execute(
                'SELECT playlist_id FROM playlists WHERE external_id = ?', [p.externalId]
            )
            if (existing.length > 0) {
                console.log(`⏭️ 이미 존재: ${p.title}`)
                continue
            }

            // 저장
            const [result] = await pool.execute(
                `INSERT INTO playlists (user_id, title, description, space_type, status_flag, source_type, external_id, cover_image)
                 VALUES (1, ?, ?, 'GMS', 'PTP', 'Platform', ?, ?)`,
                [p.title, p.description || `${p.platform} Playlist`, p.externalId, p.coverImage]
            )
            const playlistId = result.insertId

            // 이미지 다운로드
            if (p.coverImage) {
                const filename = `playlist_${playlistId}.jpg`
                const filepath = path.join(COVERS_DIR, filename)
                const localPath = `/images/covers/${filename}`
                const downloaded = await downloadImage(p.coverImage, filepath)
                if (downloaded) {
                    await pool.execute('UPDATE playlists SET cover_image = ? WHERE playlist_id = ?', [localPath, playlistId])
                }
            }

            console.log(`✅ [${p.platform}] ${p.title}`)
            saved++
        } catch (e) {
            console.log(`❌ ${p.title}: ${e.message}`)
        }
    }

    console.log(`\n🎉 완료! ${saved}개 저장됨`)
    await pool.end()
}

main().catch(console.error)
