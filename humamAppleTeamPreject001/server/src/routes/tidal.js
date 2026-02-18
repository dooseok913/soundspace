import express from 'express'
import crypto from 'crypto'
import { query, queryOne, execute } from '../config/db.js'

const router = express.Router()

// Tidal API Configuration
const TIDAL_AUTH_URL = 'https://auth.tidal.com/v1/oauth2/token'
const TIDAL_API_URL = 'https://api.tidal.com/v1'

let cachedToken = null
let tokenExpiry = null
let userToken = null
let userTokenExpiry = null
let pkceVerifier = null // Store PKCE code_verifier

// Per-visitor token storage for multi-user support
let visitorTokens = {} // { visitorId: { accessToken, refreshToken, expiresAt, userId, countryCode } }
let visitorPkceVerifiers = {} // { visitorId: codeVerifier }

// PKCE Helper Functions
function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url')
}

function generateCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url')
}

// Get Client Credentials Token
async function getClientToken() {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken
    }

    const clientId = process.env.TIDAL_CLIENT_ID
    const clientSecret = process.env.TIDAL_CLIENT_SECRET

    if (!clientId || !clientSecret) {
        throw new Error('Tidal API credentials not configured')
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const response = await fetch(TIDAL_AUTH_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Tidal auth failed: ${error}`)
    }

    const data = await response.json()
    cachedToken = data.access_token
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000
    return cachedToken
}

// Helper: Make Tidal API Request (Prefer User Token)
async function tidalRequest(endpoint, params = {}, tokenOverride = null) {
    let token = tokenOverride || (userToken && userTokenExpiry && Date.now() < userTokenExpiry ? userToken : null)

    // Fallback to client token if no user token
    if (!token) {
        token = await getClientToken()
    }

    const url = new URL(`${TIDAL_API_URL}${endpoint}`)
    Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.append(key, value)
    })

    const response = await fetch(url.toString(), {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.tidal.v1+json'
        }
    })

    if (!response.ok) {
        const error = await response.text()
        console.error(`Tidal API Error: ${response.status} ${response.statusText}`, error)
        throw new Error(`Tidal API error: ${response.status} ${error}`)
    }

    return response.json()
}

// POST /api/tidal/auth/device - Init Device Flow
router.post('/auth/device', async (req, res) => {
    try {
        const clientId = process.env.TIDAL_CLIENT_ID
        // New Developer Portal scopes (legacy r_usr/w_usr/w_sub causes error 1002)
        const scopes = 'user.read playlists.read playlists.write collection.read'

        const response = await fetch('https://auth.tidal.com/v1/oauth2/device_authorization', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `client_id=${clientId}&scope=${encodeURIComponent(scopes)}`
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Tidal Device Auth Init Failed:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
                clientIdPartial: clientId ? clientId.substring(0, 5) + '...' : 'MISSING'
            })
            throw new Error(errorText)
        }

        const data = await response.json()
        res.json(data)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// POST /api/tidal/auth/token - Polling for Token (Device Flow)
router.post('/auth/token', async (req, res) => {
    try {
        const { deviceCode } = req.body
        const clientId = process.env.TIDAL_CLIENT_ID
        const clientSecret = process.env.TIDAL_CLIENT_SECRET

        // Match Rust app: use form body instead of Basic Auth header
        const params = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            scope: 'user.read playlists.read playlists.write collection.read'
        })

        const response = await fetch(TIDAL_AUTH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        })

        const data = await response.json()

        if (data.error) {
            return res.status(400).json(data)
        }

        const token = data.access_token

        // Match sample code: Get session info immediately after token
        console.log('[Tidal] Fetching session info after poll...')
        const sessionResp = await fetch(`${TIDAL_API_URL}/sessions`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.tidal.v1+json'
            }
        })

        if (!sessionResp.ok) {
            console.error('[Tidal] Session fetch failed:', sessionResp.status)
            return res.status(sessionResp.status).json({ success: false, error: 'Failed to fetch session info' })
        }

        const session = await sessionResp.json()
        console.log('[Tidal] Session acquired:', session)

        userToken = token
        userTokenExpiry = Date.now() + (data.expires_in * 1000)

        res.json({
            success: true,
            user: {
                userId: session.userId || session.user_id,
                countryCode: session.countryCode || session.country_code,
                username: session.username || 'Tidal User'
            },
            access_token: token
        })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// --- WEB AUTH FLOW ---

// GET /api/tidal/auth/login - Redirect to Tidal Login (with PKCE)
router.get('/auth/login', (req, res) => {
    const clientId = process.env.TIDAL_CLIENT_ID
    // Get redirect URI from request info
    let origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null) || 'http://localhost'

    // Fix: Force localhost for localhost to match whitelist
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        origin = 'http://localhost'
    }

    const redirectUri = `${origin}/tidal-callback`

    // Generate PKCE code_verifier and code_challenge
    pkceVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(pkceVerifier)

    // New Developer Portal scopes (legacy r_usr/w_usr/w_sub causes error 1002)
    const scopes = 'user.read playlists.read playlists.write collection.read'

    const authUrl = `https://login.tidal.com/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&code_challenge=${codeChallenge}&code_challenge_method=S256`

    res.redirect(authUrl)
})

