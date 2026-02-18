import express from 'express'
import crypto from 'crypto'
import { query, queryOne, execute } from '../config/db.js'

const router = express.Router()

// Google OAuth Configuration
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3'

// In-memory token storage
let userTokens = {} // { visitorId: { accessToken, refreshToken, expiresAt } }
let stateStore = {} // { state: { codeVerifier, visitorId } }

// PKCE Helper Functions
function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url')
}

function generateCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url')
}

function generateState() {
    return crypto.randomBytes(16).toString('hex')
}

// Get redirect URI based on environment
function getRedirectUri(req) {
    // 환경 변수가 있으면 사용, 없으면 localhost 고정
    if (process.env.YOUTUBE_REDIRECT_URI) {
        return process.env.YOUTUBE_REDIRECT_URI
    }
    // Docker 환경에서는 항상 port 80 사용
    return 'http://localhost/youtube-callback'
}

// Refresh access token
async function refreshAccessToken(refreshToken) {
    const clientId = process.env.YOUTUBE_CLIENT_ID
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET

    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        })
    })

    if (!response.ok) {
        throw new Error('Failed to refresh token')
    }

    return response.json()
}

// Get valid access token
async function getValidToken(visitorId) {
    const tokens = userTokens[visitorId]
    if (!tokens) return null

    if (Date.now() >= tokens.expiresAt - 60000) {
        try {
            const newTokens = await refreshAccessToken(tokens.refreshToken)
            userTokens[visitorId] = {
                accessToken: newTokens.access_token,
                refreshToken: newTokens.refresh_token || tokens.refreshToken,
                expiresAt: Date.now() + (newTokens.expires_in * 1000)
            }
            return userTokens[visitorId].accessToken
        } catch (error) {
            console.error('[YouTube] Token refresh failed:', error)
            delete userTokens[visitorId]
            return null
        }
    }

    return tokens.accessToken
}

// YouTube API request helper
async function youtubeRequest(endpoint, accessToken, params = {}) {
    const url = new URL(`${YOUTUBE_API_URL}${endpoint}`)
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.append(key, value)
    })

    const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    if (!response.ok) {
        const error = await response.text()
        console.error(`[YouTube] API Error: ${response.status}`, error)
        throw new Error(`YouTube API error: ${response.status}`)
    }

    return response.json()
}

// GET /api/youtube-music/auth/login - Get Google OAuth URL
router.get('/auth/login', (req, res) => {
    const clientId = process.env.YOUTUBE_CLIENT_ID
    const { visitorId } = req.query

    if (!clientId) {
        return res.status(503).json({ error: 'YouTube client ID not configured' })
    }

    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const state = generateState()

    stateStore[state] = { codeVerifier, visitorId }

    // Scopes for YouTube Music
    const scopes = [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' ')

    const redirectUri = getRedirectUri(req)

    const authUrl = new URL(GOOGLE_AUTH_URL)
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('scope', scopes)
    authUrl.searchParams.append('state', state)
    authUrl.searchParams.append('code_challenge_method', 'S256')
    authUrl.searchParams.append('code_challenge', codeChallenge)
    authUrl.searchParams.append('access_type', 'offline')
    authUrl.searchParams.append('prompt', 'consent')

    res.json({ authUrl: authUrl.toString() })
})

