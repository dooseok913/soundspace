import mysql from 'mysql2/promise'
import https from 'https'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const IMAGES_DIR = path.join(process.cwd(), '..', 'public', 'images', 'covers')
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'music_space_db'
})

function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath)
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadImage(response.headers.location, filepath).then(resolve).catch(reject)
                return
            }
            if (response.statusCode !== 200) {
                reject(new Error('Failed: ' + response.statusCode))
                return
            }
            response.pipe(file)
            file.on('finish', () => { file.close(); resolve(true) })
        }).on('error', reject)
    })
}

async function main() {
    const [rows] = await pool.execute("SELECT playlist_id, cover_image FROM playlists WHERE cover_image LIKE 'http%'")
    console.log('다운로드할 이미지:', rows.length)

    for (const row of rows) {
        const filename = 'playlist_' + row.playlist_id + '.jpg'
        const filepath = path.join(IMAGES_DIR, filename)
        const localPath = '/images/covers/' + filename

        try {
            await downloadImage(row.cover_image, filepath)
            await pool.execute('UPDATE playlists SET cover_image = ? WHERE playlist_id = ?', [localPath, row.playlist_id])
            console.log('✅ 완료:', row.playlist_id, filename)
        } catch (e) {
            console.log('❌ 실패:', row.playlist_id, e.message)
        }
    }

    await pool.end()
    console.log('Done!')
}

main()
