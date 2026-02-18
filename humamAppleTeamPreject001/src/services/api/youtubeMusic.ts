import { get, post } from './index'

// Types
export interface YouTubeUser {
    id: string
    name: string
    picture?: string
}

export interface YouTubePlaylist {
    id: string
    name: string
    description?: string
    image?: string
    trackCount: number
    publishedAt?: string
}

export interface YouTubeTrack {
    videoId: string
    title: string
    channelTitle?: string
    thumbnail?: string
    description?: string
    publishedAt?: string
    position?: number
}

export interface YouTubeAuthStatus {
    connected: boolean
    user?: {
        id: string
        name: string
        picture?: string
    }
    error?: string
}

export interface YouTubePlaylistsResponse {
    playlists: YouTubePlaylist[]
    total: number
    nextPageToken?: string
    prevPageToken?: string
}

export interface YouTubeTracksResponse {
    tracks: YouTubeTrack[]
    total: number
    nextPageToken?: string
    hasMore: boolean
}

export interface YouTubeImportResponse {
    success: boolean
    playlistId: number
    title: string
    importedTracks: number
    totalTracks: number
}

// Get visitor ID for session management
function getVisitorId(): string {
    let visitorId = localStorage.getItem('youtube_visitor_id')
    if (!visitorId) {
        visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        localStorage.setItem('youtube_visitor_id', visitorId)
    }
    return visitorId
}

const REDIRECT_URI = 'https://imapplepie20.tplinkdns.com:8443/youtube-callback'

// YouTube Music API Service
export const youtubeMusicApi = {
    // Get login URL
    getLoginUrl: async () => {
        const visitorId = getVisitorId()
        const response = await get<{ authUrl: string }>(`/youtube-music/auth/login?visitorId=${visitorId}&redirectUri=${encodeURIComponent(REDIRECT_URI)}`)
        return response.authUrl
    },

    // Exchange authorization code for tokens
    exchangeCode: (code: string, state: string) => {
        return post<{ success: boolean; user: YouTubeUser; visitorId: string }>('/youtube-music/auth/exchange', {
            code,
            state,
            redirectUri: REDIRECT_URI
        })
    },

    // Check authentication status
    getAuthStatus: () => {
        const visitorId = getVisitorId()
        return get<YouTubeAuthStatus>(`/youtube-music/auth/status?visitorId=${visitorId}`)
    },

    // Logout / disconnect
    logout: () => {
        const visitorId = getVisitorId()
        return post<{ success: boolean }>('/youtube-music/auth/logout', { visitorId })
    },

    // Get user's playlists
    getPlaylists: (maxResults = 50, pageToken?: string) => {
        const visitorId = getVisitorId()
        let url = `/youtube-music/playlists?visitorId=${visitorId}&maxResults=${maxResults}`
        if (pageToken) url += `&pageToken=${pageToken}`
        return get<YouTubePlaylistsResponse>(url)
    },

    // Get playlist items
    getPlaylistItems: (playlistId: string, maxResults = 50, pageToken?: string) => {
        const visitorId = getVisitorId()
        let url = `/youtube-music/playlists/${playlistId}/items?visitorId=${visitorId}&maxResults=${maxResults}`
        if (pageToken) url += `&pageToken=${pageToken}`
        return get<YouTubeTracksResponse>(url)
    },

    // Import playlist to PMS
    importPlaylist: (playlistId: string, userId: number) => {
        const visitorId = getVisitorId()
        return post<YouTubeImportResponse>('/youtube-music/import', {
            visitorId,
            playlistId,
            userId
        })
    },

    // Get liked videos
    getLikedVideos: (maxResults = 50, pageToken?: string) => {
        const visitorId = getVisitorId()
        let url = `/youtube-music/liked?visitorId=${visitorId}&maxResults=${maxResults}`
        if (pageToken) url += `&pageToken=${pageToken}`
        return get<YouTubeTracksResponse>(url)
    }
}
