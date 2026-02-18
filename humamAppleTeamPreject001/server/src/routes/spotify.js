import express from 'express'
import crypto from 'crypto'
import { query, queryOne, execute } from '../config/db.js'

const router = express.Router()

// Spotify API Configuration
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_API_URL = 'https://api.spotify.com/v1'

// In-memory token storage (for simplicity - production should use DB/Redis)
let userTokens = {} // { visitorId: { accessToken, refreshToken, expiresAt } }
let pkceVerifiers = {} // { visitorId: codeVerifier }

// PKCE Helper Functions
function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url')
}

function generateCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url')
}

// Generate state for CSRF protection
function generateState() {
    return crypto.randomBytes(16).toString('hex')
}

// Get redirect URI based on environment
function getRedirectUri(req) {
    // Check X-Forwarded headers first (for reverse proxy/Docker environment)
    const forwardedHost = req.headers['x-forwarded-host']
    const forwardedProto = req.headers['x-forwarded-proto'] || 'http'

    if (forwardedHost) {
        return `${forwardedProto}://${forwardedHost}/spotify-callback`
    }

    // Use the origin from the request or fall back to defaults
    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'http://localhost'
    return `${origin}/spotify-callback`
}

// Refresh access token
async function refreshAccessToken(refreshToken) {
    const clientId = process.env.SPOTIFY_CLIENT_ID
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        })
    })

    if (!response.ok) {
        throw new Error('Failed to refresh token')
    }

    return response.json()
}

// Get valid access token (refresh if needed)
async function getValidToken(visitorId) {
    const tokens = userTokens[visitorId]
    if (!tokens) return null

    // Check if token is expired (with 1 minute buffer)
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
            console.error('[Spotify] Token refresh failed:', error)
            delete userTokens[visitorId]
            return null
        }
    }

    return tokens.accessToken
}

