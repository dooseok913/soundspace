import { youtubeApi } from '../api/youtube'
import { itunesService } from '../api/itunes'
import { tidalApi } from '../api/tidal'
import { tidalPlayer, TidalPlaybackState } from './TidalPlayerAdapter'
import { Track } from '../api/playlists'

// Audio Source Types
export type AudioSourceType = 'YOUTUBE' | 'FILE' | 'TIDAL' | 'ITUNES_PREVIEW' | 'UNKNOWN'

// Interface for currently playing audio
export interface AudioState {
    isPlaying: boolean
    currentTime: number
    duration: number
    volume: number
    isBuffering: boolean
    sourceType: AudioSourceType
    error: string | null
}

class AudioService {
    private static instance: AudioService
    private player: any | null = null
    public state: AudioState = {
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 0.7,
        isBuffering: false,
        sourceType: 'UNKNOWN',
        error: null
    }

    // Listeners
    private listeners: ((state: AudioState) => void)[] = []

    // Track if we're using Tidal player
    private usingTidalPlayer: boolean = false

    private constructor() {
        // Subscribe to Tidal player state
        tidalPlayer.subscribe((tidalState: TidalPlaybackState) => {
            if (this.usingTidalPlayer) {
                this.updateState({
                    isPlaying: tidalState.isPlaying,
                    currentTime: tidalState.currentTime,
                    duration: tidalState.duration,
                    isBuffering: tidalState.isBuffering,
                    error: tidalState.error
                })
            }
        })

        // Handle Tidal track ended
        tidalPlayer.onTrackEnded = () => {
            if (this.usingTidalPlayer) {
                this.onEnded?.()
            }
        }
    }

    // Callback for track ended (set by MusicContext)
    public onEnded: (() => void) | null = null

    public static getInstance(): AudioService {
        if (!AudioService.instance) {
            AudioService.instance = new AudioService()
        }
        return AudioService.instance
    }

    // Set ReactPlayer reference (for non-Tidal sources)
    public setPlayer(player: any | null) {
        this.player = player
    }

