
import { query, execute, insert } from './src/config/db.js';
import { fetchTidalPlaylistTracks } from './src/routes/tidal.js';

// We need to duplicate the fetchYoutubePlaylistTracks logic here since it's not exported from playlists.js
// Ideally we would refactor to export it, but for this script we will copy the improved version.
// Or we can modify playlists.js to export it. 
// Let's modify playlists.js to export likely reused functions first? 
// Actually, to keep it simple and safe, I will import the logic or just copy paste the core part if needed.
// Wait, I can't easily import from playlists.js if it's not exported. 
// Better approach: Copy the improved fetchYoutubePlaylistTracks here.

async function fetchYoutubePlaylistTracks(playlistId) {
    const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3'
    const apiKey = process.env.YOUTUBE_KEY

    if (!apiKey) return []

    try {
        let allItems = []
        let nextPageToken = ''
        const maxResults = 50

        do {
            const itemsUrl = new URL(`${YOUTUBE_API_URL}/playlistItems`)
            itemsUrl.searchParams.append('key', apiKey)
            itemsUrl.searchParams.append('part', 'snippet,contentDetails')
            itemsUrl.searchParams.append('playlistId', playlistId)
            itemsUrl.searchParams.append('maxResults', maxResults.toString())
            if (nextPageToken) {
                itemsUrl.searchParams.append('pageToken', nextPageToken)
            }

            const itemsRes = await fetch(itemsUrl.toString())
            if (!itemsRes.ok) break

            const itemsData = await itemsRes.json()
            const items = itemsData.items || []

            if (items.length === 0) break

            const videoIds = items
                .map(item => item.contentDetails?.videoId)
                .filter(Boolean)
                .join(',')

            let videoDetails = {}
            if (videoIds) {
                const videosUrl = new URL(`${YOUTUBE_API_URL}/videos`)
                videosUrl.searchParams.append('key', apiKey)
                videosUrl.searchParams.append('part', 'contentDetails,snippet')
                videosUrl.searchParams.append('id', videoIds)

                const videosRes = await fetch(videosUrl.toString())
                if (videosRes.ok) {
                    const videosData = await videosRes.json()
                    videoDetails = videosData.items.reduce((acc, video) => {
                        const match = video.contentDetails?.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
                        const duration = match
                            ? (parseInt(match[1] || 0) * 3600) + (parseInt(match[2] || 0) * 60) + (parseInt(match[3] || 0))
                            : 0
                        acc[video.id] = { duration, channelTitle: video.snippet?.channelTitle }
                        return acc
                    }, {})
                }
            }

            const processedItems = items.map((item, i) => {
                const videoId = item.contentDetails?.videoId
                const details = videoDetails[videoId] || {}
                return {
                    id: videoId,
                    title: item.snippet.title,
                    artist: details.channelTitle || item.snippet.videoOwnerChannelTitle || 'Unknown',
                    duration: details.duration || 0,
                    position: allItems.length + i,
                    thumbnail: item.snippet.thumbnails?.high?.url || ''
                }
            })

            allItems = allItems.concat(processedItems)
            nextPageToken = itemsData.nextPageToken

        } while (nextPageToken)

        return allItems
    } catch (error) {
        console.error('Error fetching YouTube tracks:', error)
        return []
    }
}

async function resyncAllPlaylists() {
    try {
        console.log('--- Starting Global Playlist Re-sync ---');

        // 1. Get all platform playlists
        const playlists = await query(`
            SELECT playlist_id, title, external_id, description 
            FROM playlists 
            WHERE source_type = 'Platform' AND external_id IS NOT NULL
        `);

        console.log(`Found ${playlists.length} playlists to sync.`);

        for (const p of playlists) {
            console.log(`\nProcessing: ${p.title} (ID: ${p.playlist_id}, Ext: ${p.external_id})`);

            let tracks = [];
            // Determine platform based on description or external_id format (simple heuristic)
            // Or better, check specific prefixes if available. 
            // In the seed script: Tidal UUIDs don't have prefix, YouTube likely does or we infer.
            // But verify: Tidal UUIDs are plain. iTunes IDs might differ.
            // A quick check: Tidal UUIDs are usually like '000...'. YouTube are usually longer.
            // Let's assume standard UUID format is Tidal, otherwise check description.

            const isTidal = /^[0-9a-fA-F-]{36}$/.test(p.external_id) || p.description?.includes("Tidal");
            const isYouTube = p.description?.includes("YouTube") || p.external_id.length > 20 && !p.external_id.includes('-'); // Rough guess

            // Actually, best to try Tidal first if it looks like UUID, else...
            // Wait, previous code imported with specific logic.
            // Let's rely on fetchTidalPlaylistTracks handling errors gracefully or returning empty if not found.
            // But we need a token for Tidal.

            // For Tidal, we need a token. Let's try to get a client token.
            // We can't easily get it here without importing more logic.
            // Let's use a dummy token logic or rely on the fact that fetchTidalPlaylistTracks inside tidal.js 
            // handles client token generation internally if we pass null/dummy? 
            // Looking at tidal.js: `tidalRequest` calls `getClientToken` if no token passed.
            // `fetchTidalPlaylistTracks` takes `token`.
            // We need to export `getClientToken` or just pass null and fail?
            // `fetchTidalPlaylistTracks` is exported but it REQUIRES a token.
            // Let's quickly peek at tidal.js again.
            // It uses `token` in headers. It DOES NOT auto-generate inside `fetchTidalPlaylistTracks`.
            // So we need to generate one.

            // Hack: Import getClientToken if exported? No.
            // We can manually fetch it here.

        }

    } catch (error) {
        console.error(error);
    }
}
