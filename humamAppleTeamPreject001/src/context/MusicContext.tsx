import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react'
import { Track } from '../services/api/playlists'
import { audioService, AudioState } from '../services/audio/AudioService'

// Repeat modes
export type RepeatMode = 'off' | 'all' | 'one'

// Recently played types
export interface RecentTrackEntry {
    track: Track
    playedAt: string // ISO timestamp
}

const RECENT_TRACKS_KEY = 'recently_played'
const MAX_RECENT_TRACKS = 50

interface MusicContextType {
    currentTrack: Track | null
    isPlaying: boolean
    queue: Track[]
    originalQueue: Track[]  // Original queue before shuffle
    playTrack: (track: Track) => void
    togglePlay: () => void
    setQueue: (tracks: Track[]) => void
    playPlaylist: (tracks: Track[], startIndex?: number) => void
    playNext: () => void
    playPrevious: () => void
    audioState: AudioState
    resolvedUrl: string | null
    // Shuffle & Repeat
    isShuffled: boolean
    repeatMode: RepeatMode
    toggleShuffle: () => void
    toggleRepeat: () => void
    // Recently Played
    recentTracks: RecentTrackEntry[]
    getRecentTracks: () => RecentTrackEntry[]
    clearRecentTracks: () => void
}

const MusicContext = createContext<MusicContextType | undefined>(undefined)

export const useMusic = () => {
    const context = useContext(MusicContext)
    if (context === undefined) {
        throw new Error('useMusic must be used within a MusicProvider')
    }
    return context
}

// Fisher-Yates shuffle algorithm
const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
}

