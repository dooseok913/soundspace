import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import https from 'https'
import fs from 'fs'
import path from 'path'

dotenv.config()

const COVERS_DIR = path.join(process.cwd(), '..', 'public', 'images', 'covers')
if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true })

function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        if (!url?.startsWith('http')) return resolve(null)
        const file = fs.createWriteStream(filepath)
        https.get(url, (res) => {
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

// UUID인지 확인 (Tidal cover image format)
function isUUID(str) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

// UUID를 Tidal 이미지 URL로 변환
function tidalImageUrl(uuid) {
    return `https://resources.tidal.com/images/${uuid.replace(/-/g, '/')}/640x640.jpg`
}

async function main() {
    // PMS 플레이리스트 중 cover_image가 UUID인 것들 조회
    const [playlists] = await pool.execute(`
        SELECT playlist_id, title, cover_image
        FROM playlists
        WHERE space_type = 'PMS'
        AND cover_image IS NOT NULL
        AND cover_image NOT LIKE '/images/%'
        AND cover_image NOT LIKE 'http%'
    `)

    console.log(`Found ${playlists.length} PMS playlists with UUID cover images`)

    let success = 0, failed = 0

    for (const p of playlists) {
        const filename = `playlist_${p.playlist_id}.jpg`
        const filepath = path.join(COVERS_DIR, filename)
        const localPath = `/images/covers/${filename}`

        // 이미 로컬 파일이 있으면 DB만 업데이트
        if (fs.existsSync(filepath)) {
            await pool.execute('UPDATE playlists SET cover_image = ? WHERE playlist_id = ?', [localPath, p.playlist_id])
            console.log(`✓ ${p.title} - file exists, updated DB`)
            success++
            continue
        }

        // UUID 형식 확인
        if (!isUUID(p.cover_image)) {
            console.log(`⚠️ ${p.title} - not a valid UUID: ${p.cover_image}`)
            failed++
            continue
        }

        // Tidal URL로 변환 후 다운로드
        const imageUrl = tidalImageUrl(p.cover_image)

        try {
            const downloaded = await downloadImage(imageUrl, filepath)
            if (downloaded) {
                await pool.execute('UPDATE playlists SET cover_image = ? WHERE playlist_id = ?', [localPath, p.playlist_id])
                console.log(`✅ ${p.title} - downloaded`)
                success++
            } else {
                console.log(`❌ ${p.title} - download failed`)
                failed++
            }
        } catch (e) {
            console.log(`❌ ${p.title} - error: ${e.message}`)
            failed++
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 100))
    }

    await pool.end()
    console.log(`\nDone! Success: ${success}, Failed: ${failed}`)
}

main().catch(console.error)