    public subscribe(listener: (state: AudioState) => void) {
        this.listeners.push(listener)
        // Send current state immediately
        listener(this.state)
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
        }
    }

    private updateState(updates: Partial<AudioState>) {
        this.state = { ...this.state, ...updates }
        this.listeners.forEach(l => l(this.state))
    }

    // Controls
    public async play() {
        if (this.usingTidalPlayer) {
            await tidalPlayer.play()
        }
        this.updateState({ isPlaying: true })
    }

    public async pause() {
        if (this.usingTidalPlayer) {
            tidalPlayer.pause()
        }
        this.updateState({ isPlaying: false })
    }

    public async togglePlay() {
        if (this.state.isPlaying) {
            await this.pause()
        } else {
            await this.play()
        }
    }

    public async seekTo(seconds: number) {
        if (this.usingTidalPlayer) {
            tidalPlayer.seek(seconds)
        } else if (this.player) {
            this.player.seekTo(seconds, 'seconds')
        }
        this.updateState({ currentTime: seconds })
    }

    public async setVolume(volume: number) { // 0 to 1
        if (this.usingTidalPlayer) {
            tidalPlayer.setVolume(volume)
        }
        this.updateState({ volume })
    }

    // Stop Tidal playback (when switching to another source)
    private stopTidalPlayback() {
        if (this.usingTidalPlayer) {
            tidalPlayer.pause()
            this.usingTidalPlayer = false
        }
    }

    // Handlers for ReactPlayer events - Arrow functions to bind 'this' automatically
    public onProgress = (state: { playedSeconds: number }) => {
        if (!this.state.isBuffering && !this.usingTidalPlayer) {
            this.updateState({ currentTime: state.playedSeconds })
        }
    }

    public onDuration = (duration: number) => {
        if (!this.usingTidalPlayer) {
            this.updateState({ duration })
        }
    }

    public onBuffer = () => {
        if (!this.usingTidalPlayer) {
            this.updateState({ isBuffering: true })
        }
    }

    public onBufferEnd = () => {
        if (!this.usingTidalPlayer) {
            this.updateState({ isBuffering: false })
        }
    }

    public onError = (error: any) => {
        if (!this.usingTidalPlayer) {
            this.updateState({ error: 'Playback error', isPlaying: false })
            console.error('AudioService Error:', error)
        }
    }

    // Helper to determine source type
    public getSourceType(track: Track): AudioSourceType {
        // Check if track came from Tidal import
        if (track.sourceType === 'TIDAL' || track.original_playlist_source === 'Tidal') return 'TIDAL'
        // Check if tidalId exists in track or externalMetadata
        if (track.tidalId) return 'TIDAL'
        if (track.externalMetadata) {
            try {
                const metadata = typeof track.externalMetadata === 'string' 
                    ? JSON.parse(track.externalMetadata) 
                    : track.externalMetadata
                if (metadata.tidalId) return 'TIDAL'
            } catch (e) {
                // ignore parse error
            }
        }
        if (track.url?.includes('youtube.com') || track.url?.includes('youtu.be')) return 'YOUTUBE'
        if (track.url?.includes('audio-ssl.itunes.apple.com')) return 'ITUNES_PREVIEW'
        return 'UNKNOWN'
    }

    /**
     * Resolve playback URL and determine source type.
     * Priority: Tidal HLS > iTunes Preview > YouTube (stored) > Direct URL > YouTube Smart Match
     * 
     * Returns: { url: string | null, useTidal: boolean }
     */
    public async resolveAndPlay(track: Track): Promise<string | null> {
        // Stop any existing Tidal playback
        this.stopTidalPlayback()

        let url: string | null = null
        const sourceType = this.getSourceType(track)

        console.log(`[AudioService] Resolving playback for: "${track.title}" by ${track.artist}`)

        // Parse externalMetadata - can be string (from DB) or object
        let parsedMetadata: Record<string, any> = {}
        if (track.externalMetadata) {
            if (typeof track.externalMetadata === 'string') {
                try {
                    parsedMetadata = JSON.parse(track.externalMetadata)
                } catch (e) {
                    console.warn('[AudioService] Failed to parse externalMetadata:', e)
                    parsedMetadata = {}
                }
            } else if (typeof track.externalMetadata === 'object') {
                parsedMetadata = track.externalMetadata
            }
        }

        // === PRIORITY 1: Tidal High-Quality Playback (If tidalId exists AND user is connected) ===
        const tidalVisitorId = localStorage.getItem('tidal_visitor_id')
        
        // Extract tidalId from various sources (in priority order)
        // 1. Direct tidalId on track object
        // 2. Parsed externalMetadata.tidalId
        // 3. sourceId if source is TIDAL
        const tidalId = track.tidalId || 
            parsedMetadata.tidalId || 
            (sourceType === 'TIDAL' ? track.sourceId : null)
        
        // Debug: Log all possible tidalId sources
        console.log('[AudioService] Track data for tidalId extraction:', {
            trackId: track.id,
            'track.tidalId': track.tidalId,
            'track.sourceId': track.sourceId,
            'parsedMetadata.tidalId': parsedMetadata.tidalId,
            'raw externalMetadata': track.externalMetadata,
            'extracted tidalId': tidalId,
            sourceType
        })

        if (tidalVisitorId && tidalId) {
            console.log(`[AudioService] Tidal visitor found with tidalId: ${tidalId}`)
            try {
                console.log(`[AudioService] Attempting Tidal HLS stream for ID: ${tidalId}`)
                
                // Use TidalPlayerAdapter to load and play
                const success = await tidalPlayer.loadAndPlay(tidalId.toString())
                
                if (success) {
                    console.log(`[AudioService] Tidal HLS playback started`)
                    this.usingTidalPlayer = true
                    this.updateState({
                        sourceType: 'TIDAL',
                        isBuffering: false,
                        error: null
                    })
                    // Return special marker to indicate Tidal is handling playback
                    return 'TIDAL_INTERNAL'
                } else {
                    console.warn('[AudioService] Tidal HLS failed, falling back...')
                }
            } catch (e) {
                console.warn('[AudioService] Tidal playback failed, falling back...', e)
            }
        } else if (tidalVisitorId && !tidalId) {
            // === PRIORITY 1.5: Tidal Search (No tidalId but user is connected) ===
            console.log('[AudioService] No tidalId, searching Tidal for:', track.title, track.artist)
            try {
                const searchQuery = `${track.artist} ${track.title}`.trim()
                const searchResult = await tidalApi.searchTracks(searchQuery, 3)
                
                if (searchResult.tracks && searchResult.tracks.length > 0) {
                    // Find best match (first result or match by title/artist)
                    const matchedTrack = searchResult.tracks.find((t: any) => {
                        const titleMatch = t.title?.toLowerCase().includes(track.title.toLowerCase()) ||
                            track.title.toLowerCase().includes(t.title?.toLowerCase())
                        const artistMatch = t.artist?.name?.toLowerCase().includes(track.artist.toLowerCase()) ||
                            track.artist.toLowerCase().includes(t.artist?.name?.toLowerCase())
                        return titleMatch && artistMatch
                    }) || searchResult.tracks[0]
                    
                    const foundTidalId = matchedTrack.id?.toString()
                    
                    if (foundTidalId) {
                        console.log(`[AudioService] Found Tidal track via search: ${foundTidalId} - ${matchedTrack.title}`)
                        
                        const success = await tidalPlayer.loadAndPlay(foundTidalId)
                        
                        if (success) {
                            console.log(`[AudioService] Tidal search match playback started`)
                            this.usingTidalPlayer = true
                            this.updateState({
                                sourceType: 'TIDAL',
                                isBuffering: false,
                                error: null
                            })
                            return 'TIDAL_INTERNAL'
                        }
                    }
                }
                console.log('[AudioService] No Tidal match found, falling back...')
            } catch (e) {
                console.warn('[AudioService] Tidal search failed, falling back...', e)
            }
        }

        // === PRIORITY 2: Tidal Track without login - Show helpful message ===
        if (sourceType === 'TIDAL' && !tidalVisitorId) {
            console.log('[AudioService] Tidal track - user not connected, falling back to alternatives')
            // Will try to find alternatives below
        }

        // === PRIORITY 3: Existing YouTube ID (stored) ===
        if (parsedMetadata.youtubeId) {
            url = `https://www.youtube.com/watch?v=${parsedMetadata.youtubeId}`
            console.log('[AudioService] Using stored YouTube ID:', parsedMetadata.youtubeId)
            this.updateState({
                sourceType: 'YOUTUBE',
                isBuffering: true,
                error: null
            })
            return url
        }

        // === PRIORITY 4: Direct YouTube URL ===
        if (track.url && (track.url.includes('youtube.com') || track.url.includes('youtu.be'))) {
            console.log('[AudioService] Using direct YouTube URL')
            this.updateState({ sourceType: 'YOUTUBE', isBuffering: true, error: null })
            return track.url
        }

        // === PRIORITY 5: YouTube Smart Match ===
        this.updateState({ isBuffering: true, error: null })
        const searchQueries = [
            `${track.artist} - ${track.title} audio`,
            `${track.title} ${track.artist}`,
            `${track.title} official audio`
        ]

        for (const query of searchQueries) {
            try {
                console.log(`[YouTube SmartMatch] Trying: "${query}"`)
                const response = await youtubeApi.searchVideos(query, 1)

                if (response?.playlists && response.playlists.length > 0) {
                    const video = response.playlists[0]
                    url = `https://www.youtube.com/watch?v=${video.id}`
                    console.log(`[YouTube SmartMatch] Found: ${url}`)
                    this.updateState({
                        sourceType: 'YOUTUBE',
                        isBuffering: true,
                        error: null
                    })
                    return url
                }
            } catch (e) {
                console.warn(`[YouTube SmartMatch] Query failed: "${query}"`, e)
            }
        }

        // === PRIORITY 6: iTunes Preview (stored) ===
        const previewUrl = parsedMetadata.previewUrl || track.previewUrl || track.audio
        if (previewUrl && previewUrl.includes('audio-ssl.itunes.apple.com')) {
            console.log('[AudioService] Using iTunes Preview URL')
            this.updateState({
                sourceType: 'ITUNES_PREVIEW',
                isBuffering: true,
                error: null
            })
            return previewUrl
        }

        // === PRIORITY 7: Direct iTunes URL ===
        if (track.url?.includes('audio-ssl.itunes.apple.com')) {
            console.log('[AudioService] Using direct iTunes URL')
            this.updateState({ sourceType: 'ITUNES_PREVIEW', isBuffering: true, error: null })
            return track.url
        }

        // === PRIORITY 8: iTunes Smart Match (30-sec preview) ===
        try {
            const itunesQuery = `${track.artist} ${track.title}`.trim()
            console.log(`[iTunes SmartMatch] Searching: "${itunesQuery}"`)
            const itunesResults = await itunesService.search(itunesQuery)

            if (itunesResults && itunesResults.length > 0) {
                const match = itunesResults[0]
                const itunesPreviewUrl = match.audio || match.previewUrl
                if (itunesPreviewUrl) {
                    console.log(`[iTunes SmartMatch] Found: ${match.title} by ${match.artist}`)
                    this.updateState({
                        sourceType: 'ITUNES_PREVIEW',
                        isBuffering: true,
                        error: null
                    })
                    return itunesPreviewUrl
                }
            }
        } catch (e) {
            console.warn('[iTunes SmartMatch] Failed:', e)
        }

        // === NO SOURCE FOUND ===
        const errorMsg = sourceType === 'TIDAL' && !tidalVisitorId
            ? 'Tidal 로그인이 필요합니다 (Connections에서 연결해주세요)'
            : `"${track.title}" 재생 소스를 찾을 수 없습니다`

        console.error('[AudioService] No playable source found')
        this.updateState({
            error: errorMsg,
            isPlaying: false,
            isBuffering: false
        })
        return null
    }

    // Check if currently using Tidal player
    public isUsingTidalPlayer(): boolean {
        return this.usingTidalPlayer
    }
}

export const audioService = AudioService.getInstance()
