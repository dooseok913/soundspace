/**
 * 스트리밍 플랫폼 크롤러 서비스
 * - Spotify, Apple Music, YouTube Music, Tidal 에서 차트/인기곡 수집
 * - 이미지 로컬 저장
 * - DB 저장 (EMS 플레이리스트)
 */
import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { downloadTrackArtwork, downloadArtistImage, downloadPlaylistCover } from '../utils/imageDownloader.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 이미지 저장 디렉토리 (Docker에서는 /app/public, 로컬에서는 ../../../public)
const IMAGES_BASE = process.env.IMAGES_PATH || path.join(__dirname, '../../../public/images')
const ALBUMS_DIR = path.join(IMAGES_BASE, 'albums')
if (!fs.existsSync(ALBUMS_DIR)) fs.mkdirSync(ALBUMS_DIR, { recursive: true })

/**
 * HTTP/HTTPS GET 요청
 */
function fetchUrl(url, options = {}) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http
        const req = protocol.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...options.headers
            }
        }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                fetchUrl(res.headers.location, options).then(resolve).catch(reject)
                return
            }
            
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data))
                } catch {
                    resolve(data)
                }
            })
        })
        req.on('error', reject)
        req.setTimeout(30000, () => {
            req.destroy()
            reject(new Error('Request timeout'))
        })
    })
}

/**
 * 앨범 이미지 다운로드
 */
async function downloadAlbumArtwork(imageUrl, albumId, albumName = '') {
    if (!imageUrl || !imageUrl.startsWith('http')) return imageUrl
    
    try {
        // 파일명 안전하게 생성 (특수문자, 슬래시 제거)
        const safeId = String(albumId).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
        const safeName = String(albumName).replace(/[^a-zA-Z0-9가-힣]/g, '_').substring(0, 20)
        const filename = `album_${safeId}_${safeName}.jpg`
        const filepath = path.join(ALBUMS_DIR, filename)
        const localPath = `/images/albums/${filename}`
        
        // 디렉토리 확인
        if (!fs.existsSync(ALBUMS_DIR)) {
            fs.mkdirSync(ALBUMS_DIR, { recursive: true })
        }
        
        if (fs.existsSync(filepath)) return localPath
        
        await downloadFromUrlDirect(imageUrl, filepath)
        console.log(`✅ 앨범 이미지 다운로드: ${filename}`)
        return localPath
    } catch (err) {
        console.error(`❌ 앨범 이미지 다운로드 실패:`, err.message)
        return imageUrl  // 실패시 원본 URL 반환
    }
}