// Spotify API request helper
async function spotifyRequest(endpoint, accessToken, options = {}) {
    const response = await fetch(`${SPOTIFY_API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    })

    if (!response.ok) {
        const error = await response.text()
        console.error(`[Spotify] API Error: ${response.status}`, error)
        throw new Error(`Spotify API error: ${response.status}`)
    }

    return response.json()
}

// GET /api/spotify/auth/login - Redirect to Spotify OAuth
router.get('/auth/login', (req, res) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID
    const { visitorId } = req.query

    if (!clientId) {
        return res.status(503).json({ error: 'Spotify client ID not configured' })
    }

    // Generate PKCE verifier and challenge
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const state = generateState()

    // Store verifier with state as key (state will be returned in callback)
    pkceVerifiers[state] = { codeVerifier, visitorId }

    // Scopes for reading user's playlists and library
    const scopes = [
        'playlist-read-private',
        'playlist-read-collaborative',
        'user-library-read',
        'user-read-private',
        'user-read-email'
    ].join(' ')

    const redirectUri = getRedirectUri(req)

    const authUrl = new URL(SPOTIFY_AUTH_URL)
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('scope', scopes)
    authUrl.searchParams.append('state', state)
    authUrl.searchParams.append('code_challenge_method', 'S256')
    authUrl.searchParams.append('code_challenge', codeChallenge)

    res.json({ authUrl: authUrl.toString() })
})

// POST /api/spotify/auth/exchange - Exchange code for tokens
router.post('/auth/exchange', async (req, res) => {
    try {
        const { code, state, redirectUri } = req.body
        const clientId = process.env.SPOTIFY_CLIENT_ID
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

        if (!code || !state) {
            return res.status(400).json({ success: false, error: 'Missing code or state' })
        }

        // Retrieve PKCE verifier using state
        const stored = pkceVerifiers[state]
        if (!stored) {
            return res.status(400).json({ success: false, error: 'Invalid state. Please restart login.' })
        }

        const { codeVerifier, visitorId } = stored
        delete pkceVerifiers[state] // Clean up

        const response = await fetch(SPOTIFY_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier
            })
        })

        const data = await response.json()

        if (data.error) {
            console.error('[Spotify] Token exchange error:', data)
            return res.status(400).json({ success: false, error: data.error_description || data.error })
        }

        // Store tokens
        const tokenKey = visitorId || 'default'
        userTokens[tokenKey] = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + (data.expires_in * 1000)
        }

        // Get user profile
        const profile = await spotifyRequest('/me', data.access_token)

        res.json({
            success: true,
            user: {
                id: profile.id,
                displayName: profile.display_name,
                email: profile.email,
                image: profile.images?.[0]?.url,
                country: profile.country
            },
            visitorId: tokenKey
        })
    } catch (error) {
        console.error('[Spotify] Exchange error:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

// GET /api/spotify/auth/status - Check auth status
router.get('/auth/status', async (req, res) => {
    const { visitorId } = req.query
    const tokenKey = visitorId || 'default'

    try {
        const accessToken = await getValidToken(tokenKey)

        if (!accessToken) {
            return res.json({ connected: false })
        }

        // Verify token by getting user profile
        const profile = await spotifyRequest('/me', accessToken)

        res.json({
            connected: true,
            user: {
                id: profile.id,
                displayName: profile.display_name,
                image: profile.images?.[0]?.url
            }
        })
    } catch (error) {
        res.json({ connected: false, error: error.message })
    }
})

// POST /api/spotify/auth/logout - Disconnect Spotify
router.post('/auth/logout', (req, res) => {
    const { visitorId } = req.body
    const tokenKey = visitorId || 'default'

    delete userTokens[tokenKey]
    res.json({ success: true })
})

// GET /api/spotify/playlists - Get user's playlists
router.get('/playlists', async (req, res) => {
    const { visitorId, limit = 50, offset = 0 } = req.query
    const tokenKey = visitorId || 'default'

    try {
        const accessToken = await getValidToken(tokenKey)
        if (!accessToken) {
            return res.status(401).json({ error: 'Not authenticated. Please connect Spotify first.' })
        }

        const data = await spotifyRequest(`/me/playlists?limit=${limit}&offset=${offset}`, accessToken)

        const playlists = data.items.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            image: p.images?.[0]?.url,
            trackCount: p.tracks?.total || 0,
            owner: p.owner?.display_name,
            public: p.public,
            collaborative: p.collaborative,
            externalUrl: p.external_urls?.spotify
        }))

        res.json({
            playlists,
            total: data.total,
            limit: data.limit,
            offset: data.offset,
            next: data.next,
            previous: data.previous
        })
    } catch (error) {
        console.error('[Spotify] Playlists error:', error)
        res.status(500).json({ error: error.message })
    }
})

// GET /api/spotify/playlists/:id/tracks - Get playlist tracks
router.get('/playlists/:id/tracks', async (req, res) => {
    const { id } = req.params
    const { visitorId, limit = 100, offset = 0 } = req.query
    const tokenKey = visitorId || 'default'

    try {
        const accessToken = await getValidToken(tokenKey)
        if (!accessToken) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const data = await spotifyRequest(
            `/playlists/${id}/tracks?limit=${limit}&offset=${offset}&fields=items(track(id,name,artists,album,duration_ms,external_ids,popularity,preview_url,external_urls)),total,limit,offset,next`,
            accessToken
        )

        const tracks = data.items
            .filter(item => item.track) // Filter out null tracks (deleted/unavailable)
            .map(item => {
                const t = item.track
                return {
                    spotifyId: t.id,
                    title: t.name,
                    artist: t.artists?.map(a => a.name).join(', '),
                    artistIds: t.artists?.map(a => a.id),
                    album: t.album?.name,
                    albumId: t.album?.id,
                    artwork: t.album?.images?.[0]?.url,
                    duration: Math.floor(t.duration_ms / 1000),
                    isrc: t.external_ids?.isrc,
                    popularity: t.popularity,
                    previewUrl: t.preview_url,
                    externalUrl: t.external_urls?.spotify
                }
            })

        res.json({
            tracks,
            total: data.total,
            limit: data.limit,
            offset: data.offset,
            hasMore: !!data.next
        })
    } catch (error) {
        console.error('[Spotify] Playlist tracks error:', error)
        res.status(500).json({ error: error.message })
    }
})

// POST /api/spotify/import - Import playlist to PMS
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
        const playlistData = await spotifyRequest(`/playlists/${playlistId}`, accessToken)

        // 2. Get all tracks (handle pagination)
        let allTracks = []
        let offset = 0
        const limit = 100

        while (true) {
            const tracksData = await spotifyRequest(
                `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=items(track(id,name,artists,album,duration_ms,external_ids,popularity,preview_url,external_urls)),total,next`,
                accessToken
            )

            const tracks = tracksData.items
                .filter(item => item.track)
                .map(item => item.track)

            allTracks = allTracks.concat(tracks)

            if (!tracksData.next) break
            offset += limit
        }

        console.log(`[Spotify] Importing playlist "${playlistData.name}" with ${allTracks.length} tracks`)

        // Skip empty playlists
        if (allTracks.length === 0) {
            console.log(`[Spotify] Skipping empty playlist "${playlistData.name}"`)
            return res.json({
                success: false,
                message: 'Empty playlist - no valid tracks found',
                playlistTitle: playlistData.name,
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
            playlistData.name,
            playlistData.description || `Imported from Spotify`,
            playlistData.images?.[0]?.url || null,
            playlistId
        ])

        const newPlaylistId = result.insertId

        // 4. Insert tracks
        let importedCount = 0
        for (let i = 0; i < allTracks.length; i++) {
            const t = allTracks[i]

            try {
                // Check if track already exists (by spotify_id or isrc)
                let existingTrack = await queryOne(`
                    SELECT track_id FROM tracks WHERE spotify_id = ? OR (isrc = ? AND isrc IS NOT NULL)
                `, [t.id, t.external_ids?.isrc])

                let trackId

                if (existingTrack) {
                    trackId = existingTrack.track_id
                } else {
                    // Insert new track
                    const trackResult = await execute(`
                        INSERT INTO tracks (title, artist, album, duration, isrc, spotify_id, artwork, popularity)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        t.name,
                        t.artists?.map(a => a.name).join(', '),
                        t.album?.name,
                        Math.floor(t.duration_ms / 1000),
                        t.external_ids?.isrc || null,
                        t.id,
                        t.album?.images?.[0]?.url || null,
                        t.popularity || null
                    ])
                    trackId = trackResult.insertId
                }

                // Add to playlist_tracks
                await execute(`
                    INSERT INTO playlist_tracks (playlist_id, track_id, order_index)
                    VALUES (?, ?, ?)
                `, [newPlaylistId, trackId, i])

                importedCount++
            } catch (trackError) {
                console.error(`[Spotify] Failed to import track "${t.name}":`, trackError.message)
            }
        }

        console.log(`[Spotify] Import complete: ${importedCount}/${allTracks.length} tracks`)

        res.json({
            success: true,
            playlistId: newPlaylistId,
            title: playlistData.name,
            importedTracks: importedCount,
            totalTracks: allTracks.length
        })
    } catch (error) {
        console.error('[Spotify] Import error:', error)
        res.status(500).json({ error: error.message })
    }
})