// GET /api/tidal/auth/login-url - Return OAuth URL as JSON (for popup-based login)
router.get('/auth/login-url', (req, res) => {
    try {
        const { visitorId } = req.query
        const clientId = process.env.TIDAL_CLIENT_ID

        // Get redirect URI from request info
        let origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null) || 'http://localhost'

        // Fix: Force localhost for localhost to match whitelist
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            origin = 'http://localhost'
        }

        const redirectUri = `${origin}/tidal-callback`

        // Generate PKCE code_verifier and code_challenge
        const codeVerifier = generateCodeVerifier()
        const codeChallenge = generateCodeChallenge(codeVerifier)

        // Store verifier per visitor for multi-user support
        if (visitorId) {
            visitorPkceVerifiers[visitorId] = codeVerifier
        } else {
            pkceVerifier = codeVerifier
        }

        // New Developer Portal scopes (legacy r_usr/w_usr/w_sub causes error 1002)
        const scopes = 'user.read playlists.read playlists.write collection.read'

        const authUrl = `https://login.tidal.com/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&code_challenge=${codeChallenge}&code_challenge_method=S256`

        console.log(`[Tidal] Generated auth URL for visitor ${visitorId || 'global'}`)

        res.json({ authUrl })
    } catch (error) {
        console.error('[Tidal] Error generating login URL:', error)
        res.status(500).json({ error: error.message })
    }
})