function downloadFromUrlDirect(url, filepath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http
        const file = fs.createWriteStream(filepath)
        
        protocol.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                file.close()
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
                downloadFromUrlDirect(response.headers.location, filepath).then(resolve).catch(reject)
                return
            }
            if (response.statusCode !== 200) {
                file.close()
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
                reject(new Error(`HTTP ${response.statusCode}`))
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

// ==================== Spotify 크롤러 ====================

export async function crawlSpotifyCharts(accessToken, limit = 50) {
    console.log('🎵 [Spotify] 차트 크롤링 시작...')
    const tracks = []
    
    try {
        // 1. Global Top 50 플레이리스트
        const globalTop50Id = '37i9dQZEVXbMDoHDwVN2tF'
        const viralGlobalId = '37i9dQZEVXbLiRSasKsNU9'
        const koreaTop50Id = '37i9dQZEVXbNxXF4SkHj9F'
        
        const playlistIds = [globalTop50Id, viralGlobalId, koreaTop50Id]
        
        for (const playlistId of playlistIds) {
            try {
                const response = await fetchUrl(
                    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}`,
                    { headers: { 'Authorization': `Bearer ${accessToken}` } }
                )
                
                if (response.items) {
                    for (const item of response.items) {
                        const track = item.track
                        if (!track) continue
                        
                        // 이미지 다운로드
                        let localArtwork = null
                        if (track.album?.images?.[0]?.url) {
                            localArtwork = await downloadAlbumArtwork(
                                track.album.images[0].url,
                                track.album.id,
                                track.album.name
                            )
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
                                spotify_uri: track.uri,
                                preview_url: track.preview_url,
                                album_id: track.album?.id,
                                artist_ids: track.artists?.map(a => a.id),
                                playlist_id: playlistId
                            }
                        })
                    }
                }
                console.log(`  ✅ Spotify 플레이리스트 ${playlistId}: ${response.items?.length || 0}곡`)
            } catch (err) {
                console.error(`  ❌ Spotify 플레이리스트 ${playlistId} 실패:`, err.message)
            }
        }
        
        // 2. New Releases
        try {
            const newReleases = await fetchUrl(
                `https://api.spotify.com/v1/browse/new-releases?limit=20&country=KR`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            )
            
            if (newReleases.albums?.items) {
                for (const album of newReleases.albums.items) {
                    // 앨범 트랙 가져오기
                    const albumTracks = await fetchUrl(
                        `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=10`,
                        { headers: { 'Authorization': `Bearer ${accessToken}` } }
                    )
                    
                    let localArtwork = null
                    if (album.images?.[0]?.url) {
                        localArtwork = await downloadAlbumArtwork(album.images[0].url, album.id, album.name)
                    }
                    
                    for (const track of (albumTracks.items || [])) {
                        tracks.push({
                            title: track.name,
                            artist: track.artists?.map(a => a.name).join(', ') || album.artists?.[0]?.name || 'Unknown',
                            album: album.name,
                            duration: Math.floor(track.duration_ms / 1000),
                            isrc: track.external_ids?.isrc || null,
                            spotify_id: track.id,
                            popularity: 0,
                            explicit: track.explicit ? 1 : 0,
                            release_date: album.release_date,
                            track_number: track.track_number || 1,
                            artwork_url: album.images?.[0]?.url || null,
                            local_artwork: localArtwork,
                            source: 'spotify',
                            external_metadata: {
                                spotify_id: track.id,
                                spotify_uri: track.uri,
                                preview_url: track.preview_url,
                                album_id: album.id
                            }
                        })
                    }
                }
                console.log(`  ✅ Spotify New Releases: ${newReleases.albums.items.length}개 앨범`)
            }
        } catch (err) {
            console.error('  ❌ Spotify New Releases 실패:', err.message)
        }
        
    } catch (err) {
        console.error('❌ [Spotify] 크롤링 실패:', err.message)
    }
    
    console.log(`🎵 [Spotify] 총 ${tracks.length}곡 수집 완료`)
    return tracks
}

// ==================== Apple Music 크롤러 ====================

export async function crawlAppleMusicCharts(developerToken, limit = 100) {
    console.log('🍎 [Apple Music] 차트 크롤링 시작...')
    const tracks = []
    
    const headers = {
        'Authorization': `Bearer ${developerToken}`,
        'Origin': 'https://music.apple.com'
    }
    
    try {
        // 1. Top Charts
        const charts = await fetchUrl(
            `https://api.music.apple.com/v1/catalog/kr/charts?types=songs&limit=${limit}`,
            { headers }
        )
        
        if (charts.results?.songs?.[0]?.data) {
            for (const song of charts.results.songs[0].data) {
                const attr = song.attributes
                
                let localArtwork = null
                if (attr.artwork?.url) {
                    const artworkUrl = attr.artwork.url.replace('{w}', '500').replace('{h}', '500')
                    localArtwork = await downloadAlbumArtwork(artworkUrl, song.id, attr.albumName || attr.name)
                }
                
                tracks.push({
                    title: attr.name,
                    artist: attr.artistName,
                    album: attr.albumName || '',
                    duration: Math.floor(attr.durationInMillis / 1000),
                    isrc: attr.isrc || null,
                    apple_music_id: song.id,
                    popularity: 0,
                    explicit: attr.contentRating === 'explicit' ? 1 : 0,
                    release_date: attr.releaseDate || null,
                    track_number: attr.trackNumber || 1,
                    artwork_url: attr.artwork?.url?.replace('{w}', '500').replace('{h}', '500') || null,
                    local_artwork: localArtwork,
                    source: 'apple_music',
                    genre: attr.genreNames?.join(', ') || '',
                    external_metadata: {
                        apple_music_id: song.id,
                        preview_url: attr.previews?.[0]?.url,
                        composer: attr.composerName,
                        genre_names: attr.genreNames
                    }
                })
            }
            console.log(`  ✅ Apple Music Top Charts: ${charts.results.songs[0].data.length}곡`)
        }
        
        // 2. Editorial Playlists
        const editorialIds = [
            'pl.5ee8333dbe944d9f9151e97d92d1ead9', // Today's Hits
            'pl.2b0e6e332fdf4b7a91164da3162127b5', // K-Pop Hits
            'pl.d25f5d1181894928af76c85c967f8f31', // New Music Daily
        ]
        
        for (const playlistId of editorialIds) {
            try {
                const playlist = await fetchUrl(
                    `https://api.music.apple.com/v1/catalog/kr/playlists/${playlistId}?include=tracks`,
                    { headers }
                )
                
                const playlistTracks = playlist.data?.[0]?.relationships?.tracks?.data || []
                
                for (const song of playlistTracks.slice(0, 50)) {
                    const attr = song.attributes
                    if (!attr) continue
                    
                    let localArtwork = null
                    if (attr.artwork?.url) {
                        const artworkUrl = attr.artwork.url.replace('{w}', '500').replace('{h}', '500')
                        localArtwork = await downloadAlbumArtwork(artworkUrl, song.id, attr.albumName || attr.name)
                    }
                    
                    tracks.push({
                        title: attr.name,
                        artist: attr.artistName,
                        album: attr.albumName || '',
                        duration: Math.floor((attr.durationInMillis || 0) / 1000),
                        isrc: attr.isrc || null,
                        apple_music_id: song.id,
                        popularity: 0,
                        explicit: attr.contentRating === 'explicit' ? 1 : 0,
                        release_date: attr.releaseDate || null,
                        track_number: attr.trackNumber || 1,
                        artwork_url: attr.artwork?.url?.replace('{w}', '500').replace('{h}', '500') || null,
                        local_artwork: localArtwork,
                        source: 'apple_music',
                        genre: attr.genreNames?.join(', ') || '',
                        external_metadata: {
                            apple_music_id: song.id,
                            preview_url: attr.previews?.[0]?.url,
                            playlist_id: playlistId
                        }
                    })
                }
                console.log(`  ✅ Apple Music 플레이리스트 ${playlistId}: ${playlistTracks.length}곡`)
            } catch (err) {
                console.error(`  ❌ Apple Music 플레이리스트 ${playlistId} 실패:`, err.message)
            }
        }
        
    } catch (err) {
        console.error('❌ [Apple Music] 크롤링 실패:', err.message)
    }
    
    console.log(`🍎 [Apple Music] 총 ${tracks.length}곡 수집 완료`)
    return tracks
}

// ==================== YouTube Music 크롤러 ====================

export async function crawlYouTubeMusic(apiKey, limit = 50) {
    console.log('📺 [YouTube Music] 크롤링 시작...')
    const tracks = []
    
    try {
        // YouTube Data API로 음악 차트/인기 영상 검색
        const searchQueries = [
            'music chart 2024',
            'kpop music video',
            'top hits playlist',
            'new music releases'
        ]
        
        for (const query of searchQueries) {
            try {
                const response = await fetchUrl(
                    `https://www.googleapis.com/youtube/v3/search?` +
                    `part=snippet&type=video&videoCategoryId=10&maxResults=${limit}` +
                    `&q=${encodeURIComponent(query)}&key=${apiKey}`
                )
                
                if (response.items) {
                    for (const item of response.items) {
                        const snippet = item.snippet
                        
                        // 비디오 상세 정보 (duration)
                        let duration = 180 // 기본값 3분
                        try {
                            const videoDetail = await fetchUrl(
                                `https://www.googleapis.com/youtube/v3/videos?` +
                                `part=contentDetails&id=${item.id.videoId}&key=${apiKey}`
                            )
                            if (videoDetail.items?.[0]?.contentDetails?.duration) {
                                duration = parseDuration(videoDetail.items[0].contentDetails.duration)
                            }
                        } catch {}
                        
                        // 썸네일 다운로드
                        let localArtwork = null
                        const thumbnailUrl = snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url
                        if (thumbnailUrl) {
                            localArtwork = await downloadAlbumArtwork(
                                thumbnailUrl,
                                item.id.videoId,
                                snippet.title
                            )
                        }
                        
                        // 제목에서 아티스트 - 곡명 파싱
                        const { artist, title } = parseYouTubeTitle(snippet.title)
                        
                        tracks.push({
                            title: title,
                            artist: artist || snippet.channelTitle,
                            album: '',
                            duration: duration,
                            isrc: null,
                            youtube_id: item.id.videoId,
                            popularity: 0,
                            explicit: 0,
                            release_date: snippet.publishedAt?.split('T')[0] || null,
                            track_number: 1,
                            artwork_url: thumbnailUrl,
                            local_artwork: localArtwork,
                            source: 'youtube',
                            external_metadata: {
                                youtube_id: item.id.videoId,
                                channel_id: snippet.channelId,
                                channel_title: snippet.channelTitle,
                                description: snippet.description?.substring(0, 500)
                            }
                        })
                    }
                }
                console.log(`  ✅ YouTube 검색 "${query}": ${response.items?.length || 0}개`)
            } catch (err) {
                console.error(`  ❌ YouTube 검색 "${query}" 실패:`, err.message)
            }
        }
        
    } catch (err) {
        console.error('❌ [YouTube Music] 크롤링 실패:', err.message)
    }
    
    console.log(`📺 [YouTube Music] 총 ${tracks.length}곡 수집 완료`)
    return tracks
}

// ISO 8601 duration 파싱 (PT3M45S -> 225초)
function parseDuration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return 180
    const hours = parseInt(match[1] || 0)
    const minutes = parseInt(match[2] || 0)
    const seconds = parseInt(match[3] || 0)
    return hours * 3600 + minutes * 60 + seconds
}

// YouTube 제목에서 아티스트 - 곡명 파싱
function parseYouTubeTitle(title) {
    // 패턴: "아티스트 - 곡명", "아티스트 '곡명'", "아티스트 「곡명」" 등
    const patterns = [
        /^(.+?)\s*[-–—]\s*(.+?)(?:\s*[\(\[].*[\)\]])?$/,
        /^(.+?)\s*['"「『](.+?)['"」』]/,
        /^(.+?)\s*:\s*(.+?)$/
    ]
    
    for (const pattern of patterns) {
        const match = title.match(pattern)
        if (match) {
            return { artist: match[1].trim(), title: match[2].trim() }
        }
    }
    
    // 매칭 실패시 전체를 제목으로
    return { artist: '', title: title.replace(/\s*[\(\[].*[\)\]]$/, '').trim() }
}

// ==================== Tidal 크롤러 ====================

export async function crawlTidal(accessToken, countryCode = 'KR', limit = 50) {
    console.log('🌊 [Tidal] 크롤링 시작...')
    const tracks = []
    
    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'x-tidal-token': process.env.TIDAL_CLIENT_ID || ''
    }
    
    try {
        // 1. Top Tracks
        try {
            const topTracks = await fetchUrl(
                `https://api.tidal.com/v1/charts/tracks?countryCode=${countryCode}&limit=${limit}`,
                { headers }
            )
            
            if (topTracks.items) {
                for (const item of topTracks.items) {
                    const track = item.item || item
                    
                    let localArtwork = null
                    if (track.album?.cover) {
                        const artworkUrl = `https://resources.tidal.com/images/${track.album.cover.replace(/-/g, '/')}/640x640.jpg`
                        localArtwork = await downloadAlbumArtwork(artworkUrl, track.album.id, track.album.title)
                    }
                    
                    tracks.push({
                        title: track.title,
                        artist: track.artists?.map(a => a.name).join(', ') || track.artist?.name || 'Unknown',
                        album: track.album?.title || '',
                        duration: track.duration || 0,
                        isrc: track.isrc || null,
                        tidal_id: track.id,
                        popularity: track.popularity || 0,
                        explicit: track.explicit ? 1 : 0,
                        release_date: track.streamStartDate?.split('T')[0] || null,
                        track_number: track.trackNumber || 1,
                        artwork_url: track.album?.cover ? 
                            `https://resources.tidal.com/images/${track.album.cover.replace(/-/g, '/')}/640x640.jpg` : null,
                        local_artwork: localArtwork,
                        source: 'tidal',
                        external_metadata: {
                            tidal_id: track.id,
                            album_id: track.album?.id,
                            audio_quality: track.audioQuality,
                            media_metadata: track.mediaMetadata
                        }
                    })
                }
                console.log(`  ✅ Tidal Top Tracks: ${topTracks.items.length}곡`)
            }
        } catch (err) {
            console.error('  ❌ Tidal Top Tracks 실패:', err.message)
        }
        
        // 2. New Albums
        try {
            const newAlbums = await fetchUrl(
                `https://api.tidal.com/v1/charts/albums?countryCode=${countryCode}&limit=20`,
                { headers }
            )
            
            if (newAlbums.items) {
                for (const item of newAlbums.items) {
                    const album = item.item || item
                    
                    // 앨범 트랙 가져오기
                    try {
                        const albumTracks = await fetchUrl(
                            `https://api.tidal.com/v1/albums/${album.id}/tracks?countryCode=${countryCode}&limit=10`,
                            { headers }
                        )
                        
                        let localArtwork = null
                        if (album.cover) {
                            const artworkUrl = `https://resources.tidal.com/images/${album.cover.replace(/-/g, '/')}/640x640.jpg`
                            localArtwork = await downloadAlbumArtwork(artworkUrl, album.id, album.title)
                        }
                        
                        for (const track of (albumTracks.items || [])) {
                            tracks.push({
                                title: track.title,
                                artist: track.artists?.map(a => a.name).join(', ') || album.artist?.name || 'Unknown',
                                album: album.title,
                                duration: track.duration || 0,
                                isrc: track.isrc || null,
                                tidal_id: track.id,
                                popularity: track.popularity || 0,
                                explicit: track.explicit ? 1 : 0,
                                release_date: album.releaseDate || null,
                                track_number: track.trackNumber || 1,
                                artwork_url: album.cover ?
                                    `https://resources.tidal.com/images/${album.cover.replace(/-/g, '/')}/640x640.jpg` : null,
                                local_artwork: localArtwork,
                                source: 'tidal',
                                external_metadata: {
                                    tidal_id: track.id,
                                    album_id: album.id,
                                    audio_quality: track.audioQuality
                                }
                            })
                        }
                    } catch {}
                }
                console.log(`  ✅ Tidal New Albums: ${newAlbums.items.length}개 앨범`)
            }
        } catch (err) {
            console.error('  ❌ Tidal New Albums 실패:', err.message)
        }
        
    } catch (err) {
        console.error('❌ [Tidal] 크롤링 실패:', err.message)
    }
    
    console.log(`🌊 [Tidal] 총 ${tracks.length}곡 수집 완료`)
    return tracks
}

// ==================== iTunes Search API 크롤러 ====================

export async function crawlITunes(searchTerms = ['kpop', 'pop', 'rock', 'hip-hop', 'r&b', 'jazz', 'classical'], limit = 50) {
    console.log('🎵 [iTunes] 크롤링 시작...')
    const tracks = []
    
    try {
        for (const term of searchTerms) {
            try {
                const response = await fetchUrl(
                    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}&country=kr`
                )
                
                if (response.results) {
                    for (const track of response.results) {
                        let localArtwork = null
                        if (track.artworkUrl100) {
                            const artworkUrl = track.artworkUrl100.replace('100x100', '500x500')
                            localArtwork = await downloadAlbumArtwork(artworkUrl, track.trackId, track.collectionName)
                        }
                        
                        tracks.push({
                            title: track.trackName,
                            artist: track.artistName,
                            album: track.collectionName || '',
                            duration: Math.floor(track.trackTimeMillis / 1000),
                            isrc: null,
                            itunes_id: track.trackId,
                            popularity: 0,
                            explicit: track.trackExplicitness === 'explicit' ? 1 : 0,
                            release_date: track.releaseDate?.split('T')[0] || null,
                            track_number: track.trackNumber || 1,
                            artwork_url: track.artworkUrl100?.replace('100x100', '500x500') || null,
                            local_artwork: localArtwork,
                            source: 'itunes',
                            genre: track.primaryGenreName || '',
                            external_metadata: {
                                itunes_id: track.trackId,
                                collection_id: track.collectionId,
                                artist_id: track.artistId,
                                preview_url: track.previewUrl,
                                track_view_url: track.trackViewUrl
                            }
                        })
                    }
                }
                console.log(`  ✅ iTunes 검색 "${term}": ${response.results?.length || 0}곡`)
                
                // Rate limit 방지
                await new Promise(r => setTimeout(r, 500))
            } catch (err) {
                console.error(`  ❌ iTunes 검색 "${term}" 실패:`, err.message)
            }
        }
    } catch (err) {
        console.error('❌ [iTunes] 크롤링 실패:', err.message)
    }
    
    console.log(`🎵 [iTunes] 총 ${tracks.length}곡 수집 완료`)
    return tracks
}

// ==================== Last.fm Top Charts 크롤러 ====================

export async function crawlLastfmCharts(apiKey, limit = 100) {
    console.log('📻 [Last.fm] 차트 크롤링 시작...')
    const tracks = []
    
    try {
        // 1. Global Top Tracks
        const topTracks = await fetchUrl(
            `http://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=${apiKey}&format=json&limit=${limit}`
        )
        
        if (topTracks.tracks?.track) {
            for (const track of topTracks.tracks.track) {
                let localArtwork = null
                const artworkUrl = track.image?.find(i => i.size === 'extralarge')?.['#text']
                if (artworkUrl && artworkUrl.length > 0) {
                    localArtwork = await downloadAlbumArtwork(artworkUrl, track.mbid || track.name, track.name)
                }
                
                tracks.push({
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
                    local_artwork: localArtwork,
                    source: 'lastfm',
                    playcount: parseInt(track.playcount) || 0,
                    listeners: parseInt(track.listeners) || 0,
                    external_metadata: {
                        lastfm_url: track.url,
                        mbid: track.mbid,
                        playcount: track.playcount,
                        listeners: track.listeners
                    }
                })
            }
            console.log(`  ✅ Last.fm Top Tracks: ${topTracks.tracks.track.length}곡`)
        }
        
        // 2. Top by Tags (장르별)
        const tags = ['k-pop', 'pop', 'rock', 'hip-hop', 'electronic', 'jazz']
        
        for (const tag of tags) {
            try {
                const tagTracks = await fetchUrl(
                    `http://ws.audioscrobbler.com/2.0/?method=tag.gettoptracks&tag=${encodeURIComponent(tag)}&api_key=${apiKey}&format=json&limit=30`
                )
                
                if (tagTracks.tracks?.track) {
                    for (const track of tagTracks.tracks.track) {
                        let localArtwork = null
                        const artworkUrl = track.image?.find(i => i.size === 'extralarge')?.['#text']
                        if (artworkUrl && artworkUrl.length > 0) {
                            localArtwork = await downloadAlbumArtwork(artworkUrl, track.mbid || `${track.artist.name}_${track.name}`, track.name)
                        }
                        
                        tracks.push({
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
                            local_artwork: localArtwork,
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
                }
                console.log(`  ✅ Last.fm Tag "${tag}": ${tagTracks.tracks?.track?.length || 0}곡`)
                
                await new Promise(r => setTimeout(r, 300))
            } catch (err) {
                console.error(`  ❌ Last.fm Tag "${tag}" 실패:`, err.message)
            }
        }
        
    } catch (err) {
        console.error('❌ [Last.fm] 크롤링 실패:', err.message)
    }
    
    console.log(`📻 [Last.fm] 총 ${tracks.length}곡 수집 완료`)
    return tracks
}

// ==================== 통합 크롤러 ====================

export async function crawlAllPlatforms(tokens = {}) {
    console.log('🚀 전체 플랫폼 크롤링 시작...')
    console.log('=' .repeat(60))
    
    const allTracks = []
    
    // iTunes (API 키 불필요)
    const itunesTracks = await crawlITunes()
    allTracks.push(...itunesTracks)
    
    // Last.fm
    if (tokens.lastfmApiKey) {
        const lastfmTracks = await crawlLastfmCharts(tokens.lastfmApiKey)
        allTracks.push(...lastfmTracks)
    }
    
    // Spotify
    if (tokens.spotifyAccessToken) {
        const spotifyTracks = await crawlSpotifyCharts(tokens.spotifyAccessToken)
        allTracks.push(...spotifyTracks)
    }
    
    // Apple Music
    if (tokens.appleMusicToken) {
        const appleTracks = await crawlAppleMusicCharts(tokens.appleMusicToken)
        allTracks.push(...appleTracks)
    }
    
    // YouTube
    if (tokens.youtubeApiKey) {
        const youtubeTracks = await crawlYouTubeMusic(tokens.youtubeApiKey)
        allTracks.push(...youtubeTracks)
    }
    
    // Tidal
    if (tokens.tidalAccessToken) {
        const tidalTracks = await crawlTidal(tokens.tidalAccessToken)
        allTracks.push(...tidalTracks)
    }
    
    console.log('=' .repeat(60))
    console.log(`🎉 전체 크롤링 완료: 총 ${allTracks.length}곡 수집`)
    
    return allTracks
}

export default {
    crawlSpotifyCharts,
    crawlAppleMusicCharts,
    crawlYouTubeMusic,
    crawlTidal,
    crawlITunes,
    crawlLastfmCharts,
    crawlAllPlatforms
}