// POST /api/youtube-music/auth/exchange - Exchange code for tokens
router.post('/auth/exchange', async (req, res) => {
    try {
        const { code, state, redirectUri } = req.body
        const clientId = process.env.YOUTUBE_CLIENT_ID
        const clientSecret = process.env.YOUTUBE_CLIENT_SECRET

        if (!code || !state) {
            return res.status(400).json({ success: false, error: 'Missing code or state' })
        }

        const stored = stateStore[state]
        if (!stored) {
            return res.status(400).json({ success: false, error: 'Invalid state. Please restart login.' })
        }

        const { codeVerifier, visitorId } = stored
        delete stateStore[state]

        const response = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                code_verifier: codeVerifier
            })
        })

        const data = await response.json()

        if (data.error) {
            console.error('[YouTube] Token exchange error:', data)
            return res.status(400).json({ success: false, error: data.error_description || data.error })
        }

        const tokenKey = visitorId || 'default'
        userTokens[tokenKey] = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + (data.expires_in * 1000)
        }

        // Get user profile
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${data.access_token}` }
        })
        const profile = await profileRes.json()

        res.json({
            success: true,
            user: {
                id: profile.id,
                name: profile.name,
                picture: profile.picture
            },
            visitorId: tokenKey
        })
    } catch (error) {
        console.error('[YouTube] Exchange error:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

// GET /api/youtube-music/auth/status - Check auth status
router.get('/auth/status', async (req, res) => {
    const { visitorId } = req.query
    const tokenKey = visitorId || 'default'

    try {
        const accessToken = await getValidToken(tokenKey)

        if (!accessToken) {
            return res.json({ connected: false })
        }

        // Verify by getting channel info
        const data = await youtubeRequest('/channels', accessToken, {
            part: 'snippet',
            mine: 'true'
        })

        const channel = data.items?.[0]

        res.json({
            connected: true,
            user: channel ? {
                id: channel.id,
                name: channel.snippet?.title,
                picture: channel.snippet?.thumbnails?.default?.url
            } : null
        })
    } catch (error) {
        res.json({ connected: false, error: error.message })
    }
})

// POST /api/youtube-music/auth/logout
router.post('/auth/logout', (req, res) => {
    const { visitorId } = req.body
    const tokenKey = visitorId || 'default'
    delete userTokens[tokenKey]
    res.json({ success: true })
})

// GET /api/youtube-music/playlists - Get user's playlists
router.get('/playlists', async (req, res) => {
    const { visitorId, maxResults = 50, pageToken } = req.query
    const tokenKey = visitorId || 'default'

    try {
        const accessToken = await getValidToken(tokenKey)
        if (!accessToken) {
            return res.status(401).json({ error: 'Not authenticated. Please connect YouTube first.' })
        }

        const params = {
            part: 'snippet,contentDetails',
            mine: 'true',
            maxResults
        }
        if (pageToken) params.pageToken = pageToken

        const data = await youtubeRequest('/playlists', accessToken, params)

        const playlists = (data.items || []).map(p => ({
            id: p.id,
            name: p.snippet?.title,
            description: p.snippet?.description,
            image: p.snippet?.thumbnails?.high?.url || p.snippet?.thumbnails?.medium?.url,
            trackCount: p.contentDetails?.itemCount || 0,
            publishedAt: p.snippet?.publishedAt
        }))

        res.json({
            playlists,
            total: data.pageInfo?.totalResults || playlists.length,
            nextPageToken: data.nextPageToken,
            prevPageToken: data.prevPageToken
        })
    } catch (error) {
        console.error('[YouTube] Playlists error:', error)
        res.status(500).json({ error: error.message })
    }
})

// GET /api/youtube-music/playlists/:id/items - Get playlist items
router.get('/playlists/:id/items', async (req, res) => {
    const { id } = req.params
    const { visitorId, maxResults = 50, pageToken } = req.query
    const tokenKey = visitorId || 'default'

    try {
        const accessToken = await getValidToken(tokenKey)
        if (!accessToken) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const params = {
            part: 'snippet,contentDetails',
            playlistId: id,
            maxResults
        }
        if (pageToken) params.pageToken = pageToken

        const data = await youtubeRequest('/playlistItems', accessToken, params)

        const tracks = (data.items || [])
            .filter(item => item.snippet?.resourceId?.videoId) // Filter out deleted videos
            .map(item => ({
                videoId: item.snippet.resourceId.videoId,
                title: item.snippet.title,
                channelTitle: item.snippet.videoOwnerChannelTitle,
                thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url,
                description: item.snippet.description,
                publishedAt: item.contentDetails?.videoPublishedAt,
                position: item.snippet.position
            }))

        res.json({
            tracks,
            total: data.pageInfo?.totalResults || tracks.length,
            nextPageToken: data.nextPageToken,
            hasMore: !!data.nextPageToken
        })
    } catch (error) {
        console.error('[YouTube] Playlist items error:', error)
        res.status(500).json({ error: error.message })
    }
})

// GET /api/youtube-music/liked - Get liked videos (music)
router.get('/liked', async (req, res) => {
    const { visitorId, maxResults = 50, pageToken } = req.query
    const tokenKey = visitorId || 'default'

    try {
        const accessToken = await getValidToken(tokenKey)
        if (!accessToken) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const params = {
            part: 'snippet,contentDetails',
            myRating: 'like',
            maxResults,
            videoCategoryId: '10' // Music category
        }
        if (pageToken) params.pageToken = pageToken

        const data = await youtubeRequest('/videos', accessToken, params)

        const tracks = (data.items || []).map(item => ({
            videoId: item.id,
            title: item.snippet?.title,
            channelTitle: item.snippet?.channelTitle,
            thumbnail: item.snippet?.thumbnails?.high?.url,
            duration: item.contentDetails?.duration,
            publishedAt: item.snippet?.publishedAt
        }))

        res.json({
            tracks,
            total: data.pageInfo?.totalResults || tracks.length,
            nextPageToken: data.nextPageToken,
            hasMore: !!data.nextPageToken
        })
    } catch (error) {
        console.error('[YouTube] Liked videos error:', error)
        res.status(500).json({ error: error.message })
    }
})

// POST /api/youtube-music/import - Import playlist to PMS
router.post('/import', async (req, res) => {
    const { visitorId, playlistId, userId } = req.body
    const tokenKey = visitorId || 'default'

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' })
    }

    try {
        const accessToken = await getValidToken(tokenKey)
        if (!accessToken) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        // 1. Get playlist info
        const playlistData = await youtubeRequest('/playlists', accessToken, {
            part: 'snippet',
            id: playlistId
        })

        const playlist = playlistData.items?.[0]
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' })
        }

        // 2. Get all tracks (handle pagination)
        let allTracks = []
        let pageToken = null

        do {
            const params = {
                part: 'snippet,contentDetails',
                playlistId,
                maxResults: 50
            }
            if (pageToken) params.pageToken = pageToken

            const itemsData = await youtubeRequest('/playlistItems', accessToken, params)

            const tracks = (itemsData.items || [])
                .filter(item => item.snippet?.resourceId?.videoId)

            allTracks = allTracks.concat(tracks)
            pageToken = itemsData.nextPageToken
        } while (pageToken)

        console.log(`[YouTube] Importing playlist "${playlist.snippet.title}" with ${allTracks.length} tracks`)

        // Skip empty playlists
        if (allTracks.length === 0) {
            console.log(`[YouTube] Skipping empty playlist "${playlist.snippet.title}"`)
            return res.json({
                success: false,
                message: 'Empty playlist - no valid tracks found',
                playlistTitle: playlist.snippet.title,
                importedTracks: 0,
                totalTracks: 0
            })
        }

        // 3. Create playlist in DB
        const result = await execute(`
            INSERT INTO playlists (user_id, title, description, cover_image, source_type, external_id, space_type, status_flag)
            VALUES (?, ?, ?, ?, 'Platform', ?, 'PMS', 'PRP')
        `, [
            userId,
            playlist.snippet.title,
            playlist.snippet.description || `Imported from YouTube`,
            playlist.snippet.thumbnails?.high?.url || null,
            playlistId
        ])

        const newPlaylistId = result.insertId

        // 4. Insert tracks
        let importedCount = 0
        for (let i = 0; i < allTracks.length; i++) {
            const item = allTracks[i]
            const snippet = item.snippet

            try {
                // Parse title to extract artist and track name (common format: "Artist - Title")
                let title = snippet.title
                let artist = snippet.videoOwnerChannelTitle?.replace(' - Topic', '') || 'Unknown'

                // Try to parse "Artist - Title" format
                const dashIndex = title.indexOf(' - ')
                if (dashIndex > 0) {
                    artist = title.substring(0, dashIndex).trim()
                    title = title.substring(dashIndex + 3).trim()
                }

                // Check if track already exists
                let existingTrack = await queryOne(`
                    SELECT track_id FROM tracks WHERE youtube_id = ?
                `, [snippet.resourceId.videoId])

                let trackId

                if (existingTrack) {
                    trackId = existingTrack.track_id
                } else {
                    const trackResult = await execute(`
                        INSERT INTO tracks (title, artist, youtube_id, artwork)
                        VALUES (?, ?, ?, ?)
                    `, [
                        title,
                        artist,
                        snippet.resourceId.videoId,
                        snippet.thumbnails?.high?.url || null
                    ])
                    trackId = trackResult.insertId
                }

                await execute(`
                    INSERT INTO playlist_tracks (playlist_id, track_id, order_index)
                    VALUES (?, ?, ?)
                `, [newPlaylistId, trackId, i])

                importedCount++
            } catch (trackError) {
                console.error(`[YouTube] Failed to import track "${snippet.title}":`, trackError.message)
            }
        }

        console.log(`[YouTube] Import complete: ${importedCount}/${allTracks.length} tracks`)

        res.json({
            success: true,
            playlistId: newPlaylistId,
            title: playlist.snippet.title,
            importedTracks: importedCount,
            totalTracks: allTracks.length
        })
    } catch (error) {
        console.error('[YouTube] Import error:', error)
        res.status(500).json({ error: error.message })
    }
})

export default router