// POST /api/tidal/auth/exchange - Exchange Code for Token (with PKCE)
router.post('/auth/exchange', async (req, res) => {
    try {
        const { code, visitorId, redirectUri: clientRedirectUri } = req.body
        const clientId = process.env.TIDAL_CLIENT_ID
        const clientSecret = process.env.TIDAL_CLIENT_SECRET

        // Get redirect URI - use client-provided or default
        const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'http://localhost'
        const redirectUri = clientRedirectUri || `${origin}/tidal-callback`

        // Get PKCE verifier - check visitor-specific first, then global
        let codeVerifier = null
        if (visitorId && visitorPkceVerifiers[visitorId]) {
            codeVerifier = visitorPkceVerifiers[visitorId]
            delete visitorPkceVerifiers[visitorId]
        } else if (pkceVerifier) {
            codeVerifier = pkceVerifier
            pkceVerifier = null
        }

        if (!codeVerifier) {
            return res.status(400).json({ success: false, error: 'PKCE verifier not found. Please restart login flow.' })
        }

        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

        const response = await fetch(TIDAL_AUTH_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}&code_verifier=${codeVerifier}`
        })

        const data = await response.json()

        if (data.error) {
            console.error('Token Exchange Error:', data)
            return res.status(400).json({ success: false, error: data.error_description || data.error })
        }

        const token = data.access_token
        userToken = token
        userTokenExpiry = Date.now() + (data.expires_in * 1000)

        // Get session info to retrieve userId and countryCode (like Rust app does)
        console.log('[Tidal] Fetching session info after exchange...')
        const sessionResp = await fetch(`${TIDAL_API_URL}/sessions`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.tidal.v1+json'
            }
        })

        let user = { username: 'Tidal User' }
        if (sessionResp.ok) {
            const session = await sessionResp.json()
            console.log('[Tidal] Session acquired:', session)
            user = {
                userId: session.userId || session.user_id,
                countryCode: session.countryCode || session.country_code,
                username: session.username || 'Tidal User'
            }
        } else {
            console.warn('[Tidal] Session fetch failed:', sessionResp.status)
        }

        // Store token for this visitor
        if (visitorId) {
            visitorTokens[visitorId] = {
                accessToken: token,
                refreshToken: data.refresh_token,
                expiresAt: Date.now() + (data.expires_in * 1000),
                userId: user.userId,
                countryCode: user.countryCode,
                username: user.username
            }
        }

        res.json({
            success: true,
            user,
            visitorId,
            access_token: token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in
        })
    } catch (error) {
        console.error('Exchange Exception:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

// GET /api/tidal/auth/status - Check auth status
router.get('/auth/status', async (req, res) => {
    try {
        const { visitorId } = req.query

        // Check visitor-specific token first
        if (visitorId && visitorTokens[visitorId]) {
            const tokens = visitorTokens[visitorId]
            if (Date.now() < tokens.expiresAt) {
                return res.json({
                    authenticated: true,
                    userConnected: true,
                    user: {
                        userId: tokens.userId,
                        countryCode: tokens.countryCode,
                        username: tokens.username || 'Tidal User'
                    }
                })
            } else {
                delete visitorTokens[visitorId]
            }
        }

        // Fallback to global user token
        const hasUserToken = !!(userToken && userTokenExpiry && Date.now() < userTokenExpiry)

        if (!hasUserToken) {
            await getClientToken() // Ensure client token works at least
        }

        res.json({
            authenticated: true, // System is authenticated
            userConnected: hasUserToken, // User is logged in
            type: hasUserToken ? 'User' : 'Client'
        })
    } catch (error) {
        res.json({
            authenticated: false,
            error: error.message
        })
    }
})

// POST /api/tidal/auth/logout - Logout user
router.post('/auth/logout', (req, res) => {
    const { visitorId } = req.body

    if (visitorId && visitorTokens[visitorId]) {
        delete visitorTokens[visitorId]
    }

    // Also clear global token
    userToken = null
    userTokenExpiry = null

    res.json({ success: true })
})

// GET /api/tidal/user/playlists - Get user's playlists
router.get('/user/playlists', async (req, res) => {
    try {
        const { visitorId } = req.query

        let token = null
        let countryCode = 'US'

        // Get visitor-specific token
        if (visitorId && visitorTokens[visitorId]) {
            const tokens = visitorTokens[visitorId]
            if (Date.now() < tokens.expiresAt) {
                token = tokens.accessToken
                countryCode = tokens.countryCode || 'US'
            }
        }

        // Fallback to global user token
        if (!token && userToken && userTokenExpiry && Date.now() < userTokenExpiry) {
            token = userToken
        }

        if (!token) {
            return res.status(401).json({ error: 'Not authenticated. Please connect Tidal first.' })
        }

        const playlists = await fetchTidalPlaylists(token)

        // Debug: Check raw playlist data for image fields
        if (playlists.length > 0) {
            console.log('[Tidal] Raw playlist[0] ALL fields:', JSON.stringify(playlists[0], null, 2))
        }

        // Helper function to extract image URL from Tidal playlist
        const extractTidalImage = (p) => {
            // 1. Direct URL fields
            if (p.squareImage) {
                if (p.squareImage.startsWith('http')) return p.squareImage
                return `https://resources.tidal.com/images/${p.squareImage.replace(/-/g, '/')}/320x320.jpg`
            }
            
            // 2. image field
            if (p.image) {
                if (typeof p.image === 'string') {
                    if (p.image.startsWith('http')) return p.image
                    return `https://resources.tidal.com/images/${p.image.replace(/-/g, '/')}/320x320.jpg`
                }
                // image might be an object with url property
                if (p.image.url) return p.image.url
            }
            
            // 3. picture field
            if (p.picture) {
                if (p.picture.startsWith('http')) return p.picture
                return `https://resources.tidal.com/images/${p.picture.replace(/-/g, '/')}/320x320.jpg`
            }
            
            // 4. images array (Tidal API v2 style)
            if (p.images && Array.isArray(p.images) && p.images.length > 0) {
                const img = p.images.find(i => i.width >= 320) || p.images[0]
                return img.url || img.href
            }
            
            // 5. promotedArtists - use first artist's picture
            if (p.promotedArtists && p.promotedArtists.length > 0) {
                const artist = p.promotedArtists[0]
                if (artist.picture) {
                    return `https://resources.tidal.com/images/${artist.picture.replace(/-/g, '/')}/320x320.jpg`
                }
            }
            
            return null
        }

        // Format playlists for frontend
        const formattedPlaylists = playlists.map(p => ({
            uuid: p.uuid,
            title: p.title,
            numberOfTracks: p.numberOfTracks || 0,
            trackCount: p.numberOfTracks || 0,
            image: extractTidalImage(p),
            description: p.description
        }))

        console.log('[Tidal] Formatted playlists sample:', formattedPlaylists[0])
        res.json({ playlists: formattedPlaylists })
    } catch (error) {
        console.error('[Tidal] User playlists error:', error)
        res.status(500).json({ error: error.message })
    }
})

