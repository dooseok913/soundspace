import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const COVERS_DIR = path.join(__dirname, '../../../public/images/covers')
const TRACKS_DIR = path.join(__dirname, '../../../public/images/tracks')
const ARTISTS_DIR = path.join(__dirname, '../../../public/images/artists')

// 폴더 생성
if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true })
if (!fs.existsSync(TRACKS_DIR)) fs.mkdirSync(TRACKS_DIR, { recursive: true })
if (!fs.existsSync(ARTISTS_DIR)) fs.mkdirSync(ARTISTS_DIR, { recursive: true })

/**
 * 외부 URL에서 이미지 다운로드
 */
function downloadFromUrl(url, filepath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http
        const file = fs.createWriteStream(filepath)

        protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                file.close()
                fs.unlinkSync(filepath)
                downloadFromUrl(response.headers.location, filepath)
                    .then(resolve)
                    .catch(reject)
                return
            }

            if (response.statusCode !== 200) {
                file.close()
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
                reject(new Error(`HTTP ${response.statusCode}`))
                return
            }

            response.pipe(file)
            file.on('finish', () => {
                file.close()
                resolve(true)
            })
        }).on('error', (err) => {
            file.close()
            if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
            reject(err)
        })
    })
}

/**
 * 플레이리스트 커버 이미지 다운로드
 * @param {string} imageUrl - 외부 이미지 URL
 * @param {number} playlistId - 플레이리스트 ID
 * @returns {string|null} - 로컬 경로 또는 null
 */
export async function downloadPlaylistCover(imageUrl, playlistId) {
    if (!imageUrl || !imageUrl.startsWith('http')) {
        return imageUrl // 이미 로컬이거나 없음
    }

    try {
        const filename = `playlist_${playlistId}.jpg`
        const filepath = path.join(COVERS_DIR, filename)
        const localPath = `/images/covers/${filename}`

        // 이미 존재하면 스킵
        if (fs.existsSync(filepath)) {
            return localPath
        }

        await downloadFromUrl(imageUrl, filepath)
        console.log(`✅ 플레이리스트 이미지 다운로드: ${filename}`)
        return localPath
    } catch (err) {
        console.error(`❌ 플레이리스트 이미지 다운로드 실패 [${playlistId}]:`, err.message)
        return imageUrl // 실패시 원본 URL 유지
    }
}

/**
 * 트랙 아트워크 이미지 다운로드
 * @param {string} imageUrl - 외부 이미지 URL
 * @param {number} trackId - 트랙 ID
 * @returns {string|null} - 로컬 경로 또는 null
 */
export async function downloadTrackArtwork(imageUrl, trackId) {
    if (!imageUrl || !imageUrl.startsWith('http')) {
        return imageUrl
    }

    try {
        const filename = `track_${trackId}.jpg`
        const filepath = path.join(TRACKS_DIR, filename)
        const localPath = `/images/tracks/${filename}`

        if (fs.existsSync(filepath)) {
            return localPath
        }

        await downloadFromUrl(imageUrl, filepath)
        console.log(`✅ 트랙 이미지 다운로드: ${filename}`)
        return localPath
    } catch (err) {
        console.error(`❌ 트랙 이미지 다운로드 실패 [${trackId}]:`, err.message)
        return imageUrl
    }
}

/**
 * 아티스트 이미지 다운로드
 * @param {string} imageUrl - 외부 이미지 URL (Spotify 등)
 * @param {number|string} artistId - 아티스트 ID
 * @param {string} artistName - 아티스트 이름 (파일명 생성용)
 * @returns {string|null} - 로컬 경로 또는 null
 */
export async function downloadArtistImage(imageUrl, artistId, artistName = '') {
    if (!imageUrl || !imageUrl.startsWith('http')) {
        return imageUrl
    }

    try {
        // 파일명: artist_{id}_{sanitized_name}.jpg
        const safeName = artistName.replace(/[^a-zA-Z0-9가-힣]/g, '_').substring(0, 30)
        const filename = `artist_${artistId}_${safeName}.jpg`
        const filepath = path.join(ARTISTS_DIR, filename)
        const localPath = `/images/artists/${filename}`

        if (fs.existsSync(filepath)) {
            return localPath
        }

        await downloadFromUrl(imageUrl, filepath)
        console.log(`✅ 아티스트 이미지 다운로드: ${filename}`)
        return localPath
    } catch (err) {
        console.error(`❌ 아티스트 이미지 다운로드 실패 [${artistName}]:`, err.message)
        return imageUrl // 실패시 원본 URL 유지
    }
}

export default {
    downloadPlaylistCover,
    downloadTrackArtwork,
    downloadArtistImage
}