// GET /api/spotify/liked - Get user's liked songs
router.get('/liked', async (req, res) => {
    const { visitorId, limit = 50, offset = 0 } = req.query
    const tokenKey = visitorId || 'default'

    try {
        const accessToken = await getValidToken(tokenKey)
        if (!accessToken) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const data = await spotifyRequest(`/me/tracks?limit=${limit}&offset=${offset}`, accessToken)

        const tracks = data.items.map(item => ({
            spotifyId: item.track.id,
            title: item.track.name,
            artist: item.track.artists?.map(a => a.name).join(', '),
            album: item.track.album?.name,
            artwork: item.track.album?.images?.[0]?.url,
            duration: Math.floor(item.track.duration_ms / 1000),
            addedAt: item.added_at
        }))

        res.json({
            tracks,
            total: data.total,
            hasMore: !!data.next
        })
    } catch (error) {
        console.error('[Spotify] Liked songs error:', error)
        res.status(500).json({ error: error.message })
    }
})

// ============================================
// Token-based API (Direct Bearer Token Input)
// ============================================

// In-memory storage for direct tokens
let directTokens = {} // { visitorId: { accessToken, connectedAt } }

// POST /api/spotify/token/connect - Connect with direct Bearer token
router.post('/token/connect', async (req, res) => {
    const { visitorId, accessToken } = req.body

    if (!accessToken) {
        return res.status(400).json({ error: 'Access token is required' })
    }

    const tokenKey = visitorId || 'default'

    try {
        // Verify token by getting user profile
        const response = await fetch(`${SPOTIFY_API_URL}/me`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        })

        if (!response.ok) {
            const error = await response.text()
            console.error('[Spotify Token] Validation failed:', error)
            return res.status(401).json({ error: 'Invalid or expired token' })
        }

        const profile = await response.json()

        // Store the token
        directTokens[tokenKey] = {
            accessToken,
            connectedAt: Date.now()
        }

        // Also store in userTokens for compatibility
        userTokens[tokenKey] = {
            accessToken,
            refreshToken: null,
            expiresAt: Date.now() + (3600 * 1000) // Assume 1 hour
        }

        console.log(`[Spotify Token] Connected: ${profile.display_name}`)

        res.json({
            success: true,
            user: {
                id: profile.id,
                displayName: profile.display_name,
                email: profile.email,
                image: profile.images?.[0]?.url,
                country: profile.country
            }
        })
    } catch (error) {
        console.error('[Spotify Token] Connect error:', error)
        res.status(500).json({ error: error.message })
    }
})

