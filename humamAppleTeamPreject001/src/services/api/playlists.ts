import { get, post, patch, del } from './index'

// Types
// Types matching Backend Response
export interface Playlist {
    id: number
    title: string
    description?: string
    spaceType: 'EMS' | 'GMS' | 'PMS'
    status: 'PTP' | 'PRP' | 'PFP'
    sourceType: 'Platform' | 'Upload' | 'System'
    externalId?: string
    coverImage?: string
    trackArtworks?: string[]  // 트랙 앨범 이미지 배열 (동적 커버용)
    createdAt: string
    updatedAt: string
    trackCount: number
    aiScore?: number
}

export interface Track {
    id: number
    title: string
    artist: string
    album: string
    duration: number // in seconds
    isrc?: string
    orderIndex: number
    artwork?: string
    // tidalId can be directly on track or in externalMetadata
    tidalId?: string
    sourceId?: string
    sourceType?: string
    // Optional URL for direct playback (YouTube, iTunes preview, etc.)
    url?: string
    // Preview URL from iTunes
    previewUrl?: string
    // Audio URL (alias for previewUrl)
    audio?: string
    // Original playlist source indicator
    original_playlist_source?: string
    // externalMetadata can be object or JSON string from DB
    externalMetadata?: string | {
        tidalId?: string;
        youtubeId?: string;
        previewUrl?: string;
        thumbnail?: string;
        isrc?: string;
        [key: string]: any;
    }
}

export interface PlaylistWithTracks extends Playlist {
    tracks: Track[]
}

export interface PlaylistsResponse {
    playlists: Playlist[]
    total: number
}

export interface ImportTidalRequest {
    playlists: {
        uuid?: string
        id?: string
        title?: string
        name?: string
        numberOfTracks?: number
        trackCount?: number
        squareImage?: string
    }[]
}

// Playlists API Service
export const playlistsApi = {
    // Get all playlists with optional filters
    getAll: (filters?: { spaceType?: string; status?: string; source?: string }) => {
        const params = new URLSearchParams()
        if (filters?.spaceType) params.append('spaceType', filters.spaceType)
        if (filters?.status) params.append('status', filters.status)
        if (filters?.source) params.append('source', filters.source)

        const query = params.toString()
        return get<PlaylistsResponse>(`/playlists${query ? `?${query}` : ''}`)
    },

    // Get single playlist
    getById: (id: number) => get<Playlist>(`/playlists/${id}`),

    // Create playlist
    create: (data: Partial<Playlist>) => post<Playlist>('/playlists', data),

    // Import from Tidal (Single Playlist)
    importPlaylist: (data: {
        platformPlaylistId: string;
        title: string;
        description?: string;
        coverImage?: string;
        platform?: string;
    }) => post<{ message: string; playlist: Playlist }>('/playlists/import', data),

    // Update status
    updateStatus: (id: number, status: Playlist['status']) =>
        patch<Playlist>(`/playlists/${id}/status`, { status }),

    // Move to different space (EMS -> GMS -> PMS)
    moveToSpace: (id: number, spaceType: Playlist['spaceType']) =>
        patch<Playlist>(`/playlists/${id}/move`, { spaceType }),

    // Update details (Title/Description)
    updateDetails: (id: number, details: { title: string, description?: string }) =>
        patch<{ message: string, playlist: Playlist }>(`/playlists/${id}`, details),

    // Delete playlist
    delete: (id: number) => del<{ message: string; playlist: Playlist }>(`/playlists/${id}`),

    // Aliases for component compatibility
    getPlaylists: (spaceType?: string) => playlistsApi.getAll({ spaceType }),
    deletePlaylist: (id: number) => playlistsApi.delete(id),
    movePlaylist: (id: number, spaceType: Playlist['spaceType']) => playlistsApi.moveToSpace(id, spaceType),

    // Tracks
    addTrack: (playlistId: number, track: any) => post<{ message: string; trackId: number }>(`/playlists/${playlistId}/tracks`, { track }),
    removeTrack: (playlistId: number, trackId: number) => del<{ message: string }>(`/playlists/${playlistId}/tracks/${trackId}`),
    
    // Search tracks by artist/title in DB
    searchTracks: (query: string, limit: number = 20) =>
        get<{ tracks: Track[] }>(`/playlists/tracks/search?q=${encodeURIComponent(query)}&limit=${limit}`),

    // Import Album as Playlist (Backend handles tracks in batch)
    importAlbumAsPlaylist: (album: { title: string; artist: string; tracks: any[]; coverImage: string }) =>
        post<{ message: string; playlist: Playlist; count: number }>('/playlists/import-album', album),

    // Seed initial playlists (auto-load on first access)
    seedPlaylists: () => post<{ message: string; imported: number; existing?: number }>('/playlists/seed', {})
}


export const analysisApi = {
    train: () => post<{ status: string; profile: any }>('/analysis/train', {}),
    evaluate: (playlistId: number) => post<{ score: number; grade: string; reason: string }>(`/analysis/evaluate/${playlistId}`, {})
}