export const MusicProvider = ({ children }: { children: ReactNode }) => {
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
    const [queue, setQueueState] = useState<Track[]>([])
    const [originalQueue, setOriginalQueue] = useState<Track[]>([]) // For unshuffling
    const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
    const [isShuffled, setIsShuffled] = useState(false)
    const [repeatMode, setRepeatMode] = useState<RepeatMode>('off')

    // Recently played state
    const [recentTracks, setRecentTracks] = useState<RecentTrackEntry[]>(() => {
        try {
            const saved = localStorage.getItem(RECENT_TRACKS_KEY)
            return saved ? JSON.parse(saved) : []
        } catch {
            return []
        }
    })

    // Subscribe to AudioService state
    const [audioState, setAudioState] = useState(audioService.state)

    useEffect(() => {
        const unsubscribe = audioService.subscribe((state) => {
            setAudioState(state)
        })
        return unsubscribe
    }, [])

    const addToRecentTracks = useCallback((track: Track) => {
        setRecentTracks(prev => {
            // Remove duplicate (same title + artist)
            const filtered = prev.filter(
                entry => !(entry.track.title === track.title && entry.track.artist === track.artist)
            )
            // Add to front with current timestamp
            const updated = [{ track, playedAt: new Date().toISOString() }, ...filtered].slice(0, MAX_RECENT_TRACKS)
            localStorage.setItem(RECENT_TRACKS_KEY, JSON.stringify(updated))
            return updated
        })
    }, [])

    const getRecentTracks = useCallback(() => recentTracks, [recentTracks])

    const clearRecentTracks = useCallback(() => {
        localStorage.removeItem(RECENT_TRACKS_KEY)
        setRecentTracks([])
    }, [])

    // queueRef: always reflects current queue (avoids stale closure in async callbacks)
    const queueRef = useRef<Track[]>([])
    useEffect(() => { queueRef.current = queue }, [queue])

    const playTrack = async (track: Track) => {
        setCurrentTrack(track)
        setResolvedUrl(null) // Reset URL to prevent playing previous track
        audioService.pause() // Pause previous track

        // Save to recently played
        addToRecentTracks(track)

        // Resolve URL (Priority: Tidal > YouTube > iTunes)
        const url = await audioService.resolveAndPlay(track)
        setResolvedUrl(url)

        if (url) {
            audioService.play()
        } else {
            // 소스를 찾을 수 없으면 자동으로 다음 곡으로 이동
            console.warn(`[MusicContext] No source for "${track.title}", skipping to next track`)
            const currentQueue = queueRef.current
            const currentIndex = currentQueue.findIndex(t => t.id === track.id)
            if (currentIndex !== -1 && currentIndex < currentQueue.length - 1) {
                setTimeout(() => playTrack(currentQueue[currentIndex + 1]), 800)
            }
        }
    }

    const togglePlay = () => {
        audioService.togglePlay()
    }

    const setQueue = useCallback((tracks: Track[]) => {
        setOriginalQueue(tracks)
        if (isShuffled) {
            setQueueState(shuffleArray(tracks))
        } else {
            setQueueState(tracks)
        }
    }, [isShuffled])

    const playPlaylist = useCallback((tracks: Track[], startIndex = 0) => {
        setOriginalQueue(tracks)

        if (isShuffled) {
            // Shuffle but keep the selected track at the start
            const startTrack = tracks[startIndex]
            const otherTracks = tracks.filter((_, i) => i !== startIndex)
            const shuffledOthers = shuffleArray(otherTracks)
            setQueueState([startTrack, ...shuffledOthers])
            playTrack(startTrack)
        } else {
            setQueueState(tracks)
            if (tracks.length > startIndex) {
                playTrack(tracks[startIndex])
            }
        }
    }, [isShuffled])

    const playNext = useCallback(() => {
        if (!currentTrack || queue.length === 0) return

        const currentIndex = queue.findIndex(t => t.id === currentTrack.id)

        // Repeat one: replay current track
        if (repeatMode === 'one') {
            audioService.seekTo(0)
            audioService.play()
            return
        }

        if (currentIndex !== -1) {
            if (currentIndex < queue.length - 1) {
                // Play next track
                playTrack(queue[currentIndex + 1])
            } else if (repeatMode === 'all') {
                // Loop back to first track
                playTrack(queue[0])
            }
            // If repeat is off and at end, do nothing (stop)
        }
    }, [currentTrack, queue, repeatMode])

    // Handle track ended - auto play next track
    useEffect(() => {
        audioService.onEnded = () => {
            console.log('[MusicContext] Track ended, playing next...')
            playNext()
        }
        return () => {
            audioService.onEnded = null
        }
    }, [playNext])

    const playPrevious = useCallback(() => {
        if (!currentTrack || queue.length === 0) return

        // If more than 3 seconds into song, restart it
        if (audioState.currentTime > 3) {
            audioService.seekTo(0)
            return
        }

        const currentIndex = queue.findIndex(t => t.id === currentTrack.id)
        if (currentIndex > 0) {
            playTrack(queue[currentIndex - 1])
        } else if (repeatMode === 'all') {
            // Loop to last track
            playTrack(queue[queue.length - 1])
        }
    }, [currentTrack, queue, repeatMode, audioState.currentTime])

    const toggleShuffle = useCallback(() => {
        if (isShuffled) {
            // Restore original queue order
            setQueueState(originalQueue)
            setIsShuffled(false)
        } else {
            // Shuffle the queue, keeping current track in its place for continuity
            if (currentTrack) {
                const currentIndex = queue.findIndex(t => t.id === currentTrack.id)
                const beforeCurrent = queue.slice(0, currentIndex)
                const afterCurrent = queue.slice(currentIndex + 1)
                const shuffledAfter = shuffleArray([...beforeCurrent, ...afterCurrent])
                setQueueState([currentTrack, ...shuffledAfter])
            } else {
                setQueueState(shuffleArray(originalQueue))
            }
            setIsShuffled(true)
        }
    }, [isShuffled, originalQueue, currentTrack, queue])

    const toggleRepeat = useCallback(() => {
        // Cycle: off -> all -> one -> off
        setRepeatMode(prev => {
            if (prev === 'off') return 'all'
            if (prev === 'all') return 'one'
            return 'off'
        })
    }, [])

    return (
        <MusicContext.Provider
            value={{
                currentTrack,
                isPlaying: audioState.isPlaying,
                queue,
                originalQueue,
                playTrack,
                togglePlay,
                setQueue,
                playPlaylist,
                playNext,
                playPrevious,
                audioState,
                resolvedUrl,
                // Shuffle & Repeat
                isShuffled,
                repeatMode,
                toggleShuffle,
                toggleRepeat,
                // Recently Played
                recentTracks,
                getRecentTracks,
                clearRecentTracks
            }}
        >
            {children}
        </MusicContext.Provider>
    )
}