// GET /api/spotify/token/status - Check token connection status
router.get('/token/status', async (req, res) => {
    const { visitorId } = req.query
    const tokenKey = visitorId || 'default'

    const stored = directTokens[tokenKey]
    if (!stored) {
        return res.json({ connected: false })
    }

    try {
        // Verify token is still valid
        const response = await fetch(`${SPOTIFY_API_URL}/me`, {
            headers: { 'Authorization': `Bearer ${stored.accessToken}` }
        })

        if (!response.ok) {
            delete directTokens[tokenKey]
            delete userTokens[tokenKey]
            return res.json({ connected: false, error: 'Token expired' })
        }

        const profile = await response.json()

        res.json({
            connected: true,
            user: {
                id: profile.id,
                displayName: profile.display_name,
                image: profile.images?.[0]?.url
            },
            connectedAt: stored.connectedAt
        })
    } catch (error) {
        res.json({ connected: false, error: error.message })
    }
})

// POST /api/spotify/token/disconnect - Disconnect token
router.post('/token/disconnect', (req, res) => {
    const { visitorId } = req.body
    const tokenKey = visitorId || 'default'

    delete directTokens[tokenKey]
    delete userTokens[tokenKey]

    res.json({ success: true })
})

// GET /api/spotify/token/playlists - Get playlists with direct token
router.get('/token/playlists', async (req, res) => {
    const { visitorId, limit = 50, offset = 0 } = req.query
    const tokenKey = visitorId || 'default'

    const stored = directTokens[tokenKey]
    if (!stored) {
        return res.status(401).json({ error: 'Not connected. Please enter your Spotify token first.' })
    }

    try {
        const response = await fetch(
            `${SPOTIFY_API_URL}/me/playlists?limit=${limit}&offset=${offset}`,
            { headers: { 'Authorization': `Bearer ${stored.accessToken}` } }
        )

        if (!response.ok) {
            if (response.status === 401) {
                delete directTokens[tokenKey]
                return res.status(401).json({ error: 'Token expired. Please reconnect.' })
            }
            throw new Error(`Spotify API error: ${response.status}`)
        }

        const data = await response.json()

        const playlists = data.items.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            image: p.images?.[0]?.url,
            trackCount: p.tracks?.total || 0,
            owner: p.owner?.display_name,
            public: p.public,
            externalUrl: p.external_urls?.spotify
        }))

        res.json({
            playlists,
            total: data.total,
            limit: data.limit,
            offset: data.offset,
            hasMore: !!data.next
        })
    } catch (error) {
        console.error('[Spotify Token] Playlists error:', error)
        res.status(500).json({ error: error.message })
    }
})

