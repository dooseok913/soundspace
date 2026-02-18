import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'

dotenv.config()

const COVERS_DIR = path.join(process.cwd(), '..', 'public', 'images', 'covers')
if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true })

function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        if (!url?.startsWith('http')) return resolve(null)
        const protocol = url.startsWith('https') ? https : http
        const file = fs.createWriteStream(filepath)
        protocol.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                file.close()
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
                return downloadImage(res.headers.location, filepath).then(resolve).catch(reject)
            }
            if (res.statusCode !== 200) {
                file.close()
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
                return resolve(null)
            }
            res.pipe(file)
            file.on('finish', () => { file.close(); resolve(true) })
        }).on('error', () => { file.close(); resolve(null) })
    })
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
})

// Re-seed GMS playlists with fresh image downloads
async function main() {
    // Get all GMS playlists with external_ids
    const [gmsPlaylists] = await pool.execute(`
        SELECT playlist_id, title, external_id, cover_image
        FROM playlists
        WHERE space_type = 'GMS'
        AND external_id IS NOT NULL
    `)

    console.log(`Found ${gmsPlaylists.length} GMS playlists`)

    for (const p of gmsPlaylists) {
        const filename = `playlist_${p.playlist_id}.jpg`
        const filepath = path.join(COVERS_DIR, filename)
        const localPath = `/images/covers/${filename}`

        // Skip if file already exists
        if (fs.existsSync(filepath)) {
            console.log(`✓ ${p.title} - image exists`)
            continue
        }

        // Need to re-fetch image URL from API
        let imageUrl = null
        const externalId = p.external_id

        try {
            if (externalId.startsWith('tidal_')) {
                const uuid = externalId.replace('tidal_', '')
                // Tidal API auth
                const clientId = process.env.TIDAL_CLIENT_ID
                const clientSecret = process.env.TIDAL_CLIENT_SECRET
                const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

                const authRes = await fetch('https://auth.tidal.com/v1/oauth2/token', {
                    method: 'POST',
                    headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: 'grant_type=client_credentials'
                })
                const auth = await authRes.json()

                const res = await fetch(`https://api.tidal.com/v1/playlists/${uuid}?countryCode=KR`, {
                    headers: { 'Authorization': `Bearer ${auth.access_token}` }
                })
                const data = await res.json()
                if (data.squareImage) {
                    imageUrl = `https://resources.tidal.com/images/${data.squareImage.replace(/-/g, '/')}/640x640.jpg`
                }
            } else if (externalId.startsWith('spotify_')) {
                const spotifyId = externalId.replace('spotify_', '')
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

                const res = await fetch(`https://api.spotify.com/v1/playlists/${spotifyId}`, {
                    headers: { 'Authorization': `Bearer ${auth.access_token}` }
                })
                const data = await res.json()
                imageUrl = data.images?.[0]?.url
            } else if (externalId.startsWith('itunes_')) {
                const itunesId = externalId.replace('itunes_', '')
                const res = await fetch(`https://itunes.apple.com/lookup?id=${itunesId}&entity=album`)
                const data = await res.json()
                imageUrl = data.results?.[0]?.artworkUrl100?.replace('100x100', '600x600')
            } else if (externalId.startsWith('youtube_')) {
                const youtubeId = externalId.replace('youtube_', '')
                const apiKey = process.env.YOUTUBE_KEY
                const res = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${youtubeId}&key=${apiKey}`)
                const data = await res.json()
                imageUrl = data.items?.[0]?.snippet?.thumbnails?.high?.url
            }

            if (imageUrl) {
                const downloaded = await downloadImage(imageUrl, filepath)
                if (downloaded) {
                    await pool.execute('UPDATE playlists SET cover_image = ? WHERE playlist_id = ?', [localPath, p.playlist_id])
                    console.log(`✅ Downloaded: ${p.title}`)
                } else {
                    console.log(`❌ Failed to download: ${p.title}`)
                }
            } else {
                console.log(`⚠️ No image URL found: ${p.title}`)
            }
        } catch (e) {
            console.log(`❌ Error for ${p.title}: ${e.message}`)
        }
    }

    await pool.end()
    console.log('\nDone!')
}

main().catch(console.error)
