import mysql from 'mysql2/promise'
import https from 'https'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const IMAGES_DIR = path.join(process.cwd(), '..', 'public', 'images', 'tracks')
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'music_space_db',
    connectionLimit: 5
})

// 폴더 생성
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true })
}

function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath)
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                file.close()
                fs.unlinkSync(filepath)
                downloadImage(response.headers.location, filepath).then(resolve).catch(reject)
                return
            }
            if (response.statusCode !== 200) {
                file.close()
                fs.unlinkSync(filepath)
                reject(new Error('Failed: ' + response.statusCode))
                return
            }
            response.pipe(file)
            file.on('finish', () => { file.close(); resolve(true) })
        }).on('error', (err) => {
            file.close()
            if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
            reject(err)
        })
    })
}

async function main() {
    console.log('🚀 트랙 이미지 다운로드 시작...')

    // 이미지 URL이 있는 트랙 조회
    const [rows] = await pool.execute(`
        SELECT track_id, external_metadata
        FROM tracks
        WHERE external_metadata LIKE '%artwork%'
           OR external_metadata LIKE '%thumbnail%'
    `)

    console.log(`📦 총 ${rows.length}개 트랙에 이미지 발견`)

    let successCount = 0
    let skipCount = 0
    let failCount = 0

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        let metadata
        try {
            metadata = JSON.parse(row.external_metadata)
        } catch {
            continue
        }

        // artwork 또는 thumbnail 찾기
        let imageUrl = metadata.artwork || metadata.thumbnail
        if (!imageUrl || !imageUrl.startsWith('http')) {
            continue
        }

        const filename = `track_${row.track_id}.jpg`
        const filepath = path.join(IMAGES_DIR, filename)
        const localPath = `/images/tracks/${filename}`

        // 이미 다운로드된 파일 스킵
        if (fs.existsSync(filepath)) {
            // 경로만 업데이트
            metadata.artwork = localPath
            if (metadata.thumbnail) metadata.thumbnail = localPath
            await pool.execute(
                'UPDATE tracks SET external_metadata = ? WHERE track_id = ?',
                [JSON.stringify(metadata), row.track_id]
            )
            skipCount++
            if (skipCount % 500 === 0) console.log(`⏭️  ${skipCount}개 스킵됨...`)
            continue
        }

        try {
            await downloadImage(imageUrl, filepath)

            // metadata 업데이트
            metadata.artwork = localPath
            if (metadata.thumbnail) metadata.thumbnail = localPath
            await pool.execute(
                'UPDATE tracks SET external_metadata = ? WHERE track_id = ?',
                [JSON.stringify(metadata), row.track_id]
            )

            successCount++
            if (successCount % 100 === 0) {
                console.log(`✅ ${successCount}개 완료... (${i + 1}/${rows.length})`)
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 50))
        } catch (err) {
            failCount++
            if (failCount <= 10) {
                console.log(`❌ [${row.track_id}] 실패: ${err.message}`)
            }
        }
    }

    console.log('\n🎉 완료!')
    console.log(`✅ 다운로드 성공: ${successCount}개`)
    console.log(`⏭️  스킵 (이미 존재): ${skipCount}개`)
    console.log(`❌ 실패: ${failCount}개`)

    await pool.end()
}

main().catch(console.error)
