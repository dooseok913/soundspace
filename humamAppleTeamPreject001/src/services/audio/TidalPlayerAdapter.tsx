import Hls from 'hls.js'
import { tidalApi } from '../api/tidal'

export interface TidalTrack {
    id: string
    title: string
    artist: string
    album?: string
    artwork?: string
    duration?: number
    tidalId?: string
}

export interface TidalPlaybackState {
    isPlaying: boolean
    currentTrack: TidalTrack | null
    currentTime: number
    duration: number
    volume: number
    isBuffering: boolean
    quality: 'LOW' | 'MEDIUM' | 'HIGH' | 'LOSSLESS' | 'HI_RES_LOSSLESS'
    error: string | null
}

type PlaybackStateListener = (state: TidalPlaybackState) => void

export class TidalPlayerAdapter {
    private static instance: TidalPlayerAdapter
    private playbackState: TidalPlaybackState = {
        isPlaying: false,
        currentTrack: null,
        currentTime: 0,
        duration: 0,
        volume: 0.7,
        isBuffering: false,
        quality: 'LOSSLESS',
        error: null
    }
    private accessToken: string | null = null
    private visitorId: string | null = null
    private audioElement: HTMLAudioElement | null = null
    private hls: Hls | null = null
    private currentStreamUrl: string | null = null
    private listeners: PlaybackStateListener[] = []

    private constructor() {
        this.loadAccessToken()
        this.initAudioElement()
    }

    public static getInstance(): TidalPlayerAdapter {
        if (!TidalPlayerAdapter.instance) {
            TidalPlayerAdapter.instance = new TidalPlayerAdapter()
        }
        return TidalPlayerAdapter.instance
    }

    // Initialize audio element
    private initAudioElement(): void {
        if (typeof window === 'undefined') return

        this.audioElement = document.createElement('audio')
        this.audioElement.preload = 'auto'
        this.audioElement.crossOrigin = 'anonymous'

        // Audio event listeners
        this.audioElement.addEventListener('play', () => {
            this.updateState({ isPlaying: true, error: null })
        })

        this.audioElement.addEventListener('pause', () => {
            this.updateState({ isPlaying: false })
        })

        this.audioElement.addEventListener('timeupdate', () => {
            this.updateState({ currentTime: this.audioElement?.currentTime || 0 })
        })

        this.audioElement.addEventListener('durationchange', () => {
            this.updateState({ duration: this.audioElement?.duration || 0 })
        })

        this.audioElement.addEventListener('waiting', () => {
            this.updateState({ isBuffering: true })
        })

        this.audioElement.addEventListener('canplay', () => {
            this.updateState({ isBuffering: false })
        })

        this.audioElement.addEventListener('error', (e) => {
            console.error('[TidalPlayer] Audio error:', e)
            this.updateState({
                error: 'Tidal 스트리밍 오류가 발생했습니다',
                isPlaying: false,
                isBuffering: false
            })
        })

        this.audioElement.addEventListener('ended', () => {
            this.updateState({ isPlaying: false, currentTime: 0 })
            // Notify listeners that track ended
            this.onTrackEnded?.()
        })

        console.log('[TidalPlayer] Audio element initialized')
    }

    // Callback for track ended
    public onTrackEnded: (() => void) | null = null

    // Load access token from localStorage
    private loadAccessToken(): void {
        this.accessToken = localStorage.getItem('tidal_access_token')
        this.visitorId = localStorage.getItem('tidal_visitor_id')
    }

