import { useState } from 'react'
import { Clock, Play, Trash2, Music, LayoutGrid, List, CheckCircle, XCircle } from 'lucide-react'
import { useMusic } from '../../context/MusicContext'
import { useTheme } from '../../contexts/ThemeContext'
import FavoriteButton from '../../components/music/FavoriteButton'

type ViewMode = 'grid' | 'list'

const RecentlyPlayed = () => {
    const { recentTracks, clearRecentTracks, playPlaylist } = useMusic()
    const { theme } = useTheme()

    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        const saved = localStorage.getItem('recent_view_mode')
        return (saved === 'list' || saved === 'grid') ? saved : 'list'
    })

    // ... (keep existing state)

    // Theme-specific styles
    const getHeroStyles = () => {
        switch (theme) {
            case 'jazz':
                return {
                    bgGradient: 'from-[#2C1F16] via-[#3C2A1E] to-[#1A0B05]',
                    accentGradient: 'from-[#D4AF37]/20 via-[#B8860B]/10 to-[#8B4513]/20',
                    orbColor: 'bg-[#D4AF37]/10',
                    iconBg: 'bg-gradient-to-br from-[#D4AF37] via-[#C5A028] to-[#8B4513]',
                    iconShadow: 'shadow-[#D4AF37]/25',
                    textColor: 'text-[#D4AF37]',
                    subTextColor: 'text-[#D4AF37]/80',
                    buttonBg: 'bg-[#D4AF37] text-[#1A0B05]',
                    buttonHover: 'hover:shadow-[#D4AF37]/20',
                    borderGlow: 'from-transparent via-[#D4AF37]/40 to-transparent'
                }
            case 'soul':
                return {
                    bgGradient: 'from-[#1E293B] via-[#334155] to-[#0F172A]',
                    accentGradient: 'from-[#93C5FD]/20 via-[#60A5FA]/10 to-[#3B82F6]/20',
                    orbColor: 'bg-[#93C5FD]/10',
                    iconBg: 'bg-gradient-to-br from-[#93C5FD] via-[#60A5FA] to-[#2563EB]',
                    iconShadow: 'shadow-[#93C5FD]/25',
                    textColor: 'text-[#93C5FD]',
                    subTextColor: 'text-[#93C5FD]/80',
                    buttonBg: 'bg-[#93C5FD] text-[#0F172A]',
                    buttonHover: 'hover:shadow-[#93C5FD]/20',
                    borderGlow: 'from-transparent via-[#93C5FD]/40 to-transparent'
                }
            default: // Default (Cyan/Blue)
                return {
                    bgGradient: 'from-[#0a1a1e] via-[#102133] to-[#0a0f1a]',
                    accentGradient: 'from-cyan-500/15 via-blue-500/10 to-indigo-600/15',
                    orbColor: 'bg-cyan-500/10',
                    iconBg: 'bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600',
                    iconShadow: 'shadow-cyan-500/25',
                    textColor: 'text-cyan-400',
                    subTextColor: 'text-cyan-400/80',
                    buttonBg: 'bg-white text-[#0a1a1e]',
                    buttonHover: 'hover:shadow-cyan-500/20',
                    borderGlow: 'from-transparent via-cyan-500/40 to-transparent'
                }
        }
    }

    const hero = getHeroStyles()

    // Toast state
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    const tracks = recentTracks.map(entry => entry.track)

    const handleViewModeChange = (mode: ViewMode) => {
        setViewMode(mode)
        localStorage.setItem('recent_view_mode', mode)
    }

    const handlePlayAll = () => {
        if (tracks.length === 0) return
        playPlaylist(tracks)
    }

    const handlePlayTrack = (index: number) => {
        playPlaylist(tracks, index)
    }

    const handleClearAll = () => {
        clearRecentTracks()
        showToast('재생 기록이 모두 삭제되었습니다')
    }

    const formatPlayedAt = (isoString: string) => {
        const date = new Date(isoString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMin = Math.floor(diffMs / 60000)
        const diffHour = Math.floor(diffMs / 3600000)
        const diffDay = Math.floor(diffMs / 86400000)

        if (diffMin < 1) return '방금 전'
        if (diffMin < 60) return `${diffMin}분 전`
        if (diffHour < 24) return `${diffHour}시간 전`
        if (diffDay < 7) return `${diffDay}일 전`
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    }

    return (
        <div className="p-4 md:p-6 pb-32">
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${toast.type === 'success'
                    ? 'bg-hud-accent-success/20 border border-hud-accent-success/30 text-hud-accent-success'
                    : 'bg-hud-accent-danger/20 border border-hud-accent-danger/30 text-hud-accent-danger'
                    }`}>
                    {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {toast.message}
                </div>
            )}

            {/* Hero Section */}
            <section className="rounded-xl mb-8 relative overflow-hidden min-h-[200px]">
                {/* Multi-layer gradient background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${hero.bgGradient}`} />
                <div className={`absolute inset-0 bg-gradient-to-r ${hero.accentGradient}`} />

                {/* Decorative orbs */}
                <div className={`absolute -top-20 -right-20 w-64 h-64 ${hero.orbColor} rounded-full blur-3xl`} />
                <div className={`absolute -bottom-16 -left-16 w-48 h-48 ${hero.orbColor} rounded-full blur-3xl`} />

                {/* Grid pattern overlay */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

                {/* Content */}
                <div className="relative z-10 p-8 md:p-10">
                    <div className="flex items-center gap-6 md:gap-8">
                        {/* Clock icon with glow */}
                        <div className="relative shrink-0">
                            <div className={`absolute inset-0 ${hero.iconBg} rounded-2xl blur-xl scale-110 opacity-30`} />
                            <div className={`relative w-24 h-24 md:w-28 md:h-28 ${hero.iconBg} rounded-2xl flex items-center justify-center shadow-2xl ${hero.iconShadow}`}>
                                <Clock className="w-12 h-12 md:w-14 md:h-14 text-white drop-shadow-lg" />
                            </div>
                        </div>

                        {/* Title & info */}
                        <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${hero.subTextColor} mb-2`}>History</p>
                            <h1 className={`text-3xl md:text-5xl font-extrabold ${theme === 'jazz' ? 'text-[#D4AF37] font-serif' : 'text-white'} mb-3 tracking-tight`}>
                                Recently Played
                            </h1>
                            <p className={`text-base ${theme === 'jazz' ? 'text-[#D4AF37]/60' : 'text-white/50'}`}>
                                <span className={`${theme === 'jazz' ? 'text-[#D4AF37]' : 'text-white/80'} font-medium`}>{tracks.length}</span> recently played
                            </p>
                        </div>

                        {/* Play button */}
                        {tracks.length > 0 && (
                            <button
                                onClick={handlePlayAll}
                                className={`group flex items-center gap-3 px-7 py-3.5 ${hero.buttonBg} rounded-full font-bold hover:scale-105 hover:shadow-xl ${hero.buttonHover} transition-all duration-200 shrink-0`}
                            >
                                <Play className="w-5 h-5" fill="currentColor" />
                                <span className="hidden sm:inline">Play All</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Bottom border glow */}
                <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r ${hero.borderGlow}`} />
            </section>

            {/* Section Header + View Toggle + Clear */}
            <section className="mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <h2 className={`text-2xl font-bold ${theme === 'jazz' ? 'text-[#D4AF37]' : theme === 'soul' ? 'text-[#93C5FD]' : 'text-hud-text-primary'} flex items-center gap-3`}>
                            Play History
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${theme === 'jazz' ? 'bg-[#D4AF37] text-[#1A0B05]' :
                                theme === 'soul' ? 'bg-[#93C5FD] text-[#0F172A]' :
                                    'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                                }`}>
                                Local
                            </span>
                        </h2>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Clear All */}
                        {tracks.length > 0 && (
                            <button
                                onClick={handleClearAll}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs text-hud-text-muted hover:text-hud-accent-danger hover:bg-hud-accent-danger/10 rounded-lg transition-all"
                            >
                                <Trash2 size={14} />
                                <span>전체 삭제</span>
                            </button>
                        )}

                        {/* View Toggle */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-hud-text-muted">보기:</span>
                            <div className="flex items-center gap-1 bg-hud-bg-secondary rounded-lg p-1">
                                <button
                                    onClick={() => handleViewModeChange('grid')}
                                    className={`p-2 rounded-md transition-all flex items-center gap-1 ${viewMode === 'grid'
                                        ? theme === 'jazz' ? 'bg-[#D4AF37] text-[#1A0B05]' : theme === 'soul' ? 'bg-[#93C5FD] text-[#0F172A]' : 'bg-cyan-500 text-white'
                                        : 'text-hud-text-muted hover:text-hud-text-primary hover:bg-hud-bg-hover'
                                        }`}
                                    title="그리드 뷰"
                                >
                                    <LayoutGrid size={18} />
                                    <span className="text-xs hidden sm:inline">그리드</span>
                                </button>
                                <button
                                    onClick={() => handleViewModeChange('list')}
                                    className={`p-2 rounded-md transition-all flex items-center gap-1 ${viewMode === 'list'
                                        ? theme === 'jazz' ? 'bg-[#D4AF37] text-[#1A0B05]' : theme === 'soul' ? 'bg-[#93C5FD] text-[#0F172A]' : 'bg-cyan-500 text-white'
                                        : 'text-hud-text-muted hover:text-hud-text-primary hover:bg-hud-bg-hover'
                                        }`}
                                    title="목록 뷰"
                                >
                                    <List size={18} />
                                    <span className="text-xs hidden sm:inline">목록</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                {tracks.length === 0 ? (
                    <div className="hud-card rounded-xl p-12 text-center">
                        <div className="w-20 h-20 bg-hud-bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                            <Clock className="w-10 h-10 text-hud-text-muted" />
                        </div>
                        <h3 className="text-2xl font-bold text-hud-text-primary mb-3">재생 기록이 없어요</h3>
                        <p className="text-hud-text-secondary mb-6">음악을 재생하면 여기에 기록이 남아요</p>
                        <a
                            href="/music/lounge"
                            className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${theme === 'jazz' ? 'bg-[#D4AF37] text-[#1A0B05] hover:bg-[#B8860B]' :
                                theme === 'soul' ? 'bg-[#93C5FD] text-[#0F172A] hover:bg-[#60A5FA]' :
                                    'bg-cyan-500 text-white hover:bg-cyan-500/90'
                                }`}
                        >
                            <Music className="w-5 h-5" />
                            Music Lounge로 이동
                        </a>
                    </div>
                ) : viewMode === 'grid' ? (
                    /* Grid View */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {recentTracks.map((entry, idx) => (
                            <div
                                key={`${entry.track.title}-${entry.track.artist}-${idx}`}
                                onClick={() => handlePlayTrack(idx)}
                                className={`hud-card rounded-xl overflow-hidden cursor-pointer group transition-all ${theme === 'jazz' ? 'hover:border-[#D4AF37]/30' : theme === 'soul' ? 'hover:border-[#93C5FD]/30' : 'hover:border-cyan-500/30'
                                    }`}
                            >
                                {/* Artwork */}
                                <div className={`aspect-square flex items-center justify-center overflow-hidden relative ${theme === 'jazz' ? 'bg-gradient-to-br from-[#D4AF37]/20 to-[#8B4513]/20' :
                                    theme === 'soul' ? 'bg-gradient-to-br from-[#93C5FD]/20 to-[#3B82F6]/20' :
                                        'bg-gradient-to-br from-cyan-500/20 to-blue-500/20'
                                    }`}>
                                    {entry.track.artwork ? (
                                        <img src={entry.track.artwork} alt={entry.track.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <Music className={`w-16 h-16 ${theme === 'jazz' ? 'text-[#D4AF37]/50' : theme === 'soul' ? 'text-[#93C5FD]/50' : 'text-cyan-500/50'}`} />
                                    )}
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Play className="w-12 h-12 text-white" fill="white" />
                                    </div>
                                    {/* Favorite Button */}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all">
                                        <FavoriteButton
                                            track={{ title: entry.track.title, artist: entry.track.artist }}
                                            size="sm"
                                        />
                                    </div>
                                </div>
                                {/* Info */}
                                <div className="p-3">
                                    <div className="font-medium text-hud-text-primary truncate text-sm group-hover:text-cyan-400 transition-colors">
                                        {entry.track.title}
                                    </div>
                                    <div className="text-xs text-hud-text-muted truncate mt-1">{entry.track.artist}</div>
                                    <div className="text-[10px] text-hud-text-muted/60 mt-1">{formatPlayedAt(entry.playedAt)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* List View */
                    <div className="hud-card rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-hud-bg-secondary border-b border-hud-border-secondary">
                                <tr>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-hud-text-muted uppercase tracking-wider w-12">#</th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-hud-text-muted uppercase tracking-wider">제목</th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-hud-text-muted uppercase tracking-wider hidden md:table-cell">아티스트</th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-hud-text-muted uppercase tracking-wider hidden lg:table-cell">앨범</th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-hud-text-muted uppercase tracking-wider w-20">시간</th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-hud-text-muted uppercase tracking-wider w-24 hidden sm:table-cell">재생 시각</th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-hud-text-muted uppercase tracking-wider w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-hud-border-secondary">
                                {recentTracks.map((entry, index) => (
                                    <tr
                                        key={`${entry.track.title}-${entry.track.artist}-${index}`}
                                        className="hover:bg-hud-bg-hover transition-colors cursor-pointer group"
                                        onClick={() => handlePlayTrack(index)}
                                    >
                                        <td className="py-3 px-4">
                                            <span className="text-hud-text-muted group-hover:hidden">{index + 1}</span>
                                            <Play className={`w-4 h-4 hidden group-hover:block ${theme === 'jazz' ? 'text-[#D4AF37]' : theme === 'soul' ? 'text-[#93C5FD]' : 'text-cyan-400'}`} fill="currentColor" />
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-hud-bg-secondary">
                                                    {entry.track.artwork ? (
                                                        <img src={entry.track.artwork} alt={entry.track.title} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Music className="w-4 h-4 text-hud-text-muted" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`font-medium text-hud-text-primary truncate transition-colors ${theme === 'jazz' ? 'group-hover:text-[#D4AF37]' : theme === 'soul' ? 'group-hover:text-[#93C5FD]' : 'group-hover:text-cyan-400'
                                                        }`}>
                                                        {entry.track.title}
                                                    </p>
                                                    <p className="text-xs text-hud-text-muted truncate md:hidden">{entry.track.artist}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-hud-text-secondary hidden md:table-cell">{entry.track.artist}</td>
                                        <td className="py-3 px-4 text-hud-text-muted text-sm hidden lg:table-cell truncate max-w-[200px]">
                                            {entry.track.album || '-'}
                                        </td>
                                        <td className="py-3 px-4 text-center text-hud-text-muted text-sm">
                                            {entry.track.duration ? `${Math.floor(entry.track.duration / 60)}:${String(entry.track.duration % 60).padStart(2, '0')}` : '--:--'}
                                        </td>
                                        <td className="py-3 px-4 text-center text-hud-text-muted text-xs hidden sm:table-cell">
                                            {formatPlayedAt(entry.playedAt)}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <FavoriteButton
                                                track={{ title: entry.track.title, artist: entry.track.artist }}
                                                size="sm"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Stats Section */}
            {tracks.length > 0 && (
                <section className="hud-card hud-card-bottom rounded-xl p-6">
                    <h3 className="text-lg font-bold text-hud-text-primary mb-6">Play History Stats</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="text-center">
                            <div className={`text-3xl font-bold ${theme === 'jazz' ? 'text-[#D4AF37]' : theme === 'soul' ? 'text-[#93C5FD]' : 'text-cyan-400'}`}>{tracks.length}</div>
                            <div className="text-xs text-hud-text-muted uppercase tracking-wider">Total Played</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-hud-accent-primary">
                                {new Set(tracks.map(t => t.artist)).size}
                            </div>
                            <div className="text-xs text-hud-text-muted uppercase tracking-wider">Artists</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-hud-accent-secondary">
                                {new Set(tracks.filter(t => t.album).map(t => t.album)).size}
                            </div>
                            <div className="text-xs text-hud-text-muted uppercase tracking-wider">Albums</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-hud-accent-info">
                                {tracks.reduce((sum, t) => sum + (t.duration || 0), 0) > 0
                                    ? `${Math.floor(tracks.reduce((sum, t) => sum + (t.duration || 0), 0) / 60)}m`
                                    : '-'
                                }
                            </div>
                            <div className="text-xs text-hud-text-muted uppercase tracking-wider">Total Time</div>
                        </div>
                    </div>
                </section>
            )}
        </div>
    )
}

export default RecentlyPlayed
