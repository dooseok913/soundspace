import { get, post } from './index'

// Types
export interface SpotifyUser {
    id: string
    displayName: string
    email?: string
    image?: string
    country?: string
}

export interface SpotifyPlaylist {
    id: string
    name: string
    description?: string
    image?: string
    trackCount: number
    owner?: string
    public?: boolean
    collaborative?: boolean
    externalUrl?: string
}

export interface SpotifyTrack {
    spotifyId: string
    title: string
    artist: string
    artistIds?: string[]
    album?: string
    albumId?: string
    artwork?: string
    duration: number
    isrc?: string
    popularity?: number
    previewUrl?: string
    externalUrl?: string
}

export interface SpotifyAuthStatus {
    connected: boolean
    user?: {
        id: string
        displayName: string
        image?: string
    }
    error?: string
}

export interface SpotifyPlaylistsResponse {
    playlists: SpotifyPlaylist[]
    total: number
    limit: number
    offset: number
    next?: string
    previous?: string
}

export interface SpotifyTracksResponse {
    tracks: SpotifyTrack[]
    total: number
    hasMore: boolean
}

export interface SpotifyImportResponse {
    success: boolean
    playlistId: number
    title: string
    importedTracks: number
    totalTracks: number
}

// Get visitor ID for session management
function getVisitorId(): string {
    let visitorId = localStorage.getItem('spotify_visitor_id')
    if (!visitorId) {
        visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        localStorage.setItem('spotify_visitor_id', visitorId)
    }
    return visitorId
}

// Spotify API Service
export const spotifyApi = {
    // Get login URL
    getLoginUrl: async () => {
        const visitorId = getVisitorId()
        const response = await get<{ authUrl: string }>(`/spotify/auth/login?visitorId=${visitorId}`)
        return response.authUrl
    },

    // Exchange authorization code for tokens
    exchangeCode: (code: string, state: string) => {
        const redirectUri = `${window.location.origin}/spotify-callback`
        return post<{ success: boolean; user: SpotifyUser; visitorId: string }>('/spotify/auth/exchange', {
            code,
            state,
            redirectUri
        })
    },

    // Check authentication status
    getAuthStatus: () => {
        const visitorId = getVisitorId()
        return get<SpotifyAuthStatus>(`/spotify/auth/status?visitorId=${visitorId}`)
    },

    // Logout / disconnect
    logout: () => {
        const visitorId = getVisitorId()
        return post<{ success: boolean }>('/spotify/auth/logout', { visitorId })
    },

    // Get user's playlists
    getPlaylists: (limit = 50, offset = 0) => {
        const visitorId = getVisitorId()
        return get<SpotifyPlaylistsResponse>(`/spotify/playlists?visitorId=${visitorId}&limit=${limit}&offset=${offset}`)
    },

    // Get playlist tracks
    getPlaylistTracks: (playlistId: string, limit = 100, offset = 0) => {
        const visitorId = getVisitorId()
        return get<SpotifyTracksResponse>(`/spotify/playlists/${playlistId}/tracks?visitorId=${visitorId}&limit=${limit}&offset=${offset}`)
    },

    // Import playlist to PMS
    importPlaylist: (playlistId: string, userId: number) => {
        const visitorId = getVisitorId()
        return post<SpotifyImportResponse>('/spotify/import', {
            visitorId,
            playlistId,
            userId
        })
    },

    // Get liked songs
    getLikedSongs: (limit = 50, offset = 0) => {
        const visitorId = getVisitorId()
        return get<SpotifyTracksResponse>(`/spotify/liked?visitorId=${visitorId}&limit=${limit}&offset=${offset}`)
    },

    // ============================================
    // Token-based API (Direct Bearer Token Input)
    // ============================================

    // Connect with direct Bearer token
    tokenConnect: (accessToken: string) => {
        const visitorId = getVisitorId()
        return post<{ success: boolean; user: SpotifyUser }>('/spotify/token/connect', {
            visitorId,
            accessToken
        })
    },

    // Check token connection status
    tokenGetStatus: () => {
        const visitorId = getVisitorId()
        return get<SpotifyAuthStatus & { connectedAt?: number }>(`/spotify/token/status?visitorId=${visitorId}`)
    },

    // Disconnect token
    tokenDisconnect: () => {
        const visitorId = getVisitorId()
        return post<{ success: boolean }>('/spotify/token/disconnect', { visitorId })
    },

    // Get playlists with token
    tokenGetPlaylists: (limit = 50, offset = 0) => {
        const visitorId = getVisitorId()
        return get<SpotifyPlaylistsResponse>(`/spotify/token/playlists?visitorId=${visitorId}&limit=${limit}&offset=${offset}`)
    },

    // Import playlist with token
    tokenImportPlaylist: (playlistId: string, userId: number) => {
        const visitorId = getVisitorId()
        return post<SpotifyImportResponse>('/spotify/token/import', {
            visitorId,
            playlistId,
            userId
        })
    },

    // ============================================
    // Browser-based API (Playwright Automation)
    // ============================================

    // Login with email/password via browser automation
    browserLogin: (email: string, password: string) => {
        const visitorId = getVisitorId()
        return post<{ success: boolean; user: SpotifyUser }>('/spotify/browser/login', {
            visitorId,
            email,
            password
        })
    },

    // Check browser session status
    browserGetStatus: () => {
        const visitorId = getVisitorId()
        return get<SpotifyAuthStatus & { connectedAt?: number }>(`/spotify/browser/status?visitorId=${visitorId}`)
    },

    // Logout from browser session
    browserLogout: () => {
        const visitorId = getVisitorId()
        return post<{ success: boolean }>('/spotify/browser/logout', { visitorId })
    },

    // Get playlists via browser session
    browserGetPlaylists: (limit = 50, offset = 0) => {
        const visitorId = getVisitorId()
        return get<{ playlists: SpotifyPlaylist[]; total: number; hasMore: boolean }>(`/spotify/browser/playlists?visitorId=${visitorId}&limit=${limit}&offset=${offset}`)
    },

    // Import playlist via browser session
    browserImportPlaylist: (playlistId: string, userId: number) => {
        const visitorId = getVisitorId()
        return post<SpotifyImportResponse>('/spotify/browser/import', {
            visitorId,
            playlistId,
            userId
        })
    }
}