// POST /api/spotify/token/import - Import playlist with direct token
router.post('/token/import', async (req, res) => {
    const { visitorId, playlistId, userId } = req.body
    const tokenKey = visitorId || 'default'

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' })
    }

    const stored = directTokens[tokenKey]
    if (!stored) {
        return res.status(401).json({ error: 'Not connected' })
    }

    const accessToken = stored.accessToken

    try {
        // 1. Get playlist info
        const playlistResponse = await fetch(`${SPOTIFY_API_URL}/playlists/${playlistId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        })

        if (!playlistResponse.ok) {
            throw new Error('Failed to fetch playlist')
        }

        const playlistData = await playlistResponse.json()

        // 2. Get all tracks (handle pagination)
        let allTracks = []
        let offset = 0
        const limit = 100

        while (true) {
            const tracksResponse = await fetch(
                `${SPOTIFY_API_URL}/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            )

            if (!tracksResponse.ok) break

            const tracksData = await tracksResponse.json()
            const tracks = tracksData.items
                .filter(item => item.track)
                .map(item => item.track)

            allTracks = allTracks.concat(tracks)

            if (!tracksData.next) break
            offset += limit
        }

        console.log(`[Spotify Token] Importing "${playlistData.name}" with ${allTracks.length} tracks`)

        // Skip empty playlists
        if (allTracks.length === 0) {
            console.log(`[Spotify Token] Skipping empty playlist "${playlistData.name}"`)
            return res.json({
                success: false,
                message: 'Empty playlist - no valid tracks found',
                playlistTitle: playlistData.name,
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
            playlistData.name,
            playlistData.description || `Imported from Spotify`,
            playlistData.images?.[0]?.url || null,
            playlistId
        ])

        const newPlaylistId = result.insertId

        // 4. Insert tracks
        let importedCount = 0
        for (let i = 0; i < allTracks.length; i++) {
            const t = allTracks[i]

            try {
                let existingTrack = await queryOne(`
                    SELECT track_id FROM tracks WHERE spotify_id = ? OR (isrc = ? AND isrc IS NOT NULL)
                `, [t.id, t.external_ids?.isrc])

                let trackId

                if (existingTrack) {
                    trackId = existingTrack.track_id
                } else {
                    const trackResult = await execute(`
                        INSERT INTO tracks (title, artist, album, duration, isrc, spotify_id, artwork, popularity)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        t.name,
                        t.artists?.map(a => a.name).join(', '),
                        t.album?.name,
                        Math.floor(t.duration_ms / 1000),
                        t.external_ids?.isrc || null,
                        t.id,
                        t.album?.images?.[0]?.url || null,
                        t.popularity || null
                    ])
                    trackId = trackResult.insertId
                }

                await execute(`
                    INSERT INTO playlist_tracks (playlist_id, track_id, order_index)
                    VALUES (?, ?, ?)
                `, [newPlaylistId, trackId, i])

                importedCount++
            } catch (trackError) {
                console.error(`[Spotify Token] Failed to import track "${t.name}":`, trackError.message)
            }
        }

        console.log(`[Spotify Token] Import complete: ${importedCount}/${allTracks.length} tracks`)

        res.json({
            success: true,
            playlistId: newPlaylistId,
            title: playlistData.name,
            importedTracks: importedCount,
            totalTracks: allTracks.length
        })
    } catch (error) {
        console.error('[Spotify Token] Import error:', error)
        res.status(500).json({ error: error.message })
    }
})

export default router