// POST /api/tidal/import - Import playlist to PMS
router.post('/import', async (req, res) => {
    try {
        const { visitorId, playlistId, userId } = req.body

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' })
        }

        let token = null
        let countryCode = 'KR'

        // Get visitor-specific token
        if (visitorId && visitorTokens[visitorId]) {
            const tokens = visitorTokens[visitorId]
            if (Date.now() < tokens.expiresAt) {
                token = tokens.accessToken
                countryCode = tokens.countryCode || 'KR'
            }
        }

        // Fallback to global user token
        if (!token && userToken && userTokenExpiry && Date.now() < userTokenExpiry) {
            token = userToken
        }

        if (!token) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        // Check if playlist already exists (duplicate check)
        const existingPlaylist = await queryOne(`
            SELECT playlist_id, title FROM playlists 
            WHERE user_id = ? AND external_id = ? AND source_type = 'tidal'
        `, [userId, playlistId])

        if (existingPlaylist) {
            console.log(`[Tidal] Playlist "${existingPlaylist.title}" already exists (ID: ${existingPlaylist.playlist_id}), skipping...`)
            return res.json({
                success: true,
                skipped: true,
                playlistId: existingPlaylist.playlist_id,
                title: existingPlaylist.title,
                message: '이미 가져온 플레이리스트입니다'
            })
        }

        // 1. Get playlist info
        const playlistResponse = await fetch(`${TIDAL_API_URL}/playlists/${playlistId}?countryCode=${countryCode}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.tidal.v1+json'
            }
        })

        if (!playlistResponse.ok) {
            throw new Error('Failed to fetch playlist info')
        }

        const playlist = await playlistResponse.json()

        // 2. Get playlist tracks
        const tracks = await fetchTidalPlaylistTracks(token, playlistId, countryCode)

        console.log(`[Tidal] Importing playlist "${playlist.title}" with ${tracks.length} tracks`)

        // Skip empty playlists
        if (tracks.length === 0) {
            console.log(`[Tidal] Skipping empty playlist "${playlist.title}"`)
            return res.json({
                success: false,
                message: 'Empty playlist - no valid tracks found',
                playlistTitle: playlist.title,
                importedTracks: 0,
                totalTracks: 0
            })
        }

        // 3. Create playlist in DB
        const coverImage = playlist.squareImage
            ? `https://resources.tidal.com/images/${playlist.squareImage.replace(/-/g, '/')}/320x320.jpg`
            : null

        const result = await execute(`
            INSERT INTO playlists (user_id, title, description, cover_image, source_type, external_id, space_type, status_flag)
            VALUES (?, ?, ?, ?, 'Platform', ?, 'PMS', 'PRP')
        `, [
            userId,
            playlist.title,
            playlist.description || `Imported from Tidal`,
            coverImage,
            playlistId
        ])

        const newPlaylistId = result.insertId

        // 4. Insert tracks with duplicate check
        let importedCount = 0
        let skippedCount = 0
        for (let i = 0; i < tracks.length; i++) {
            const item = tracks[i]
            const track = item.item || item

            if (!track || !track.title) continue

            try {
                const artist = track.artist?.name || track.artists?.[0]?.name || 'Unknown'
                const artwork = track.album?.cover
                    ? `https://resources.tidal.com/images/${track.album.cover.replace(/-/g, '/')}/320x320.jpg`
                    : null

                // Check if track already exists by tidal_id
                let existingTrack = await queryOne(`
                    SELECT track_id FROM tracks WHERE tidal_id = ?
                `, [track.id?.toString()])

                let trackId

                if (existingTrack) {
                    trackId = existingTrack.track_id
                } else {
                    // Also check by title + artist to avoid duplicates
                    existingTrack = await queryOne(`
                        SELECT track_id FROM tracks WHERE title = ? AND artist = ?
                    `, [track.title, artist])

                    if (existingTrack) {
                        trackId = existingTrack.track_id
                        // Update tidal_id if missing
                        await execute(`UPDATE tracks SET tidal_id = ? WHERE track_id = ? AND tidal_id IS NULL`,
                            [track.id?.toString(), trackId])
                    } else {
                        const trackResult = await execute(`
                            INSERT INTO tracks (title, artist, tidal_id, artwork, duration)
                            VALUES (?, ?, ?, ?, ?)
                        `, [
                            track.title,
                            artist,
                            track.id?.toString(),
                            artwork,
                            track.duration || null
                        ])
                        trackId = trackResult.insertId
                    }
                }

                // Check if track already in this playlist
                const existingPlaylistTrack = await queryOne(`
                    SELECT id FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?
                `, [newPlaylistId, trackId])

                if (!existingPlaylistTrack) {
                    await execute(`
                        INSERT INTO playlist_tracks (playlist_id, track_id, order_index)
                        VALUES (?, ?, ?)
                    `, [newPlaylistId, trackId, i])
                    importedCount++
                } else {
                    skippedCount++
                }
            } catch (trackError) {
                console.error(`[Tidal] Failed to import track "${track.title}":`, trackError.message)
            }
        }

        console.log(`[Tidal] Import complete: ${importedCount} imported, ${skippedCount} skipped, ${tracks.length} total`)

        res.json({
            success: true,
            playlistId: newPlaylistId,
            title: playlist.title,
            importedTracks: importedCount,
            skippedTracks: skippedCount,
            totalTracks: tracks.length
        })
    } catch (error) {
        console.error('[Tidal] Import error:', error)
        res.status(500).json({ error: error.message })
    }
})

