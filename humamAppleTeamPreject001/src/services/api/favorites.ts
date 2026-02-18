import { playlistsApi, Playlist, Track, PlaylistWithTracks } from './playlists'

const FAVORITES_PLAYLIST_TITLE = '❤️ My Favorites'

export interface FavoriteTrack {
    title: string
    artist: string
    album?: string
    duration?: number
    tidalId?: string
    artwork?: string
    url?: string
    audio?: string
}

// Cache for favorites to reduce API calls
let favoritesCache: Track[] | null = null
let favoritePlaylistCache: Playlist | null = null
let cacheTimestamp = 0
const CACHE_TTL = 30000 // 30 seconds

const clearCache = () => {
    favoritesCache = null
    favoritePlaylistCache = null
    cacheTimestamp = 0
}

// Favorites Service - Uses existing playlist system
export const favoritesService = {
    // Get or create the user's favorites playlist (PMS - 사용자가 직접 좋아요한 곡)
    getFavoritesPlaylist: async (): Promise<Playlist | null> => {
        // Use cache if valid
        if (favoritePlaylistCache && Date.now() - cacheTimestamp < CACHE_TTL) {
            return favoritePlaylistCache
        }

        try {
            // PMS에서 먼저 찾기
            const pmsResponse = await playlistsApi.getPlaylists('PMS')
            let favPlaylist = pmsResponse.playlists.find(p => p.title === FAVORITES_PLAYLIST_TITLE)

            // 기존 EMS에 있으면 마이그레이션 (하위 호환)
            if (!favPlaylist) {
                const emsResponse = await playlistsApi.getPlaylists('EMS')
                favPlaylist = emsResponse.playlists.find(p => p.title === FAVORITES_PLAYLIST_TITLE || p.title === 'My Favorites')
            }

            if (favPlaylist) {
                favoritePlaylistCache = favPlaylist
                cacheTimestamp = Date.now()
            }
            return favPlaylist || null
        } catch (e) {
            console.error('[Favorites] Failed to get favorites playlist:', e)
            return null
        }
    },

    // Create favorites playlist if it doesn't exist (PMS에 생성)
    createFavoritesPlaylist: async (): Promise<Playlist | null> => {
        try {
            const response = await playlistsApi.create({
                title: FAVORITES_PLAYLIST_TITLE,
                description: '내가 좋아요한 곡 모음',
                spaceType: 'PMS',  // PMS로 변경 - 사용자가 직접 호감 표시
                sourceType: 'System',
                status: 'PFP'  // Processing Finished (완료)
            })
            clearCache()
            return response
        } catch (e) {
            console.error('[Favorites] Failed to create favorites playlist:', e)
            return null
        }
    },

    // Get or create favorites playlist
    getOrCreateFavoritesPlaylist: async (): Promise<Playlist | null> => {
        let playlist = await favoritesService.getFavoritesPlaylist()
        if (!playlist) {
            playlist = await favoritesService.createFavoritesPlaylist()
        }
        return playlist
    },

    // Get all favorite tracks
    getFavorites: async (forceRefresh = false): Promise<Track[]> => {
        // Use cache if valid
        if (!forceRefresh && favoritesCache && Date.now() - cacheTimestamp < CACHE_TTL) {
            return favoritesCache
        }

        const playlist = await favoritesService.getFavoritesPlaylist()
        if (!playlist) return []

        try {
            const data = await playlistsApi.getById(playlist.id) as unknown as PlaylistWithTracks
            favoritesCache = data.tracks || []
            cacheTimestamp = Date.now()
            return favoritesCache
        } catch (e) {
            console.error('[Favorites] Failed to get favorites:', e)
            return []
        }
    },

    // Check if a track is favorited (by title + artist match)
    isFavorited: async (track: FavoriteTrack): Promise<boolean> => {
        const favorites = await favoritesService.getFavorites()
        return favorites.some(f => 
            f.title.toLowerCase().trim() === track.title.toLowerCase().trim() &&
            f.artist.toLowerCase().trim() === track.artist.toLowerCase().trim()
        )
    },

    // Add track to favorites
    addFavorite: async (track: FavoriteTrack): Promise<boolean> => {
        try {
            const playlist = await favoritesService.getOrCreateFavoritesPlaylist()
            if (!playlist) {
                console.error('[Favorites] Failed to get/create favorites playlist')
                return false
            }

            // Check if already favorited
            const alreadyFavorited = await favoritesService.isFavorited(track)
            if (alreadyFavorited) {
                console.log('[Favorites] Track already in favorites')
                return true
            }

            // Backend expects: { track: { title, artist, album, duration, artwork, url, audio, id } }
            await playlistsApi.addTrack(playlist.id, {
                id: track.tidalId || '',
                title: track.title,
                artist: track.artist,
                album: track.album || '',
                duration: track.duration || 0,
                artwork: track.artwork || '',
                url: track.url || '',
                audio: track.audio || ''
            })

            clearCache()
            console.log('[Favorites] Added to favorites:', track.title)
            return true
        } catch (e) {
            console.error('[Favorites] Failed to add favorite:', e)
            return false
        }
    },

    // Remove track from favorites
    removeFavorite: async (track: FavoriteTrack): Promise<boolean> => {
        try {
            const playlist = await favoritesService.getFavoritesPlaylist()
            if (!playlist) return false

            const favorites = await favoritesService.getFavorites(true) // Force refresh
            const favoriteTrack = favorites.find(f =>
                f.title.toLowerCase().trim() === track.title.toLowerCase().trim() &&
                f.artist.toLowerCase().trim() === track.artist.toLowerCase().trim()
            )

            if (favoriteTrack) {
                await playlistsApi.removeTrack(playlist.id, favoriteTrack.id)
                clearCache()
                console.log('[Favorites] Removed from favorites:', track.title)
                return true
            }

            return false
        } catch (e) {
            console.error('[Favorites] Failed to remove favorite:', e)
            return false
        }
    },

    // Toggle favorite status - returns new status (true = favorited)
    toggleFavorite: async (track: FavoriteTrack): Promise<boolean> => {
        const isFav = await favoritesService.isFavorited(track)
        if (isFav) {
            await favoritesService.removeFavorite(track)
            return false
        } else {
            await favoritesService.addFavorite(track)
            return true
        }
    },

    // Clear cache (call when needed)
    clearCache,

    // Get favorites count
    getFavoritesCount: async (): Promise<number> => {
        const favorites = await favoritesService.getFavorites()
        return favorites.length
    },

    // Get favorites playlist info (for display)
    getFavoritesInfo: async (): Promise<{ playlist: Playlist | null; tracks: Track[]; count: number }> => {
        const playlist = await favoritesService.getFavoritesPlaylist()
        if (!playlist) {
            return { playlist: null, tracks: [], count: 0 }
        }
        const tracks = await favoritesService.getFavorites()
        return { playlist, tracks, count: tracks.length }
    }
}
