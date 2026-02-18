import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Loader2, Music2, Clock, Calendar, Hash, GripHorizontal, Play, Heart, Share2, MoreHorizontal, ShoppingCart } from 'lucide-react'
import { playlistsApi, PlaylistWithTracks, Track } from '../../services/api/playlists'
import { useMusic } from '../../context/MusicContext'
import FavoriteButton from './FavoriteButton'
import { useTheme } from '../../contexts/ThemeContext'

interface PlaylistDetailModalProps {
    isOpen: boolean
    onClose: () => void
    playlistId: number | null
    onAddToCart?: (track: Track) => void
    cartTrackIds?: Set<number>
}

const PlaylistDetailModal = ({ isOpen, onClose, playlistId, onAddToCart, cartTrackIds }: PlaylistDetailModalProps) => {
    const [playlist, setPlaylist] = useState<PlaylistWithTracks | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [imageError, setImageError] = useState(false)
    const { playPlaylist, playTrack, setQueue } = useMusic()
    const { theme } = useTheme()

    // Drag state
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const dragStartPos = useRef({ x: 0, y: 0 })
    const modalRef = useRef<HTMLDivElement>(null)

    // Reset position when modal opens
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
        setPosition({ x: newX, y: newY })
    }, [isDragging])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    // Add/remove global event listeners for drag
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging, handleMouseMove, handleMouseUp])

    useEffect(() => {
        if (isOpen && playlistId) {
            fetchDetails(playlistId)
            setImageError(false)
        } else {
            setPlaylist(null)
            setLoading(true)
            setImageError(false)
        }
    }, [isOpen, playlistId])

    const fetchDetails = async (id: number) => {
        try {
            setLoading(true)
            setError(null)
            // Fix: Cast response to unknown then to PlaylistWithTracks because getById might return just Playlist in types
            const data = await playlistsApi.getById(id) as unknown as PlaylistWithTracks
            setPlaylist(data)
        } catch (err) {
            console.error('Failed to load playlist details:', err)
            setError('플레이리스트 정보를 불러오는데 실패했습니다.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    // Format duration helper
    const formatDuration = (seconds: number) => {
        const min = Math.floor(seconds / 60)
        const sec = seconds % 60
        return `${min}:${sec.toString().padStart(2, '0')}`
    }

    // Fix image URL (handle Apple Music placeholder URLs and Tidal double slash issue)
    const fixImageUrl = (url?: string, size: number = 300): string | undefined => {
        if (!url) return undefined

        let fixed = url
            .replace('{w}', String(size))
            .replace('{h}', String(size))

        // Fix Tidal double slash issue FIRST (e.g., /images//images/ -> /images/)
        fixed = fixed.replace(/\/images\/\/images\//g, '/images/')
        // Fix any remaining double slashes (except after protocol)
        fixed = fixed.replace(/([^:])\/\/+/g, '$1/')

        // Proxy external Tidal/Spotify images through backend to avoid CORS
        if (fixed.startsWith('https://resources.tidal.com/') ||
            fixed.startsWith('https://i.scdn.co/') ||
            fixed.includes('mzstatic.com')) {
            return `/api/playlists/proxy-image?url=${encodeURIComponent(fixed)}`
        }

        return fixed
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div
                ref={modalRef}
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
                className={`
                    border-2 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl relative overflow-hidden animate-scale-up ${isDragging ? 'cursor-grabbing' : ''}
                    ${theme === 'jazz' || theme === 'soul'
                        ? 'bg-hud-bg-primary/95 border-hud-accent-primary/50 shadow-hud-accent-primary/20 backdrop-blur-xl'
                        : 'bg-hud-bg-card border-hud-accent-primary/30 shadow-hud-accent-primary/20'
                    }
                `}
            >
                {/* Gradient Border Effect */}
                <div className={`absolute inset-0 rounded-2xl pointer-events-none ${theme === 'jazz'
                    ? 'bg-gradient-to-r from-hud-accent-primary/10 via-transparent to-hud-accent-secondary/10'
                    : theme === 'soul'
                        ? 'bg-gradient-to-r from-[#9D4EDD]/20 via-transparent to-[#4361EE]/20'
                        : 'bg-gradient-to-r from-hud-accent-primary/20 via-transparent to-hud-accent-info/20'
                    }`}></div>

                {/* Header (draggable) */}
                <div
                    className={`relative px-5 pt-5 pb-6 shrink-0 z-10 overflow-hidden ${theme === 'jazz' || theme === 'soul'
                        ? 'border-b border-hud-accent-primary/20'
                        : 'bg-gradient-to-b from-hud-accent-primary/10 to-hud-bg-card border-b border-hud-border-secondary'
                        }`}
                >
                    {/* Theme Background for Header */}
                    {(theme === 'jazz' || theme === 'soul') && playlist?.coverImage && !imageError && (
                        <>
                            <div className="absolute inset-0 bg-hud-bg-primary/80 z-0"></div>
                            <img
                                src={fixImageUrl(playlist.coverImage)}
                                className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-40 z-[-1]"
                                alt=""
                            />
                        </>
                    )}

                    {/* Drag Handle */}
                    <div
                        onMouseDown={handleMouseDown}
                        className="flex justify-center mb-4 cursor-grab active:cursor-grabbing relative z-10"
                    >
                        <div className={`w-12 h-1.5 rounded-full transition-colors ${theme === 'jazz' ? 'bg-hud-accent-primary/40 hover:bg-hud-accent-primary/70' : 'bg-hud-text-muted/30 hover:bg-hud-accent-primary/50'
                            }`} />
                    </div>

                    {loading ? (
                        <div className="h-16 animate-pulse bg-hud-bg-secondary w-full rounded-lg relative z-10"></div>
                    ) : playlist ? (
                        <div className="flex items-center gap-5 relative z-10">
                            {/* Album Cover */}
                            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden shadow-2xl shrink-0 relative group ${theme === 'jazz' ? 'border-2 border-hud-accent-primary/30 ring-4 ring-black/20' : 'border border-hud-accent-primary/20'
                                }`}>
                                {fixImageUrl(playlist.coverImage) && !imageError ? (
                                    <img
                                        src={fixImageUrl(playlist.coverImage)}
                                        alt={playlist.title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        onError={() => setImageError(true)}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-hud-accent-primary/20 to-hud-accent-info/20">
                                        <Music2 className="w-10 h-10 text-hud-accent-primary/50" />
                                    </div>
                                )}
                            </div>

                            {/* Title + Stats */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded shadow-sm ${theme === 'jazz'
                                        ? 'bg-hud-accent-primary text-hud-bg-primary'
                                        : theme === 'soul'
                                            ? 'bg-[#93C5FD] text-slate-900 shadow-[0_0_10px_rgba(147,197,253,0.5)]'
                                            : 'text-hud-accent-primary bg-hud-accent-primary/10'
                                        }`}>
                                        Playlist
                                    </span>
                                    <span className={`text-xs ${theme === 'jazz' || theme === 'soul' ? 'text-hud-accent-secondary' : 'text-hud-text-muted'}`}>
                                        {playlist.tracks?.length || 0} tracks
                                    </span>
                                </div>
                                <h2 className={`text-2xl sm:text-3xl font-bold truncate mb-1 ${theme === 'jazz'
                                    ? 'text-hud-accent-primary drop-shadow-md font-serif tracking-wide'
                                    : theme === 'soul'
                                        ? 'text-[#A5F3FC] drop-shadow-[0_0_5px_rgba(165,243,252,0.5)] tracking-tight'
                                        : 'text-hud-text-primary'
                                    }`}>
                                    {playlist.title}
                                </h2>
                                <p className={`text-sm line-clamp-1 ${theme === 'jazz' ? 'text-hud-text-primary/80' : theme === 'soul' ? 'text-[#CBD5E1]' : 'text-hud-text-secondary'}`}>
                                    Created in {theme === 'jazz' ? 'the Jazz Lounge' : theme === 'soul' ? 'Cloud 9' : 'Music Space'}
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3 shrink-0">
                                <button
                                    onClick={() => playlist?.tracks && playPlaylist(playlist.tracks)}
                                    className={`flex items-center gap-2 px-6 py-2.5 font-bold rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg ${theme === 'jazz'
                                        ? 'bg-hud-accent-primary text-hud-bg-primary shadow-hud-accent-primary/30 hover:bg-hud-accent-primary/90'
                                        : theme === 'soul'
                                            ? 'bg-[#93C5FD] text-slate-900 shadow-[0_0_15px_rgba(147,197,253,0.4)] hover:bg-[#60A5FA]'
                                            : 'bg-hud-accent-primary text-black shadow-hud-accent-primary/50'
                                        }`}
                                >
                                    <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                                    Play All
                                </button>
                                <button
                                    onClick={onClose}
                                    className={`p-2.5 rounded-full transition-all ${theme === 'jazz' || theme === 'soul'
                                        ? 'text-hud-accent-primary hover:bg-hud-accent-primary/10 border border-hud-accent-primary/20'
                                        : 'text-hud-text-muted hover:text-hud-text-primary hover:bg-hud-bg-secondary'
                                        }`}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div></div>
                    )}
                </div>

                {/* Content - Track List */}
                <div className={`flex-1 overflow-y-auto p-0 custom-scrollbar ${theme === 'jazz' || theme === 'soul' ? 'bg-transparent' : 'bg-hud-bg-card'}`}>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-hud-text-muted">
                            <Loader2 className="w-12 h-12 animate-spin text-hud-accent-primary" />
                            <p className="text-lg">Loading tracks...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-red-400">
                            <p className="font-bold text-lg">{error}</p>
                            <button
                                onClick={() => playlistId && fetchDetails(playlistId)}
                                className="px-6 py-3 bg-hud-accent-primary text-black font-bold rounded-full hover:scale-105 transition-all"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead className={`sticky top-0 z-10 backdrop-blur-md ${theme === 'jazz'
                                ? 'bg-hud-bg-primary/60 border-b border-hud-accent-primary/20'
                                : theme === 'soul'
                                    ? 'bg-[#1E293B]/60 border-b border-[#93C5FD]/20'
                                    : 'bg-hud-bg-secondary/80 border-b border-hud-border-secondary'
                                }`}>
                                <tr>
                                    <th className={`px-4 py-3 w-12 text-center text-xs font-black uppercase tracking-wider ${theme === 'jazz' || theme === 'soul' ? 'text-hud-accent-secondary' : 'text-hud-text-muted'}`}>#</th>
                                    <th className={`px-4 py-3 text-xs font-black uppercase tracking-wider w-[35%] ${theme === 'jazz' || theme === 'soul' ? 'text-hud-accent-secondary' : 'text-hud-text-muted'}`}>Title</th>
                                    <th className={`px-4 py-3 text-xs font-black uppercase tracking-wider w-[25%] hidden md:table-cell ${theme === 'jazz' || theme === 'soul' ? 'text-hud-accent-secondary' : 'text-hud-text-muted'}`}>Artist</th>
                                    <th className={`px-4 py-3 text-xs font-black uppercase tracking-wider w-[20%] hidden lg:table-cell ${theme === 'jazz' || theme === 'soul' ? 'text-hud-accent-secondary' : 'text-hud-text-muted'}`}>Album</th>
                                    <th className={`px-4 py-3 w-24 text-right text-xs font-black uppercase tracking-wider ${theme === 'jazz' || theme === 'soul' ? 'text-hud-accent-secondary' : 'text-hud-text-muted'}`}>
                                        <Clock className="w-3.5 h-3.5 ml-auto" />
                                    </th>
                                    {onAddToCart && (
                                        <th className={`px-4 py-3 w-12 text-center text-xs font-black uppercase tracking-wider ${theme === 'jazz' || theme === 'soul' ? 'text-hud-accent-secondary' : 'text-hud-text-muted'}`}>
                                            <ShoppingCart className="w-3.5 h-3.5 mx-auto" />
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {playlist?.tracks && playlist.tracks.length > 0 ? (
                                    playlist.tracks.map((track, index) => (
                                        <tr
                                            key={track.id}
                                            onClick={() => {
                                                if (playlist.tracks) {
                                                    setQueue(playlist.tracks)
                                                    playTrack(track)
                                                }
                                            }}
                                            className={`
                                                group transition-all duration-200 cursor-pointer border-b
                                                ${theme === 'jazz'
                                                    ? 'border-hud-accent-primary/5 hover:bg-hud-accent-primary/10 hover:border-hud-accent-primary/20'
                                                    : theme === 'soul'
                                                        ? 'border-[#93C5FD]/5 hover:bg-[#93C5FD]/10 hover:border-[#93C5FD]/20 hover:shadow-[0_0_10px_rgba(147,197,253,0.1)]'
                                                        : 'border-hud-border-secondary hover:bg-hud-bg-hover'
                                                }
                                            `}
                                        >
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center">
                                                    <span className={`text-xs group-hover:hidden font-mono ${theme === 'jazz' ? 'text-hud-accent-primary/60' : 'text-hud-text-muted'}`}>
                                                        {index + 1}
                                                    </span>
                                                    <Play className="w-3.5 h-3.5 text-hud-accent-primary hidden group-hover:block" fill="currentColor" />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 overflow-hidden">
                                                <div className={`text-sm font-medium transition-colors truncate ${theme === 'jazz'
                                                    ? 'text-hud-text-primary group-hover:text-hud-accent-primary font-serif tracking-wide'
                                                    : 'text-hud-text-primary group-hover:text-hud-accent-primary'
                                                    }`}>{track.title}</div>
                                                <div className={`text-xs md:hidden ${theme === 'jazz' ? 'text-hud-text-muted' : 'text-hud-text-secondary'}`}>{track.artist}</div>
                                            </td>
                                            <td className={`px-4 py-3 text-sm hidden md:table-cell transition-colors overflow-hidden truncate ${theme === 'jazz' ? 'text-hud-text-primary/70 group-hover:text-hud-text-primary' : 'text-hud-text-secondary group-hover:text-hud-text-primary'
                                                }`}>
                                                {track.artist}
                                            </td>
                                            <td className={`px-4 py-3 text-xs hidden lg:table-cell truncate max-w-[200px] ${theme === 'jazz' ? 'text-hud-text-muted/80' : 'text-hud-text-muted'
                                                }`}>
                                                {track.album}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <FavoriteButton
                                                            track={{ title: track.title, artist: track.artist, album: track.album, duration: track.duration, artwork: track.artwork }}
                                                            size="sm"
                                                        />
                                                    </div>
                                                    <span className={`text-xs font-mono ${theme === 'jazz' ? 'text-hud-accent-secondary' : 'text-hud-text-muted'}`}>
                                                        {formatDuration(track.duration)}
                                                    </span>
                                                </div>
                                            </td>
                                            {onAddToCart && (
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onAddToCart(track)
                                                        }}
                                                        className={`p-1.5 rounded-full transition-all hover:scale-110 ${cartTrackIds?.has(track.id)
                                                            ? 'bg-hud-accent-warning/30 text-hud-accent-warning'
                                                            : theme === 'jazz'
                                                                ? 'bg-hud-accent-primary/10 hover:bg-hud-accent-warning/20 text-hud-accent-primary hover:text-hud-accent-warning'
                                                                : 'bg-hud-bg-secondary hover:bg-hud-accent-warning/20 text-hud-text-muted hover:text-hud-accent-warning'
                                                            }`}
                                                        title={cartTrackIds?.has(track.id) ? "장바구니에 담김" : "장바구니에 담기"}
                                                    >
                                                        <ShoppingCart className="w-3.5 h-3.5" fill={cartTrackIds?.has(track.id) ? "currentColor" : "none"} />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={onAddToCart ? 6 : 5} className="p-16 text-center">
                                            <Music2 className="w-16 h-16 text-hud-text-muted/30 mx-auto mb-4" />
                                            <p className="text-hud-text-muted text-lg">No tracks found in this playlist.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}

export default PlaylistDetailModal