// GET /api/tidal/search - General search (for artists, tracks, etc.)
router.get('/search', async (req, res) => {
    try {
        const { query, type = 'TRACKS', limit = 20, countryCode = 'US' } = req.query

        if (!query) return res.status(400).json({ error: 'Query is required' })

        const token = await getClientToken()

        const params = new URLSearchParams({
            query,
            type,
            limit,
            countryCode
        })

        const response = await fetch(`${TIDAL_API_URL}/search?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.tidal.v1+json'
            }
        })

        if (!response.ok) throw new Error(await response.text())
        const data = await response.json()

        res.json(data)
    } catch (error) {
        console.error('[Tidal Search] Error:', error)
        res.status(500).json({ error: error.message })
    }
})

// GET /api/tidal/search/universal - Search for multiple types
router.get('/search/universal', async (req, res) => {
    try {
        const { query, limit = 10, countryCode = 'US' } = req.query

        if (!query) return res.status(400).json({ error: 'Query is required' })

        // Use Client Token for search to avoid scope issues
        const token = await getClientToken()
        const types = ['ARTISTS', 'ALBUMS', 'TRACKS', 'PLAYLISTS']

        const params = new URLSearchParams({
            query,
            type: types.join(','),
            limit,
            countryCode
        })

        const response = await fetch(`${TIDAL_API_URL}/search?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.tidal.v1+json'
            }
        })

        if (!response.ok) throw new Error(await response.text())
        const data = await response.json()

        res.json(data)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// GET /api/tidal/search/playlists - Search playlists
router.get('/search/playlists', async (req, res) => {
    try {
        const { query = 'K-POP', limit = 10, countryCode = 'US' } = req.query

        const data = await tidalRequest('/search', {
            query,
            type: 'PLAYLISTS',
            limit,
            countryCode
        })

        res.json(data)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// GET /api/tidal/recommendations - Get personalized recommendations (Mixes)
router.get('/recommendations', async (req, res) => {
    try {
        const { countryCode = 'US', limit = 10 } = req.query

        // Use Client Token for generic "Mix" search as fallback
        // Since User Token 'r_usr' scope needed for true recommendations is unavailable/broken
        const token = await getClientToken()
        const params = new URLSearchParams({
            query: 'Mix',
            type: 'PLAYLISTS',
            limit,
            countryCode
        })

        const response = await fetch(`${TIDAL_API_URL}/search?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.tidal.v1+json'
            }
        })

        if (!response.ok) throw new Error(await response.text())
        const data = await response.json()

        res.json(data)
    } catch (error) {
        console.error('Recommendations error:', error)
        res.status(500).json({ error: error.message })
    }
})

// GET /api/tidal/playlists/:id - Get playlist details
router.get('/playlists/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { countryCode = 'KR' } = req.query

        const data = await tidalRequest(`/playlists/${id}`, { countryCode })
        res.json(data)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// GET /api/tidal/playlists/:id/items - Get playlist tracks
router.get('/playlists/:id/items', async (req, res) => {
    try {
        const { id } = req.params
        const { limit = 50, offset = 0, countryCode = 'KR' } = req.query

        const data = await tidalRequest(`/playlists/${id}/items`, {
            limit,
            offset,
            countryCode
        })

        res.json(data)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// GET /api/tidal/featured - Get featured/curated playlists
router.get('/featured', async (req, res) => {
    try {
        const { countryCode = 'US', limit = 20 } = req.query

        // Search for popular genre playlists
        const genres = ['Classical', 'Vocal Jazz', 'K-POP']
        const results = []

        for (const genre of genres) {
            try {
                const data = await tidalRequest('/search', {
                    query: genre,
                    type: 'PLAYLISTS',
                    limit: 5,
                    countryCode
                })
                if (data.playlists) {
                    results.push({
                        genre,
                        playlists: data.playlists.slice(0, 5)
                    })
                }
            } catch (e) {
                console.error(`Failed to fetch ${genre}:`, e.message)
            }
        }

        if (results.length === 0) {
            console.warn(`Tidal API returned 0 results for genres. Check region/auth.`)
        }

        res.json({ featured: results })
    } catch (error) {
        console.error('Final error in /featured:', error)
        res.status(500).json({ error: error.message })
    }
})

// Exported helper for background sync / registration
export async function fetchTidalPlaylists(token, providedUserId = null) {
    try {
        console.log('[Tidal] Fetching user playlists...')
        let tidalUserId = providedUserId
        let countryCode = 'US' // Default to US as it has the most catalog access

        // 1. Resolve user identity and detect countryCode
        console.log('[Tidal] Resolving user identity and country...')

        // Try identity endpoints - sample code uses /sessions
        const endpoints = ['/sessions', '/users/me', '/me']

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`${TIDAL_API_URL}${endpoint}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.tidal.v1+json'
                    }
                })

                if (response.ok) {
                    const data = await response.json()
                    tidalUserId = tidalUserId || data.userId || data.id || (data.user && data.user.id)
                    // Dynamically capture the user's account country code
                    if (data.countryCode) {
                        countryCode = data.countryCode
                        console.log('[Tidal] Detected countryCode:', countryCode)
                    }
                    if (tidalUserId) {
                        console.log(`[Tidal] Identity resolved via ${endpoint}: ${tidalUserId}`)
                        break
                    }
                }
            } catch (e) {
                console.warn(`[Tidal] Identity fetch failed for ${endpoint}`)
            }
        }

        // 2. Fallback for userId from JWT if still missing
        if (!tidalUserId) {
            try {
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
                tidalUserId = payload.user_id || payload.sub
                console.log('[Tidal] Identity extracted from JWT:', tidalUserId)
            } catch (e) { }
        }

        if (!tidalUserId) {
            throw new Error(`Failed to resolve Tidal user identity`)
        }

        // 3. Try multiple endpoints to get user's music data
        const playlistEndpoints = [
            `/users/${tidalUserId}/playlists`,
            `/users/${tidalUserId}/favorites/playlists`,
            `/my-collection/playlists/folders`
        ]

        for (const endpoint of playlistEndpoints) {
            console.log(`[Tidal] Trying endpoint: ${endpoint}`)
            try {
                const response = await fetch(`${TIDAL_API_URL}${endpoint}?countryCode=${countryCode}&limit=50`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.tidal.v1+json'
                    }
                })

                if (response.ok) {
                    const data = await response.json()
                    const items = data.items || data.data || []
                    if (items.length > 0) {
                        console.log(`[Tidal] Success! Found ${items.length} playlists via ${endpoint}`)
                        // Debug: Log first playlist structure to check image field names
                        if (items[0]) {
                            console.log('[Tidal] Sample playlist fields:', JSON.stringify({
                                uuid: items[0].uuid,
                                title: items[0].title,
                                squareImage: items[0].squareImage,
                                image: items[0].image,
                                picture: items[0].picture,
                                cover: items[0].cover,
                                artwork: items[0].artwork,
                                allKeys: Object.keys(items[0])
                            }, null, 2))
                        }
                        return items
                    }
                } else {
                    console.log(`[Tidal] ${endpoint} returned ${response.status}`)
                }
            } catch (e) {
                console.warn(`[Tidal] Endpoint ${endpoint} failed:`, e.message)
            }
        }

        // 4. If no playlists found, try to get favorites tracks and create a virtual playlist
        console.log('[Tidal] No playlists accessible, trying favorites tracks...')
        const favoritesResponse = await fetch(`${TIDAL_API_URL}/users/${tidalUserId}/favorites/tracks?countryCode=${countryCode}&limit=100`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.tidal.v1+json'
            }
        })

        if (favoritesResponse.ok) {
            const favData = await favoritesResponse.json()
            const tracks = favData.items || []
            if (tracks.length > 0) {
                console.log(`[Tidal] Found ${tracks.length} favorite tracks, creating virtual playlist`)
                // Return a virtual playlist containing favorites
                return [{
                    uuid: `tidal-favorites-${tidalUserId}`,
                    title: 'Tidal Favorites',
                    description: 'Your liked tracks from Tidal',
                    numberOfTracks: tracks.length,
                    _virtualTracks: tracks // Pass tracks directly
                }]
            }
        }

        // 5. If still nothing, return empty but don't throw
        console.log('[Tidal] No accessible playlists or favorites found')
        return []
    } catch (error) {
        console.error('[Tidal] fetchTidalPlaylists error:', error)
        // Don't throw - return empty array so sync can complete
        return []
    }
}