    // Subscribe to state changes
    public subscribe(listener: PlaybackStateListener): () => void {
        this.listeners.push(listener)
        listener(this.playbackState)
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
        }
    }

    private updateState(updates: Partial<TidalPlaybackState>): void {
        this.playbackState = { ...this.playbackState, ...updates }
        this.listeners.forEach(l => l(this.playbackState))
    }

    // Check if Tidal is connected
    public isConnected(): boolean {
        this.loadAccessToken()
        return !!this.visitorId
    }

    // Get current playback state
    public getPlaybackState(): TidalPlaybackState {
        return { ...this.playbackState }
    }

    // Get audio element (for external use)
    public getAudioElement(): HTMLAudioElement | null {
        return this.audioElement
    }

    // Load and play a Tidal track using HLS.js
    public async loadAndPlay(trackId: string): Promise<boolean> {
        console.log('[TidalPlayer] loadAndPlay called with trackId:', trackId)
        
        if (!trackId || trackId === 'undefined' || trackId === 'null') {
            console.error('[TidalPlayer] Invalid trackId:', trackId)
            return false
        }
        
        if (!this.audioElement) {
            console.error('[TidalPlayer] Audio element not initialized')
            return false
        }

        this.updateState({ isBuffering: true, error: null })

        try {
            // Get stream URL from backend
            console.log('[TidalPlayer] Calling getStreamUrl with trackId:', trackId)
            const response = await tidalApi.getStreamUrl(trackId, this.playbackState.quality)

            if (!response.success || !response.streamUrl) {
                console.warn('[TidalPlayer] Failed to get stream URL:', response.error)
                this.updateState({
                    error: response.error || 'Tidal 스트림 URL을 가져올 수 없습니다',
                    isBuffering: false
                })
                return false
            }

            const streamUrl = response.streamUrl
            console.log(`[TidalPlayer] Got stream URL: quality=${response.quality}, codec=${response.codec}`)

            // Destroy existing HLS instance
            if (this.hls) {
                this.hls.destroy()
                this.hls = null
            }

            // Check if it's an HLS stream (m3u8)
            if (streamUrl.includes('.m3u8') || streamUrl.includes('manifest')) {
                return this.playHlsStream(streamUrl)
            } else {
                // Direct audio URL (AAC, FLAC, etc.)
                return this.playDirectStream(streamUrl)
            }
        } catch (error) {
            console.error('[TidalPlayer] Load error:', error)
            this.updateState({
                error: 'Tidal 트랙 로드 실패',
                isBuffering: false
            })
            return false
        }
    }

    // Play HLS stream using hls.js
    private playHlsStream(url: string): boolean {
        if (!this.audioElement) return false

        if (Hls.isSupported()) {
            console.log('[TidalPlayer] Using HLS.js for playback')

            this.hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                backBufferLength: 90
            })

            this.hls.loadSource(url)
            this.hls.attachMedia(this.audioElement)

            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('[TidalPlayer] HLS manifest parsed, starting playback')
                this.audioElement?.play().catch(e => {
                    console.warn('[TidalPlayer] Autoplay blocked:', e)
                })
            })

            this.hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('[TidalPlayer] HLS error:', data)
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log('[TidalPlayer] Network error, trying to recover...')
                            this.hls?.startLoad()
                            break
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('[TidalPlayer] Media error, trying to recover...')
                            this.hls?.recoverMediaError()
                            break
                        default:
                            this.updateState({
                                error: 'HLS 재생 오류가 발생했습니다',
                                isPlaying: false,
                                isBuffering: false
                            })
                            this.hls?.destroy()
                            break
                    }
                }
            })

            this.currentStreamUrl = url
            return true
        } else if (this.audioElement.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari native HLS support
            console.log('[TidalPlayer] Using native HLS support (Safari)')
            this.audioElement.src = url
            this.audioElement.play().catch(e => {
                console.warn('[TidalPlayer] Autoplay blocked:', e)
            })
            this.currentStreamUrl = url
            return true
        } else {
            console.error('[TidalPlayer] HLS not supported')
            this.updateState({
                error: '이 브라우저는 HLS 재생을 지원하지 않습니다',
                isBuffering: false
            })
            return false
        }
    }

    // Play direct audio stream (AAC, FLAC, MP3)
    private playDirectStream(url: string): boolean {
        if (!this.audioElement) return false

        console.log('[TidalPlayer] Using direct audio playback')
        this.audioElement.src = url
        this.audioElement.play().catch(e => {
            console.warn('[TidalPlayer] Autoplay blocked:', e)
        })
        this.currentStreamUrl = url
        return true
    }

    // Get stream URL (for external use)
    public async getStreamUrl(trackId: string, quality: string = 'LOSSLESS'): Promise<string | null> {
        try {
            const response = await tidalApi.getStreamUrl(trackId, quality)
            if (response.success && response.streamUrl) {
                console.log(`[TidalPlayer] Got stream URL: quality=${response.quality}, codec=${response.codec}`)
                return response.streamUrl
            }

            if (response.fallbackSource === 'YOUTUBE') {
                console.log('[TidalPlayer] Tidal streaming unavailable, fallback to YouTube')
                return null
            }

            console.warn('[TidalPlayer] Failed to get stream URL:', response.error)
            return null
        } catch (error) {
            console.error('[TidalPlayer] Stream URL error:', error)
            return null
        }
    }

    // Get Tidal track info from PMS track
    public async getTidalTrackFromPms(trackId: number): Promise<TidalTrack | null> {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/tracks/${trackId}`)

            if (!response.ok) {
                return null
            }

            const trackData = await response.json()

            let tidalId = trackData.tidalId
            if (!tidalId && trackData.externalMetadata) {
                try {
                    const metadata = typeof trackData.externalMetadata === 'string'
                        ? JSON.parse(trackData.externalMetadata)
                        : trackData.externalMetadata
                    tidalId = metadata.tidalId
                } catch (e) {
                    // ignore parse error
                }
            }

            if (tidalId) {
                return {
                    id: tidalId.toString(),
                    title: trackData.title,
                    artist: trackData.artist,
                    album: trackData.album,
                    artwork: trackData.artwork,
                    duration: trackData.duration,
                    tidalId: tidalId.toString()
                }
            }

            return null
        } catch (error) {
            console.error('[TidalPlayer] Failed to get Tidal track from PMS:', error)
            return null
        }
    }

    // Playback controls
    public async play(): Promise<void> {
        if (this.audioElement) {
            try {
                await this.audioElement.play()
            } catch (e) {
                console.warn('[TidalPlayer] Play failed:', e)
            }
        }
    }

    public pause(): void {
        if (this.audioElement) {
            this.audioElement.pause()
        }
    }

    public seek(seconds: number): void {
        if (this.audioElement) {
            this.audioElement.currentTime = seconds
        }
    }

    public setVolume(volume: number): void {
        this.updateState({ volume })
        if (this.audioElement) {
            this.audioElement.volume = Math.max(0, Math.min(1, volume))
        }
    }

    // Quality settings
    public getQualityLevel(): 'LOW' | 'MEDIUM' | 'HIGH' | 'LOSSLESS' | 'HI_RES_LOSSLESS' {
        return this.playbackState.quality
    }

    public setQualityLevel(quality: 'LOW' | 'MEDIUM' | 'HIGH' | 'LOSSLESS' | 'HI_RES_LOSSLESS'): void {
        this.updateState({ quality })
    }

    // Token management
    public updateAccessToken(accessToken: string): void {
        this.accessToken = accessToken
        localStorage.setItem('tidal_access_token', accessToken)
    }

    public clearAccessToken(): void {
        this.accessToken = null
        localStorage.removeItem('tidal_access_token')
    }

    // Cleanup
    public destroy(): void {
        if (this.hls) {
            this.hls.destroy()
            this.hls = null
        }
        if (this.audioElement) {
            this.audioElement.pause()
            this.audioElement.src = ''
        }
        this.currentStreamUrl = null
    }
}

// Export singleton instance
export const tidalPlayer = TidalPlayerAdapter.getInstance()

// === Export functions for AudioService compatibility ===

export async function initTidalPlayer(): Promise<TidalPlayerAdapter | null> {
    const player = TidalPlayerAdapter.getInstance()
    if (player.isConnected()) {
        console.log('[TidalPlayer] Initialized')
        return player
    }
    console.log('[TidalPlayer] Not connected')
    return null
}

export async function playTidalTrack(tidalId: string): Promise<boolean> {
    const player = TidalPlayerAdapter.getInstance()
    return player.loadAndPlay(tidalId)
}

export async function resumeTidal(): Promise<void> {
    tidalPlayer.play()
}

export async function pauseTidal(): Promise<void> {
    tidalPlayer.pause()
}

export async function seekTidal(seconds: number): Promise<void> {
    tidalPlayer.seek(seconds)
}

export async function setTidalVolume(volume: number): Promise<void> {
    tidalPlayer.setVolume(volume)
}
