import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Sparkles } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useMusic } from '../../../context/MusicContext'
import { kukaApi, KukaTrackInfo, KukaModel } from '../../../services/api/kukaApi'
import LLMSearchForm from './LLMSearchForm'
import LLMRecommendList from './LLMRecommendList'
import LLMMiniPlayer from './LLMMiniPlayer'

interface LLMModalProps {
    isOpen: boolean
    onClose: () => void
}

const LLMModal = ({ isOpen, onClose }: LLMModalProps) => {
    const { theme } = useTheme()
    const { playTrack, setQueue, currentTrack, isPlaying, togglePlay, audioState, playNext, playPrevious } = useMusic()

    // Search state
    const [loading, setLoading] = useState(false)
    const [recommendations, setRecommendations] = useState<KukaTrackInfo[]>([])
    const [explanation, setExplanation] = useState<string | undefined>()
    const [error, setError] = useState<string | null>(null)
    const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number | undefined>()

    // Drag state
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const dragStartPos = useRef({ x: 0, y: 0 })
    const modalRef = useRef<HTMLDivElement>(null)

    // Track current playing index based on currentTrack
    useEffect(() => {
        if (currentTrack && recommendations.length > 0) {
            const index = recommendations.findIndex(
                r => r.track_name === currentTrack.title && r.artists === currentTrack.artist
            )
            if (index !== -1) {
                setCurrentPlayingIndex(index)
            }
        }
    }, [currentTrack, recommendations])

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setPosition({ x: 0, y: 0 })
        }
    }, [isOpen])

    // Drag handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsDragging(true)
        dragStartPos.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        }
    }, [position])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return

        const newX = e.clientX - dragStartPos.current.x
        const newY = e.clientY - dragStartPos.current.y

        const modalWidth = modalRef.current?.offsetWidth || 400
        const modalHeight = modalRef.current?.offsetHeight || 600
        const maxX = (window.innerWidth - modalWidth) / 2
        const maxY = (window.innerHeight - modalHeight) / 2

        const clampedX = Math.max(-maxX, Math.min(newX, maxX))
        const clampedY = Math.max(-maxY, Math.min(newY, maxY))

        setPosition({ x: clampedX, y: clampedY })
    }, [isDragging])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0]
        setIsDragging(true)
        dragStartPos.current = {
            x: touch.clientX - position.x,
            y: touch.clientY - position.y
        }
    }, [position])

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!isDragging) return
        const touch = e.touches[0]

        const newX = touch.clientX - dragStartPos.current.x
        const newY = touch.clientY - dragStartPos.current.y

        const modalWidth = modalRef.current?.offsetWidth || 400
        const modalHeight = modalRef.current?.offsetHeight || 600
        const maxX = (window.innerWidth - modalWidth) / 2
        const maxY = (window.innerHeight - modalHeight) / 2

        const clampedX = Math.max(-maxX, Math.min(newX, maxX))
        const clampedY = Math.max(-maxY, Math.min(newY, maxY))

        setPosition({ x: clampedX, y: clampedY })
    }, [isDragging])

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false)
    }, [])

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
            window.addEventListener('touchmove', handleTouchMove)
            window.addEventListener('touchend', handleTouchEnd)
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
            window.removeEventListener('touchmove', handleTouchMove)
            window.removeEventListener('touchend', handleTouchEnd)
        }
    }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd])

    // Search handler
    const handleSearch = async (params: {
        artist?: string
        song?: string
        k: number
        model: KukaModel
        explain: boolean
    }) => {
        setLoading(true)
        setError(null)
        setRecommendations([])
        setExplanation(undefined)
        setCurrentPlayingIndex(undefined)

        try {
            const response = await kukaApi.recommend(params)
            setRecommendations(response.recommendations)
            setExplanation(response.explanation)
        } catch (err) {
            console.error('Kuka API error:', err)
            setError(err instanceof Error ? err.message : '추천을 가져오는데 실패했습니다')
        } finally {
            setLoading(false)
        }
    }

    // Play track using MusicContext (Tidal/Smart Match)
    const handlePlayTrack = (kukaTrack: KukaTrackInfo, index: number) => {
        // Convert Kuka track to Track format
        const track = {
            id: 0,
            title: kukaTrack.track_name,
            artist: kukaTrack.artists,
            album: '',
            duration: 0,
            artwork: '',
            orderIndex: index
        }

        // Set queue with all recommendations
        const trackList = recommendations.map((r, i) => ({
            id: 0,
            title: r.track_name,
            artist: r.artists,
            album: '',
            duration: 0,
            artwork: '',
            orderIndex: i
        }))

        setQueue(trackList)
        playTrack(track)
        setCurrentPlayingIndex(index)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            {/* Backdrop */}
            <div
                className="absolute inset-0"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                ref={modalRef}
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
                className={`
                    relative w-full max-w-lg h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden
                    animate-scale-up border-2
                    ${isDragging ? 'cursor-grabbing' : ''}
                    ${theme === 'jazz'
                        ? 'bg-hud-bg-primary/95 border-hud-accent-primary/50 shadow-hud-accent-primary/20'
                        : theme === 'soul'
                            ? 'bg-[#1E293B]/95 border-[#93C5FD]/40 shadow-[#93C5FD]/20'
                            : 'bg-hud-bg-card border-hud-accent-primary/30 shadow-hud-accent-primary/20'
                    }
                `}
            >
                {/* Gradient Border Effect */}
                <div className={`absolute inset-0 rounded-2xl pointer-events-none
                    ${theme === 'jazz'
                        ? 'bg-gradient-to-br from-hud-accent-primary/10 via-transparent to-hud-accent-secondary/10'
                        : theme === 'soul'
                            ? 'bg-gradient-to-br from-[#9D4EDD]/10 via-transparent to-[#4361EE]/10'
                            : 'bg-gradient-to-br from-hud-accent-primary/10 via-transparent to-hud-accent-info/10'
                    }`}
                />

                {/* Header (Draggable) - Compact */}
                <div
                    className={`relative px-4 pt-2 pb-2 shrink-0 z-10
                        ${theme === 'jazz' || theme === 'soul'
                            ? 'border-b border-hud-accent-primary/20'
                            : 'bg-gradient-to-b from-hud-accent-primary/5 to-transparent border-b border-hud-border-secondary'
                        }`}
                >
                    {/* Drag Handle */}
                    <div
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                        className="flex justify-center mb-2 cursor-grab active:cursor-grabbing"
                    >
                        <div className={`w-10 h-1 rounded-full transition-colors
                            ${theme === 'jazz'
                                ? 'bg-hud-accent-primary/40 hover:bg-hud-accent-primary/70'
                                : 'bg-hud-text-muted/30 hover:bg-hud-accent-primary/50'
                            }`}
                        />
                    </div>

                    {/* Title - Compact */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center
                                ${theme === 'jazz'
                                    ? 'bg-hud-accent-primary/20'
                                    : theme === 'soul'
                                        ? 'bg-[#93C5FD]/20'
                                        : 'bg-gradient-to-br from-hud-accent-primary/20 to-hud-accent-info/20'
                                }`}
                            >
                                <Sparkles className={`w-3.5 h-3.5 ${theme === 'soul' ? 'text-[#93C5FD]' : 'text-hud-accent-primary'}`} />
                            </div>
                            <div>
                                <h2 className={`text-base font-bold leading-tight
                                    ${theme === 'jazz'
                                        ? 'text-hud-accent-primary font-serif'
                                        : theme === 'soul'
                                            ? 'text-[#A5F3FC]'
                                            : 'text-hud-text-primary'
                                    }`}
                                >
                                    Kuka House
                                </h2>
                                <p className="text-[10px] text-hud-text-muted">L1 Kuka Engine</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className={`p-1.5 rounded-lg transition-all
                                ${theme === 'jazz' || theme === 'soul'
                                    ? 'text-hud-accent-primary hover:bg-hud-accent-primary/10'
                                    : 'text-hud-text-muted hover:text-hud-text-primary hover:bg-hud-bg-secondary'
                                }`}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Search Form */}
                <LLMSearchForm onSearch={handleSearch} loading={loading} />

                {/* Results */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {error ? (
                        <div className="flex flex-col items-center justify-center h-full p-4">
                            <p className="text-red-400 text-center">{error}</p>
                        </div>
                    ) : (
                        <LLMRecommendList
                            recommendations={recommendations}
                            explanation={explanation}
                            onPlayTrack={handlePlayTrack}
                            currentPlayingIndex={currentPlayingIndex}
                        />
                    )}
                </div>

                {/* Mini Player - Using MusicContext */}
                <LLMMiniPlayer
                    currentTrack={currentTrack ? {
                        title: currentTrack.title,
                        artist: currentTrack.artist,
                        artwork: currentTrack.artwork || '',
                        previewUrl: ''
                    } : null}
                    isPlaying={isPlaying}
                    audioState={audioState}
                    onTogglePlay={togglePlay}
                    onPrevious={playPrevious}
                    onNext={playNext}
                />
            </div>
        </div>
    )
}

export default LLMModal
