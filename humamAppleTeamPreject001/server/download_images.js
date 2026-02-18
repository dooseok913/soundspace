import mysql from 'mysql2/promise'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 이미지 저장 경로
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'covers')

// DB 연결
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'music_space_db',
    waitForConnections: true,
    connectionLimit: 10
})

// 이미지 다운로드 함수
function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath)
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // 리다이렉트 처리
                downloadImage(response.headers.location, filepath)
                    .then(resolve)
                    .catch(reject)
                return
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`))
                return
            }
            response.pipe(file)
            file.on('finish', () => {
                file.close()
                resolve(true)
            })
        }).on('error', (err) => {
            fs.unlink(filepath, () => {})
            reject(err)
        })
    })
}

// URL에서 파일명 생성
function generateFilename(playlistId, url) {
    const ext = path.extname(url.split('?')[0]) || '.jpg'
    return `playlist_${playlistId}${ext}`
}

async function main() {
    console.log('🚀 이미지 다운로드 시작...')

    // 이미지 폴더 확인
    if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true })
    }

    try {
        // DB에서 이미지 URL 조회
        const [playlists] = await pool.execute(
            'SELECT playlist_id, cover_image FROM playlists WHERE cover_image IS NOT NULL AND cover_image LIKE "http%"'
        )

        console.log(`📦 총 ${playlists.length}개의 이미지 발견`)

        let successCount = 0
        let failCount = 0
        const updates = []

        for (const playlist of playlists) {
            const { playlist_id, cover_image } = playlist
            const filename = generateFilename(playlist_id, cover_image)
            const filepath = path.join(IMAGES_DIR, filename)
            const localPath = `/images/covers/${filename}`

            try {
                // 이미 다운로드된 파일 스킵
                if (fs.existsSync(filepath)) {
                    console.log(`⏭️  [${playlist_id}] 이미 존재: ${filename}`)
                    updates.push({ playlist_id, localPath })
                    successCount++
                    continue
                }

                console.log(`⬇️  [${playlist_id}] 다운로드 중: ${cover_image.substring(0, 50)}...`)
                await downloadImage(cover_image, filepath)
                console.log(`✅ [${playlist_id}] 완료: ${filename}`)
                updates.push({ playlist_id, localPath })
                successCount++

                // Rate limiting - 100ms 대기
                await new Promise(resolve => setTimeout(resolve, 100))
            } catch (err) {
                console.error(`❌ [${playlist_id}] 실패: ${err.message}`)
                failCount++
            }
        }

        // DB 경로 업데이트
        console.log('\n📝 데이터베이스 경로 업데이트 중...')
        for (const { playlist_id, localPath } of updates) {
            await pool.execute(
                'UPDATE playlists SET cover_image = ? WHERE playlist_id = ?',
                [localPath, playlist_id]
            )
        }

        console.log('\n🎉 완료!')
        console.log(`✅ 성공: ${successCount}개`)
        console.log(`❌ 실패: ${failCount}개`)

    } catch (err) {
        console.error('오류 발생:', err)
    } finally {
        await pool.end()
    }
}

main()
