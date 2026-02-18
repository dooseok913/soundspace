import { X, Music, Star, ChevronDown, ChevronUp, Check, Trash2, Play, Loader2, RefreshCw, CheckCircle, XCircle, AlertTriangle, Sparkles, ArrowRight, Brain, Cpu, Settings as SettingsIcon } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { playlistsApi, Playlist, PlaylistWithTracks, Track } from '../../services/api/playlists'
import { fastapiService, AIModel } from '../../services/api/fastapi'
import { useAuth } from '../../contexts/AuthContext'
import { useMusic } from '../../context/MusicContext'

interface DeletedTrack {
    trackId: number
    playlistId: number
}

// 모델 아이콘 매핑
const MODEL_ICONS: Record<AIModel, React.ElementType> = {
    'M1': Music,
    'M2': Brain,
    'M3': Cpu
}

const MODEL_NAMES: Record<AIModel, string> = {
    'M1': 'Audio Feature',
    'M2': 'SVM + Embedding',
    'M3': 'CatBoost'
}

const GatewayMusicSpace = () => {
    const { user } = useAuth()
    const { playTrack, playPlaylist } = useMusic()
    
    // State
    const [playlists, setPlaylists] = useState<Playlist[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedPlaylistId, setExpandedPlaylistId] = useState<number | null>(null)
    const [playlistTracks, setPlaylistTracks] = useState<Record<number, Track[]>>({})
    const [deletedTracks, setDeletedTracks] = useState<DeletedTrack[]>([])
    const [processingTracks, setProcessingTracks] = useState<Set<number>>(new Set())
    const [approvingPlaylist, setApprovingPlaylist] = useState<number | null>(null)
    const [selectedModel, setSelectedModel] = useState<AIModel>('M1')
    const [emsTrackLimit, setEmsTrackLimit] = useState<number>(100)
    const [generating, setGenerating] = useState(false)
    const [progress, setProgress] = useState(0)
    const [progressMessage, setProgressMessage] = useState('')
    
    // Toast state
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

    // Show toast helper
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    // Fetch GMS playlists
    const fetchPlaylists = useCallback(async () => {
        try {
            setLoading(true)
            const response = await playlistsApi.getPlaylists('GMS')
            setPlaylists(response.playlists || [])
        } catch (error) {
            console.error('Failed to fetch GMS playlists:', error)
            setPlaylists([])
        } finally {
            setLoading(false)
        }
    }, [])

    // Fetch playlist tracks
    const fetchPlaylistTracks = useCallback(async (playlistId: number) => {
        try {
            const data = await playlistsApi.getById(playlistId)
            const tracks = 'tracks' in data ? (data as PlaylistWithTracks).tracks : []
            setPlaylistTracks(prev => ({ ...prev, [playlistId]: tracks || [] }))
        } catch (error) {
            console.error('Failed to fetch playlist tracks:', error)
            setPlaylistTracks(prev => ({ ...prev, [playlistId]: [] }))
        }
    }, [])

    // Toggle playlist expand
    const handleExpandPlaylist = async (playlistId: number) => {
        if (expandedPlaylistId === playlistId) {
            setExpandedPlaylistId(null)
        } else {
            setExpandedPlaylistId(playlistId)
            if (!playlistTracks[playlistId]) {
                await fetchPlaylistTracks(playlistId)
            }
        }
    }

    // Get score color based on AI score
    const getScoreColor = (score: number): string => {
        if (score >= 85) return 'text-hud-accent-success bg-hud-accent-success/20 border-hud-accent-success/30'
        if (score >= 70) return 'text-hud-accent-warning bg-hud-accent-warning/20 border-hud-accent-warning/30'
        return 'text-hud-text-muted bg-hud-bg-secondary border-hud-border-secondary'
    }

    // Load selected model and EMS track limit on mount
    useEffect(() => {
        setSelectedModel(fastapiService.getSelectedModel())
        setEmsTrackLimit(fastapiService.getEmsTrackLimit())
    }, [])

    // Generate new recommendations using selected model
    const handleGenerateRecommendations = async () => {
        if (!user?.id) {
            showToast('로그인이 필요합니다', 'error')
            return
        }

        setGenerating(true)
        setProgress(0)
        setProgressMessage('AI 모델 초기화 중...')
        showToast('모델 학습중입니다', 'info')

        // Progress animation
        const progressSteps = [
            { progress: 15, message: 'PMS 데이터 로딩 중...' },
            { progress: 30, message: '사용자 프로필 분석 중...' },
            { progress: 50, message: `${selectedModel} 모델 학습 중...` },
            { progress: 70, message: 'EMS 후보곡 탐색 중...' },
            { progress: 85, message: '유사도 계산 중...' },
        ]
        
        let stepIndex = 0
        const progressInterval = setInterval(() => {
            if (stepIndex < progressSteps.length) {
                setProgress(progressSteps[stepIndex].progress)
                setProgressMessage(progressSteps[stepIndex].message)
                stepIndex++
            }
        }, 600)

        try {
            const result = await fastapiService.getRecommendations(user.id, selectedModel, 30, emsTrackLimit)
            
            clearInterval(progressInterval)
            setProgress(100)
            setProgressMessage('완료!')
            
            if (result.success && result.count > 0) {
                showToast(`${selectedModel} 모델로 ${result.count}곡 추천 완료!`, 'success')
                await fetchPlaylists()
            } else {
                showToast(result.message || result.error || '추천 생성 실패', 'info')
            }
        } catch (error) {
            clearInterval(progressInterval)
            console.error('Generate recommendations failed:', error)
            showToast('추천 생성 중 오류 발생', 'error')
        } finally {
            setTimeout(() => {
                setGenerating(false)
                setProgress(0)
                setProgressMessage('')
            }, 1000)
        }
    }

    // Delete track and trigger AI retraining
    const handleDeleteTrack = async (playlistId: number, trackId: number) => {
        if (!user?.id) {
            showToast('로그인이 필요합니다', 'error')
            return
        }

        setProcessingTracks(prev => new Set(prev).add(trackId))

        try {
            // Call FastAPI to delete track and retrain model (using selected model)
            await fastapiService.deleteTrackAndRetrainWithModel(user.id, playlistId, trackId, selectedModel)
            
            // Update local state
            setPlaylistTracks(prev => ({
                ...prev,
                [playlistId]: (prev[playlistId] || []).filter(t => t.id !== trackId)
            }))
            
            // Track deleted tracks for feedback
            setDeletedTracks(prev => [...prev, { trackId, playlistId }])
            
            showToast('트랙이 삭제되었습니다', 'success')
        } catch (error) {
            console.error('Delete and retrain failed:', error)
            
            // Fallback: just delete from playlist API
            try {
                await playlistsApi.removeTrack(playlistId, trackId)
                setPlaylistTracks(prev => ({
                    ...prev,
                    [playlistId]: (prev[playlistId] || []).filter(t => t.id !== trackId)
                }))
                setDeletedTracks(prev => [...prev, { trackId, playlistId }])
                showToast('트랙 삭제됨 (AI 학습 실패)', 'info')
            } catch (err) {
                showToast('트랙 삭제 실패', 'error')
            }
        } finally {
            setProcessingTracks(prev => {
                const next = new Set(prev)
                next.delete(trackId)
                return next
            })
        }
    }

    // Approve playlist and move to PMS
    const handleApprovePlaylist = async (playlistId: number) => {
        if (!user?.id) {
            showToast('로그인이 필요합니다', 'error')
            return
        }

        setApprovingPlaylist(playlistId)

        try {
            // Move playlist to PMS
            await playlistsApi.moveToSpace(playlistId, 'PMS')
            
            // If there were deleted tracks, retrain with all of them
            const playlistDeletedTracks = deletedTracks
                .filter(dt => dt.playlistId === playlistId)
                .map(dt => dt.trackId)
            
            if (playlistDeletedTracks.length > 0) {
                try {
                    await fastapiService.retrainModel(user.id, playlistDeletedTracks)
                } catch (err) {
                    console.error('Batch retrain failed:', err)
                }
            }
            
            // Update local state
            setPlaylists(prev => prev.filter(p => p.id !== playlistId))
            setDeletedTracks(prev => prev.filter(dt => dt.playlistId !== playlistId))
            
            showToast('플레이리스트가 PMS로 이동되었습니다!', 'success')
        } catch (error) {
            console.error('Approve playlist failed:', error)
            showToast('플레이리스트 승인 실패', 'error')
        } finally {
            setApprovingPlaylist(null)
        }
    }

    // Reject entire playlist
    const handleRejectPlaylist = async (playlistId: number) => {
        if (!user?.id) {
            showToast('로그인이 필요합니다', 'error')
            return
        }

        try {
            // Get all track IDs from the playlist
            const tracks = playlistTracks[playlistId] || []
            const trackIds = tracks.map(t => t.id)
            
            // Delete the playlist
            await playlistsApi.delete(playlistId)
            
            // Retrain with all tracks as negative feedback
            if (trackIds.length > 0) {
                try {
                    await fastapiService.retrainModel(user.id, trackIds)
                } catch (err) {
                    console.error('Retrain after reject failed:', err)
                }
            }
            
            // Update local state
            setPlaylists(prev => prev.filter(p => p.id !== playlistId))
            
            showToast('플레이리스트가 거절되고 AI가 학습했습니다', 'success')
        } catch (error) {
            console.error('Reject playlist failed:', error)
            showToast('플레이리스트 거절 실패', 'error')
        }
    }

    // Play track
    const handlePlayTrack = (track: Track) => {
        playTrack(track)
    }

    // Play all tracks in playlist
    const handlePlayAll = (playlistId: number) => {
        const tracks = playlistTracks[playlistId] || []
        if (tracks.length > 0) {
            playPlaylist(tracks, 0)
        }
    }

    // Format duration
    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    useEffect(() => {
        fetchPlaylists()
    }, [fetchPlaylists])

    return (
        <div className="p-4 md:p-6 pb-32">
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
                    toast.type === 'success' 
                        ? 'bg-hud-accent-success/20 border border-hud-accent-success/30 text-hud-accent-success'
                        : toast.type === 'error'
                        ? 'bg-hud-accent-danger/20 border border-hud-accent-danger/30 text-hud-accent-danger'
                        : 'bg-hud-accent-info/20 border border-hud-accent-info/30 text-hud-accent-info'
                }`}>
                    {toast.type === 'success' && <CheckCircle className="w-4 h-4" />}
                    {toast.type === 'error' && <XCircle className="w-4 h-4" />}
                    {toast.type === 'info' && <AlertTriangle className="w-4 h-4" />}
                    {toast.message}
                </div>
            )}

            {/* Hero Section */}
            <section className="hud-card hud-card-bottom rounded-xl p-8 mb-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-hud-accent-warning/10 to-transparent"></div>
                <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-hud-accent-warning mb-3 flex items-center gap-3">
                                <Sparkles className="w-8 h-8" />
                                The Lab (GMS)
                            </h1>
                            <p className="text-lg text-hud-text-secondary">
                                AI가 추천한 플레이리스트입니다. 마음에 드는 곡을 승인하고, 싫은 곡은 삭제하세요.
                            </p>
                        </div>
                        
                        {/* Current Model Badge */}
                        <div className="flex flex-col items-end gap-2">
                            <Link
                                to="/music/settings"
                                className="flex items-center gap-2 px-4 py-2 bg-hud-bg-secondary/80 hover:bg-hud-bg-hover rounded-lg transition-colors"
                            >
                                {(() => {
                                    const ModelIcon = MODEL_ICONS[selectedModel]
                                    return <ModelIcon className="w-5 h-5 text-hud-accent-primary" />
                                })()}
                                <span className="font-medium text-hud-text-primary">{selectedModel}</span>
                                <span className="text-sm text-hud-text-muted">{MODEL_NAMES[selectedModel]}</span>
                                <SettingsIcon className="w-4 h-4 text-hud-text-muted" />
                            </Link>
                            
                            <button
                                onClick={handleGenerateRecommendations}
                                disabled={generating || !user?.id}
                                className="flex items-center gap-2 px-4 py-2 bg-hud-accent-warning text-hud-bg-primary rounded-lg font-medium hover:bg-hud-accent-warning/90 transition-colors disabled:opacity-50"
                            >
                                {generating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-4 h-4" />
                                )}
                                새 추천 생성
                            </button>
                        </div>
                    </div>
                    
                    {/* Progress Bar */}
                    {generating && (
                        <div className="mb-4 p-4 bg-hud-bg-secondary/80 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-hud-accent-warning">{progressMessage}</span>
                                <span className="text-sm text-hud-text-muted">{progress}%</span>
                            </div>
                            <div className="h-3 bg-hud-bg-primary rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-hud-accent-warning to-hud-accent-primary transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}
                    
                    <div className="flex flex-wrap gap-3 text-sm">
                        <div className="bg-hud-bg-secondary/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
                            <Check className="w-4 h-4 text-hud-accent-success" />
                            <span>승인하면 PMS로 이동</span>
                        </div>
                        <div className="bg-hud-bg-secondary/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
                            <Trash2 className="w-4 h-4 text-hud-accent-danger" />
                            <span>삭제하면 AI가 학습</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Loading State */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-10 h-10 text-hud-accent-warning animate-spin mb-4" />
                    <p className="text-hud-text-secondary">추천 플레이리스트를 불러오는 중...</p>
                </div>
            ) : playlists.length === 0 ? (
                /* Empty State */
                <div className="hud-card rounded-xl p-12 text-center">
                    <div className="w-20 h-20 bg-hud-bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                        <Music className="w-10 h-10 text-hud-text-muted" />
                    </div>
                    <h3 className="text-2xl font-bold text-hud-text-primary mb-3">
                        추천 대기 중인 플레이리스트가 없습니다
                    </h3>
                    <p className="text-hud-text-secondary mb-6">
                        External Space에서 플레이리스트를 가져오고 AI 분석을 실행하세요
                    </p>
                    <a
                        href="/music/external-space"
                        className="inline-flex items-center gap-2 bg-hud-accent-warning text-hud-bg-primary px-6 py-3 rounded-lg font-semibold hover:bg-hud-accent-warning/90 transition-all"
                    >
                        <ArrowRight className="w-5 h-5" />
                        External Space로 이동
                    </a>
                </div>
            ) : (
                /* Playlists List */
                <div className="space-y-4">
                    {playlists.map((playlist) => (
                        <div key={playlist.id} className="hud-card rounded-xl overflow-hidden">
                            {/* Playlist Header */}
                            <div
                                className="p-4 cursor-pointer hover:bg-hud-bg-hover transition-colors"
                                onClick={() => handleExpandPlaylist(playlist.id)}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Expand Icon */}
                                    <div className="text-hud-text-muted">
                                        {expandedPlaylistId === playlist.id ? (
                                            <ChevronUp className="w-5 h-5" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5" />
                                        )}
                                    </div>
                                    
                                    {/* Playlist Cover */}
                                    {playlist.coverImage ? (
                                        <img 
                                            src={playlist.coverImage} 
                                            alt={playlist.title}
                                            className="w-12 h-12 rounded-lg object-cover"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-hud-bg-secondary flex items-center justify-center">
                                            <Music className="w-6 h-6 text-hud-text-muted" />
                                        </div>
                                    )}
                                    
                                    {/* Playlist Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-hud-text-primary truncate">
                                            {playlist.title}
                                        </h3>
                                        <p className="text-sm text-hud-text-muted">
                                            {playlist.trackCount || 0} tracks
                                        </p>
                                    </div>
                                    
                                    {/* AI Score */}
                                    {Number(playlist.aiScore) > 0 && (
                                        <div className={`px-3 py-1.5 rounded-full text-sm font-semibold border flex items-center gap-1.5 ${getScoreColor(Number(playlist.aiScore))}`}>
                                            <Star className="w-4 h-4" fill="currentColor" />
                                            {Math.round(Number(playlist.aiScore))}%
                                        </div>
                                    )}
                                    
                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => handleApprovePlaylist(playlist.id)}
                                            disabled={approvingPlaylist === playlist.id}
                                            className="px-4 py-2 bg-hud-accent-success/20 hover:bg-hud-accent-success/30 text-hud-accent-success rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                                        >
                                            {approvingPlaylist === playlist.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Check className="w-4 h-4" />
                                            )}
                                            승인
                                        </button>
                                        <button
                                            onClick={() => handleRejectPlaylist(playlist.id)}
                                            className="px-4 py-2 bg-hud-accent-danger/20 hover:bg-hud-accent-danger/30 text-hud-accent-danger rounded-lg font-medium flex items-center gap-2 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                            거절
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Expanded Track List */}
                            {expandedPlaylistId === playlist.id && (
                                <div className="border-t border-hud-border-secondary">
                                    {/* Track List Header */}
                                    <div className="px-4 py-3 bg-hud-bg-secondary/50 flex items-center justify-between">
                                        <div className="flex items-center gap-4 text-xs text-hud-text-muted uppercase tracking-wider">
                                            <span className="w-8">#</span>
                                            <span className="flex-1">트랙</span>
                                            <span className="w-32 hidden md:block">아티스트</span>
                                            <span className="w-24 hidden md:block">앨범</span>
                                            <span className="w-16 text-right">시간</span>
                                            <span className="w-24 text-center">작업</span>
                                        </div>
                                        <button
                                            onClick={() => handlePlayAll(playlist.id)}
                                            className="px-3 py-1.5 bg-hud-accent-primary/20 hover:bg-hud-accent-primary/30 text-hud-accent-primary rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                                        >
                                            <Play className="w-4 h-4" fill="currentColor" />
                                            전체 재생
                                        </button>
                                    </div>
                                    
                                    {/* Track List */}
                                    <div className="divide-y divide-hud-border-secondary/30">
                                        {(playlistTracks[playlist.id] || []).map((track, idx) => (
                                            <div 
                                                key={track.id} 
                                                className="px-4 py-3 hover:bg-hud-bg-hover/50 transition-colors group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    {/* Track Number / Play Button */}
                                                    <div className="w-8 text-center">
                                                        <span className="text-hud-text-muted group-hover:hidden">
                                                            {idx + 1}
                                                        </span>
                                                        <button 
                                                            onClick={() => handlePlayTrack(track)}
                                                            className="hidden group-hover:block text-hud-accent-primary"
                                                        >
                                                            <Play className="w-4 h-4" fill="currentColor" />
                                                        </button>
                                                    </div>
                                                    
                                                    {/* Track Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-hud-text-primary truncate">
                                                            {track.title}
                                                        </p>
                                                        <p className="text-sm text-hud-text-muted truncate md:hidden">
                                                            {track.artist}
                                                        </p>
                                                    </div>
                                                    
                                                    {/* Artist */}
                                                    <div className="w-32 hidden md:block">
                                                        <p className="text-sm text-hud-text-secondary truncate">
                                                            {track.artist}
                                                        </p>
                                                    </div>
                                                    
                                                    {/* Album */}
                                                    <div className="w-24 hidden md:block">
                                                        <p className="text-sm text-hud-text-muted truncate">
                                                            {track.album}
                                                        </p>
                                                    </div>
                                                    
                                                    {/* Duration */}
                                                    <div className="w-16 text-right text-sm text-hud-text-muted">
                                                        {formatDuration(track.duration || 0)}
                                                    </div>
                                                    
                                                    {/* Actions */}
                                                    <div className="w-24 flex justify-center gap-2">
                                                        <button
                                                            onClick={() => handleDeleteTrack(playlist.id, track.id)}
                                                            disabled={processingTracks.has(track.id)}
                                                            className="p-2 bg-hud-accent-danger/20 hover:bg-hud-accent-danger/30 text-hud-accent-danger rounded-lg transition-colors disabled:opacity-50"
                                                            title="삭제 (AI 학습)"
                                                        >
                                                            {processingTracks.has(track.id) ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        
                                        {/* Empty tracks state */}
                                        {(playlistTracks[playlist.id] || []).length === 0 && (
                                            <div className="px-4 py-8 text-center text-hud-text-muted">
                                                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                                트랙을 불러오는 중...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Stats Section */}
            {playlists.length > 0 && (
                <section className="mt-8">
                    <div className="hud-card rounded-xl p-6">
                        <h3 className="text-lg font-bold text-hud-text-primary mb-4">Lab Stats</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="text-center">
                                <div className="text-3xl font-bold text-hud-accent-warning">
                                    {playlists.length}
                                </div>
                                <div className="text-xs text-hud-text-muted uppercase tracking-wider">
                                    대기 중
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-hud-accent-primary">
                                    {playlists.reduce((sum, p) => sum + (p.trackCount || 0), 0)}
                                </div>
                                <div className="text-xs text-hud-text-muted uppercase tracking-wider">
                                    총 트랙
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-hud-accent-danger">
                                    {deletedTracks.length}
                                </div>
                                <div className="text-xs text-hud-text-muted uppercase tracking-wider">
                                    삭제됨
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-hud-accent-success">
                                    {playlists.filter(p => Number(p.aiScore) >= 80).length}
                                </div>
                                <div className="text-xs text-hud-text-muted uppercase tracking-wider">
                                    고점수
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}
        </div>
    )
}

export default GatewayMusicSpace
