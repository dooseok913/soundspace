import { get, post } from './index'

// Get visitorId for session management
const getVisitorId = () => {
    let visitorId = localStorage.getItem('tidal_visitor_id')
    if (!visitorId) {
        visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        localStorage.setItem('tidal_visitor_id', visitorId)
    }
    return visitorId
}

// Types
export interface TidalPlaylist {
    uuid: string
    title: string
    numberOfTracks: number
    trackCount?: number
    squareImage?: string
    image?: string
    description?: string
    creator?: {
        name: string
    }
}

export interface TidalSearchResponse {
    playlists?: TidalPlaylist[]
}

export interface TidalFeaturedResponse {
    featured: {
        genre: string
        playlists: TidalPlaylist[]
    }[]
}

export interface TidalAuthStatus {
    authenticated: boolean
    userConnected?: boolean
    expiresAt?: number
    error?: string
    user?: {
        username?: string
        userId?: string
    }
}

// Tidal API Service
export const tidalApi = {
    // Check authentication status
    getAuthStatus: () => get<TidalAuthStatus>(`/tidal/auth/status?visitorId=${getVisitorId()}`),

    // Search playlists
    searchPlaylists: (query: string = 'K-POP', limit: number = 10) =>
        get<TidalSearchResponse>(`/tidal/search?query=${encodeURIComponent(query)}&type=PLAYLISTS&limit=${limit}`),

    // Search tracks (New)
    searchTracks: (query: string, limit: number = 5) => {
        const visitorId = getVisitorId()
        return get<{ tracks: any[] }>(`/tidal/search?query=${encodeURIComponent(query)}&type=TRACKS&limit=${limit}&visitorId=${visitorId}`)
    },

    // Get featured playlists by genre
    getFeatured: () => get<TidalFeaturedResponse>('/tidal/featured'),

    // Get playlist details
    getPlaylist: (id: string) => get<TidalPlaylist>(`/tidal/playlists/${id}`),

    // Get playlist tracks
    getPlaylistTracks: (id: string, limit: number = 50) =>
        get(`/tidal/playlists/${id}/items?limit=${limit}`),

    // Alias for getPlaylistTracks
    getPlaylistItems: (id: string, limit: number = 50) =>
        get(`/tidal/playlists/${id}/items?limit=${limit}`),

    // --- Device Auth Flow ---
    initDeviceAuth: () => post<any>('/tidal/auth/device', {}),

    pollToken: (deviceCode: string) => {
        const visitorId = getVisitorId()
        return post<any>('/tidal/auth/token', { deviceCode, visitorId })
    },

    // --- Web Auth Flow ---
    exchangeCode: (code: string) => post<any>('/tidal/auth/exchange', { code }),

    // Get OAuth login URL (for popup-based login)
    getLoginUrl: async (): Promise<string> => {
        const visitorId = getVisitorId()
        const response = await get<{ authUrl: string }>(`/tidal/auth/login-url?visitorId=${visitorId}`)
        return response.authUrl
    },

    // Get user's playlists
    getUserPlaylists: async (): Promise<{ playlists: TidalPlaylist[] }> => {
        const visitorId = getVisitorId()
        return get<{ playlists: TidalPlaylist[] }>(`/tidal/user/playlists?visitorId=${visitorId}`)
    },

    // Logout
    logout: async (): Promise<{ success: boolean }> => {
        const visitorId = getVisitorId()
        return post<{ success: boolean }>('/tidal/auth/logout', { visitorId })
    },

    // Import playlist to PMS
    importPlaylist: async (playlistId: string, userId: number): Promise<{
        success: boolean
        playlistId?: number
        title?: string
        importedTracks?: number
        totalTracks?: number
    }> => {
        const visitorId = getVisitorId()
        return post('/tidal/import', { visitorId, playlistId, userId })
    },

    // Sync Tidal playlists
    syncTidal: async (data: { tidalAuthData: { access_token: string; refresh_token?: string; expires_in?: number } }) => {
        return post('/tidal/sync', data)
    },

    // Get stream URL for a track
    getStreamUrl: async (trackId: string, quality: string = 'LOSSLESS'): Promise<{
        success: boolean
        streamUrl?: string
        quality?: string
        codec?: string
        bitRate?: number
        sampleRate?: number
        bitDepth?: number
        error?: string
        fallbackSource?: string
        fallbackUrl?: string
    }> => {
        const visitorId = getVisitorId()
        return get(`/tidal/tracks/${trackId}/stream?visitorId=${visitorId}&quality=${quality}`)
    }
}
