import PlaylistCard from '../../components/music/PlaylistCard'
import TrackListOverlay from '../../components/music/TrackListOverlay'
import { playlistsApi, PlaylistWithTracks, Playlist, Track } from '../../services/api/playlists'
import { favoritesService } from '../../services/api/favorites'
import { post } from '../../services/api/index'
import { ArrowRight, Music, Guitar, Headphones, Zap, Loader2, Info, AlertTriangle, X, LayoutGrid, List, Play, Trash2, Edit3, Heart } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useMusic } from '../../context/MusicContext'

type ViewMode = 'gallery' | 'list'

const MusicLoungeContent = () => {
    const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistWithTracks | null>(null)
    const [playlists, setPlaylists] = useState<Playlist[]>([])
    const [loading, setLoading] = useState(true)
    const [isSyncing, setIsSyncing] = useState(false)
    const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
    const [editForm, setEditForm] = useState({ title: '', description: '' })
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        const saved = localStorage.getItem('pms_view_mode')
        return (saved === 'list' || saved === 'gallery') ? saved : 'gallery'
    })

    // Favorites state
    const [favorites, setFavorites] = useState<Track[]>([])
    const [favoritesLoading, setFavoritesLoading] = useState(true)

    // Music context
    const { playTrack, playPlaylist } = useMusic()

    // 뷰 모드 변경 시 localStorage에 저장
    const handleViewModeChange = (mode: ViewMode) => {
        setViewMode(mode)
        localStorage.setItem('pms_view_mode', mode)
    }

    // Toast helper
    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    // Sync with Tidal if credentials exist
    const syncTidal = useCallback(async () => {
        try {
            const storedTidal = localStorage.getItem('tidal_login_result')
            if (storedTidal) {
                const { response } = JSON.parse(storedTidal)
                if (response && response.access_token) {
                    setIsSyncing(true)
                    // Call sync API (non-blocking for UI, but blocking for data freshness if possible)
                    await post('/auth/sync/tidal', { tidalAuthData: response })
                    console.log('[MusicLounge] Tidal sync completed on mount')
                }
            }
        } catch (error) {
            console.error('[MusicLounge] Auto-sync failed:', error)
        } finally {
            setIsSyncing(false)
        }
    }, [])

    // Fetch playlists from PMS (Personal Music Space)
    const fetchPlaylists = useCallback(async () => {
        try {
            setLoading(true)
            await syncTidal() // Try sync first
            const response = await playlistsApi.getPlaylists('PMS')
            setPlaylists(response.playlists)
        } catch (error) {
            console.error('Failed to fetch playlists:', error)
        } finally {
            setLoading(false)
        }
    }, [syncTidal])

    // Fetch favorites
    const fetchFavorites = useCallback(async () => {
        try {
            setFavoritesLoading(true)
            const tracks = await favoritesService.getFavorites(true)
            setFavorites(tracks)
        } catch (error) {
            console.error('Failed to fetch favorites:', error)
        } finally {
            setFavoritesLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchPlaylists()
        fetchFavorites()
    }, [fetchPlaylists, fetchFavorites])

    const handlePlaylistClick = async (id: number) => {
        try {
            const playlist = await playlistsApi.getById(id) as PlaylistWithTracks
            setSelectedPlaylist(playlist)
        } catch (error) {
            console.error('Failed to fetch playlist', error)
        }
    }

    const handleDeleteClick = (e: React.MouseEvent, playlist: Playlist) => {
        e.stopPropagation()
        setDeleteTarget(playlist)
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            await playlistsApi.delete(deleteTarget.id)
            setPlaylists(prev => prev.filter(p => p.id !== deleteTarget.id))
            showToast(`"${deleteTarget.title}" 플레이리스트가 삭제되었습니다`, 'success')
            setDeleteTarget(null)
        } catch (error) {
            console.error('Failed to delete playlist', error)
            showToast('삭제 중 오류가 발생했습니다', 'error')
        } finally {
            setIsDeleting(false)
        }
    }

    const handleEditClick = (e: React.MouseEvent, playlist: Playlist) => {
        e.stopPropagation()
        setEditingPlaylist(playlist)
        setEditForm({ title: playlist.title, description: playlist.description || '' })
    }

    const handleEditSave = async () => {
        if (!editingPlaylist) return
        try {
            await playlistsApi.updateDetails(editingPlaylist.id, editForm)
            setPlaylists(prev => prev.map(p =>
                p.id === editingPlaylist.id
                    ? { ...p, title: editForm.title, description: editForm.description }
                    : p
            ))
            setEditingPlaylist(null)
        } catch (error) {
            console.error('Failed to update playlist', error)
        }
    }

    // Get icon based on index
    const getIcon = (index: number) => {
        const icons = [
            <Music className="w-12 h-12" />,
            <Guitar className="w-12 h-12" />,
            <Headphones className="w-12 h-12" />,
            <Zap className="w-12 h-12" />
        ]
        return icons[index % icons.length]
    }

    const handleTrackRemove = async (trackId: number) => {
        if (!selectedPlaylist) return
        try {
            await playlistsApi.removeTrack(selectedPlaylist.id, trackId)

            // Update selected playlist state
            const updatedTracks = selectedPlaylist.tracks.filter(t => t.id !== trackId)
            setSelectedPlaylist({ ...selectedPlaylist, tracks: updatedTracks, trackCount: updatedTracks.length })

            // Update main list state
            setPlaylists(prev => prev.map(p =>
                p.id === selectedPlaylist.id
                    ? { ...p, trackCount: updatedTracks.length }
                    : p
            ))
        } catch (error) {
            console.error('Failed to remove track:', error)
        }
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 pb-32">
            {/* Hero Section */}
            <section className="hud-card rounded-xl p-6 mb-8 relative overflow-hidden">
                {/* 배경 장식 */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-hud-accent-success/10 blur-3xl" />
                    <div className="absolute right-16 bottom-0 w-36 h-36 rounded-full bg-hud-accent-primary/10 blur-2xl" />
                    <Headphones className="absolute right-6 top-1/2 -translate-y-1/2 w-28 h-28 text-hud-accent-success/10" strokeWidth={1} />
                </div>
                <div className="relative z-10 flex items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-hud-accent-success/20 text-hud-accent-success text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest">PMS</span>
                            <span className="text-hud-text-muted text-sm">Personal Music Space</span>
                        </div>
                        <h1 className="text-3xl font-bold text-hud-text-primary mb-1">My Lounge</h1>
                        <p className="text-hud-text-secondary text-sm">나만의 음악을 모아두는 공간</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="text-center bg-hud-bg-primary/60 border border-hud-border-secondary rounded-xl px-5 py-3">
                            <div className="text-2xl font-bold text-hud-accent-success">{playlists.length}</div>
                            <div className="text-xs text-hud-text-muted mt-0.5">플레이리스트</div>
                        </div>
                        <div className="text-center bg-hud-bg-primary/60 border border-hud-border-secondary rounded-xl px-5 py-3">
                            <div className="text-2xl font-bold text-hud-accent-danger">{favorites.length}</div>
                            <div className="text-xs text-hud-text-muted mt-0.5">즐겨찾기</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* My Favorites Section */}
            {!favoritesLoading && favorites.length > 0 && (
                <section className="mb-8 hud-card rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-hud-text-primary flex items-baseline gap-2">
                            My Favorites
                            <span className="text-sm font-normal text-hud-text-muted">{favorites.length}곡</span>
                        </h2>
                        <button
                            onClick={() => playPlaylist(favorites)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-hud-accent-danger text-white rounded-full text-sm font-medium hover:bg-hud-accent-danger/90 transition-colors"
                        >
                            <Play className="w-3.5 h-3.5" fill="currentColor" />
                            전체 재생
                        </button>
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
                        {favorites.slice(0, 16).map((track, idx) => (
                            <div
                                key={track.id}
                                onClick={() => playPlaylist(favorites, idx)}
                                className="flex-none w-32 cursor-pointer group"
                            >
                                <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-hud-accent-danger/30 to-pink-500/20 flex items-center justify-center overflow-hidden relative mb-2 shadow-md">
                                    {track.artwork ? (
                                        <img src={track.artwork} alt={track.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <Music className="w-10 h-10 text-hud-accent-danger/60" />
                                    )}
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                                        <Play className="w-8 h-8 text-white drop-shadow-lg" fill="white" />
                                    </div>
                                </div>
                                <div className="text-sm font-medium text-hud-text-primary truncate group-hover:text-hud-accent-danger transition-colors">{track.title}</div>
                                <div className="text-xs text-hud-text-muted truncate mt-0.5">{track.artist}</div>
                            </div>
                        ))}
                        {favorites.length > 16 && (
                            <div
                                onClick={async () => {
                                    const info = await favoritesService.getFavoritesInfo()
                                    if (info.playlist) handlePlaylistClick(info.playlist.id)
                                }}
                                className="flex-none w-32 cursor-pointer group flex flex-col items-center justify-center gap-2"
                            >
                                <div className="w-32 h-32 rounded-xl border-2 border-dashed border-hud-border-secondary flex items-center justify-center group-hover:border-hud-accent-danger transition-colors">
                                    <span className="text-2xl font-bold text-hud-text-muted group-hover:text-hud-accent-danger transition-colors">+{favorites.length - 16}</span>
                                </div>
                                <div className="text-xs text-hud-text-muted">더 보기</div>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* AI 추천 섹션 */}
            <section className="mb-8">
                {/* 헤더: 타이틀 + 뷰 토글 */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-hud-text-primary flex items-center gap-3">
                            My Playlists
                            <span className="bg-gradient-to-r from-hud-accent-secondary to-hud-accent-primary px-3 py-1 rounded-full text-xs font-semibold uppercase text-hud-bg-primary">
                                PMS
                            </span>
                        </h2>
                    </div>

                    {/* View Toggle - 항상 표시 */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-hud-text-muted">보기:</span>
                        <div className="flex items-center gap-1 bg-hud-bg-secondary rounded-lg p-1">
                            <button
                                onClick={() => handleViewModeChange('gallery')}
                                className={`p-2 rounded-md transition-all flex items-center gap-1 ${
                                    viewMode === 'gallery'
                                        ? 'bg-hud-accent-primary text-hud-bg-primary'
                                        : 'text-hud-text-muted hover:text-hud-text-primary hover:bg-hud-bg-hover'
                                }`}
                                title="갤러리 뷰"
                            >
                                <LayoutGrid size={18} />
                                <span className="text-xs hidden sm:inline">갤러리</span>
                            </button>
                            <button
                                onClick={() => handleViewModeChange('list')}
                                className={`p-2 rounded-md transition-all flex items-center gap-1 ${
                                    viewMode === 'list'
                                        ? 'bg-hud-accent-primary text-hud-bg-primary'
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

                {/* 안내 메시지 */}
                <div className="hidden md:flex items-center gap-2 bg-hud-accent-info/10 text-hud-accent-info text-xs px-3 py-1.5 rounded-lg border border-hud-accent-info/20 mb-4">
                    <Info size={14} />
                    <span>PMS에서의 변경(수정/삭제)은 원본 플랫폼(Tidal 등)에 영향을 주지 않습니다.</span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-hud-accent-primary animate-spin" />
                    </div>
                ) : playlists.length > 0 ? (
                    viewMode === 'gallery' ? (
                        /* 갤러리 뷰 */
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {playlists.map((playlist, index) => (
                                <PlaylistCard
                                    key={playlist.id}
                                    title={playlist.title}
                                    trackCount={playlist.trackCount || 0}
                                    confidenceScore={playlist.aiScore ? Math.round(Number(playlist.aiScore)) : undefined}
                                    coverImage={playlist.coverImage}
                                    trackArtworks={playlist.trackArtworks}
                                    icon={getIcon(index)}
                                    onClick={() => handlePlaylistClick(playlist.id)}
                                    onEdit={(e) => handleEditClick(e, playlist)}
                                    onDelete={(e) => handleDeleteClick(e, playlist)}
                                />
                            ))}
                        </div>
                    ) : (
                        /* 목록 뷰 */
                        <div className="hud-card rounded-xl overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-hud-bg-secondary border-b border-hud-border-secondary">
                                    <tr>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-hud-text-muted uppercase tracking-wider w-12">#</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-hud-text-muted uppercase tracking-wider">플레이리스트</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-hud-text-muted uppercase tracking-wider hidden md:table-cell">설명</th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-hud-text-muted uppercase tracking-wider w-24">트랙</th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-hud-text-muted uppercase tracking-wider w-24 hidden sm:table-cell">AI 점수</th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-hud-text-muted uppercase tracking-wider w-32">액션</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-hud-border-secondary">
                                    {playlists.map((playlist, index) => (
                                        <tr 
                                            key={playlist.id}
                                            className="hover:bg-hud-bg-hover transition-colors cursor-pointer group"
                                            onClick={() => handlePlaylistClick(playlist.id)}
                                        >
                                            <td className="py-3 px-4 text-hud-text-muted text-sm">{index + 1}</td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    {playlist.coverImage ? (
                                                        <img 
                                                            src={playlist.coverImage} 
                                                            alt={playlist.title}
                                                            className="w-10 h-10 rounded object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded bg-gradient-to-br from-hud-accent-primary/20 to-hud-accent-secondary/20 flex items-center justify-center">
                                                            {getIcon(index)}
                                                        </div>
                                                    )}
                                                    <span className="text-hud-text-primary font-medium truncate max-w-[200px]">{playlist.title}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-hud-text-muted text-sm truncate max-w-[200px] hidden md:table-cell">
                                                {playlist.description || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-center text-hud-text-secondary text-sm">
                                                {playlist.trackCount || 0}곡
                                            </td>
                                            <td className="py-3 px-4 text-center hidden sm:table-cell">
                                                {playlist.aiScore ? (
                                                    <span className="text-hud-accent-primary font-semibold">{Math.round(Number(playlist.aiScore))}%</span>
                                                ) : (
                                                    <span className="text-hud-text-muted">-</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handlePlaylistClick(playlist.id) }}
                                                        className="p-2 rounded-lg hover:bg-hud-accent-primary/20 text-hud-accent-primary transition-colors"
                                                        title="재생"
                                                    >
                                                        <Play size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleEditClick(e, playlist)}
                                                        className="p-2 rounded-lg hover:bg-hud-accent-info/20 text-hud-accent-info transition-colors"
                                                        title="수정"
                                                    >
                                                        <Edit3 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteClick(e, playlist)}
                                                        className="p-2 rounded-lg hover:bg-red-500/20 text-red-500 transition-colors"
                                                        title="삭제"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    <div className="hud-card rounded-xl p-8 text-center">
                        <Music className="w-16 h-16 text-hud-text-muted mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-hud-text-primary mb-2">플레이리스트가 없습니다</h3>
                        <p className="text-hud-text-secondary mb-4">The Cargo에서 플레이리스트를 가져와 시작하세요</p>
                        <a
                            href="/music/external-space"
                            className="inline-flex items-center gap-2 bg-hud-accent-primary text-hud-bg-primary px-6 py-3 rounded-lg font-semibold hover:bg-hud-accent-primary/90 transition-all"
                        >
                            <ArrowRight className="w-5 h-5" />
                            The Cargo로 이동
                        </a>
                    </div>
                )}
            </section>

            {/* Stats Sidebar */}
            {playlists.length > 0 && (
                <section className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-3 hud-card hud-card-bottom rounded-xl p-6">
                        <h3 className="text-lg font-bold text-hud-text-primary mb-6">Your Stats</h3>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {[
                                { value: playlists.length.toString(), label: 'Total Playlists', color: 'text-hud-accent-primary' },
                                { value: playlists.reduce((sum, p) => sum + (p.trackCount || 0), 0).toString(), label: 'Total Tracks', color: 'text-hud-accent-secondary' },
                                { value: playlists.filter(p => p.status === 'PRP').length.toString(), label: 'Verified', color: 'text-hud-accent-info' },
                                { value: playlists.filter(p => Number(p.aiScore) > 80).length.toString(), label: 'High Score', color: 'text-hud-accent-success' }
                            ].map((stat) => (
                                <div key={stat.label} className="text-center">
                                    <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                                    <div className="text-xs text-hud-text-muted uppercase tracking-wider">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {selectedPlaylist && (
                <TrackListOverlay
                    playlist={selectedPlaylist}
                    onClose={() => setSelectedPlaylist(null)}
                    onRemoveTrack={handleTrackRemove}
                />
            )}
            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-hud-bg-card border border-hud-border-secondary rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95">
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4">
                                <AlertTriangle size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-hud-text-primary mb-2">Delete Playlist?</h3>
                            <p className="text-hud-text-secondary text-sm">
                                <span className="text-hud-accent-primary font-semibold">{deleteTarget.title}</span><br />
                                플레이리스트를 삭제하시겠습니까?
                            </p>
                            <p className="text-hud-text-muted text-xs mt-2 bg-hud-bg-secondary p-2 rounded">
                                * MusicSpace에서만 삭제되며, 원본 플랫폼(Tidal 등)에는 유지됩니다.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2 rounded-lg bg-hud-bg-secondary text-hud-text-secondary hover:bg-hud-bg-hover transition-colors font-medium disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors font-medium shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        삭제 중...
                                    </>
                                ) : (
                                    'Delete'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingPlaylist && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-hud-bg-card border border-hud-border-secondary rounded-xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-hud-text-primary">Edit Playlist</h3>
                            <button onClick={() => setEditingPlaylist(null)} className="text-hud-text-muted hover:text-hud-text-primary">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-medium text-hud-text-secondary uppercase mb-1">Title</label>
                                <input
                                    type="text"
                                    value={editForm.title}
                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                    className="w-full bg-hud-bg-secondary border border-hud-border-secondary rounded-lg px-3 py-2 text-hud-text-primary focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-hud-text-secondary uppercase mb-1">Description</label>
                                <textarea
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    rows={3}
                                    className="w-full bg-hud-bg-secondary border border-hud-border-secondary rounded-lg px-3 py-2 text-hud-text-primary focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary resize-none"
                                />
                            </div>
                            <div className="bg-hud-accent-info/10 border border-hud-accent-info/20 rounded-lg p-3">
                                <p className="text-xs text-hud-accent-info flex items-start gap-2">
                                    <Info size={14} className="mt-0.5 shrink-0" />
                                    이 변경사항은 MusicSpace 내에서만 적용됩니다.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setEditingPlaylist(null)}
                                className="px-4 py-2 rounded-lg bg-hud-bg-secondary text-hud-text-secondary hover:bg-hud-bg-hover transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditSave}
                                disabled={!editForm.title.trim()}
                                className="px-4 py-2 rounded-lg bg-hud-accent-primary text-hud-bg-primary hover:bg-hud-accent-primary/90 transition-colors font-medium shadow-lg shadow-hud-accent-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-4 ${
                    toast.type === 'success' 
                        ? 'bg-green-500 text-white' 
                        : 'bg-red-500 text-white'
                }`}>
                    {toast.message}
                </div>
            )}
        </div>
    )
}

const MusicLounge = () => {
    return (
        <MusicLoungeContent />
    )
}

export default MusicLounge