export async function fetchTidalPlaylistTracks(token, playlistId, countryCode = 'KR') {
    try {
        let allItems = []
        let offset = 0
        const limit = 100 // Tidal max limit per request
        let total = 0

        do {
            console.log(`[Tidal] Fetching tracks for ${playlistId} (offset: ${offset})...`)
            const response = await fetch(`${TIDAL_API_URL}/playlists/${playlistId}/items?limit=${limit}&offset=${offset}&countryCode=${countryCode}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.tidal.v1+json'
                }
            })

            if (!response.ok) {
                if (response.status === 403 && countryCode !== 'US') {
                    console.warn(`[Tidal] 403 Forbidden for tracks in ${countryCode}, falling back to US...`)
                    return fetchTidalPlaylistTracks(token, playlistId, 'US') // Retry with US
                }
                throw new Error(`Failed to fetch tracks for ${playlistId}: ${response.status}`)
            }

            const data = await response.json()
            const items = data.items || []
            allItems = allItems.concat(items)

            total = data.totalNumberOfItems || items.length // Some endpoints might not return totalNumberOfItems
            offset += items.length

            if (items.length === 0) break // Safety break

        } while (offset < total)

        console.log(`[Tidal] Total tracks fetched: ${allItems.length}`)
        return allItems
    } catch (error) {
        console.error('[Tidal] fetchTidalPlaylistTracks error:', error)
        return []
    }
}

export default router
