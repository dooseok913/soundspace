import { useState, useEffect, useRef } from 'react'
import { Brain, Zap, Music, Play, Pause, RotateCcw, Loader2, Sparkles, Users, Database, ArrowRight, CheckCircle2, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { playlistsApi, Track } from '../../services/api/playlists'
import { itunesService } from '../../services/api/itunes'

interface ModelResult {
    phase: 'idle' | 'running' | 'complete'
    progress: number
    message: string
    recommendations: any[]
    processingTime?: number
}

const MODEL_INFO = {
    M1: {
        name: 'Hybrid Recommender',
        description: 'Audio Feature + Content-Based Filtering',
        icon: Brain,
        color: 'from-cyan-500 to-blue-600',
        bgGlow: 'shadow-cyan-500/50'
    },
    M2: {
        name: 'SVM Classifier', 
        description: 'Support Vector Machine + Text Embedding',
        icon: Zap,
        color: 'from-purple-500 to-pink-600',
        bgGlow: 'shadow-purple-500/50'
    },
    M3: {
        name: 'CatBoost CF',
        description: 'Collaborative Filtering + Gradient Boosting',
        icon: Users,
        color: 'from-orange-500 to-red-600',
        bgGlow: 'shadow-orange-500/50'
    }
}

const AIModelDemo = () => {
    const { user } = useAuth()
    const [userId, setUserId] = useState<number>(user?.id || 1)
    const [selectedModel, setSelectedModel] = useState<'M1' | 'M2' | 'M3'>('M1')
    const [emsTrackLimit, setEmsTrackLimit] = useState(50)
    const [topK, setTopK] = useState(10)
    
    // EMS Tracks
    const [emsTracks, setEmsTracks] = useState<Track[]>([])
    const [emsLoading, setEmsLoading] = useState(false)
    
    // Model Results
    const [modelResult, setModelResult] = useState<ModelResult>({
        phase: 'idle',
        progress: 0,
        message: '',
        recommendations: []
    })

    // Player State
    const [currentTrack, setCurrentTrack] = useState<any>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(0.7)
    const [isMuted, setIsMuted] = useState(false)
    const [isLoadingTrack, setIsLoadingTrack] = useState(false)
    const audioRef = useRef<HTMLAudioElement>(null)

    // Format duration
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    // Player functions
    const playTrack = async (track: any) => {
        setIsLoadingTrack(true)
        try {
            // Search iTunes for preview URL
            const searchQuery = `${track.title} ${track.artist}`
            const results = await itunesService.search(searchQuery)
            
            if (results && results.length > 0 && results[0].previewUrl) {
                setCurrentTrack({
                    ...track,
                    previewUrl: results[0].previewUrl,
                    artwork: results[0].artwork?.replace('100x100', '300x300')
                })
                setIsPlaying(true)
            } else {
                // No preview available
                setCurrentTrack({ ...track, previewUrl: null })
                alert('미리듣기를 사용할 수 없습니다')
            }
        } catch (error) {
            console.error('Failed to load track:', error)
        } finally {
            setIsLoadingTrack(false)
        }
    }

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause()
            } else {
                audioRef.current.play()
            }
            setIsPlaying(!isPlaying)
        }
    }

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime)
            setDuration(audioRef.current.duration || 0)
        }
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(e.target.value)
        if (audioRef.current) {
            audioRef.current.currentTime = time
            setCurrentTime(time)
        }
    }

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const vol = Number(e.target.value)
        setVolume(vol)
        if (audioRef.current) {
            audioRef.current.volume = vol
        }
    }

    const toggleMute = () => {
        if (audioRef.current) {
            audioRef.current.muted = !isMuted
            setIsMuted(!isMuted)
        }
    }

    const playNextTrack = () => {
        if (modelResult.recommendations.length > 0 && currentTrack) {
            const currentIdx = modelResult.recommendations.findIndex(r => r.track_id === currentTrack.track_id)
            const nextIdx = (currentIdx + 1) % modelResult.recommendations.length
            playTrack(modelResult.recommendations[nextIdx])
        }
    }

    const playPrevTrack = () => {
        if (modelResult.recommendations.length > 0 && currentTrack) {
            const currentIdx = modelResult.recommendations.findIndex(r => r.track_id === currentTrack.track_id)
            const prevIdx = currentIdx === 0 ? modelResult.recommendations.length - 1 : currentIdx - 1
            playTrack(modelResult.recommendations[prevIdx])
        }
    }

    // Auto-play when track changes
    useEffect(() => {
        if (currentTrack?.previewUrl && audioRef.current) {
            audioRef.current.src = currentTrack.previewUrl
            audioRef.current.volume = volume
            audioRef.current.play().catch(e => console.log('Autoplay prevented:', e))
        }
    }, [currentTrack?.previewUrl])

    // Load EMS tracks from FastAPI random endpoint
    const loadEmsTracks = async () => {
        setEmsLoading(true)
        try {
            // Use FastAPI random EMS endpoint for better track diversity
            const response = await fetch('/api/m1/random-ems', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userid: userId, limit: emsTrackLimit })
            })
            const data = await response.json()
            
            if (data.tracks && Array.isArray(data.tracks)) {
                const tracks: Track[] = data.tracks.map((t: any) => {
                    let artwork = undefined
                    try {
                        if (t.external_metadata && typeof t.external_metadata === 'string') {
                            const meta = JSON.parse(t.external_metadata)
                            artwork = meta?.artwork
                        } else if (t.external_metadata?.artwork) {
                            artwork = t.external_metadata.artwork
                        }
                    } catch (e) {
                        // Ignore JSON parse errors
                    }
                    return {
                        id: t.track_id,
                        title: t.track_name,
                        artist: t.artists,
                        album: t.album_name || '',
                        duration: t.duration || 0,
                        orderIndex: 0,
                        artwork
                    }
                })
                setEmsTracks(tracks)
            }
        } catch (error) {
            console.error('Failed to load EMS tracks:', error)
            // Fallback to playlist API
            try {
                const response = await playlistsApi.getPlaylists('EMS')
                if (response.playlists && response.playlists.length > 0) {
                    const playlist = await playlistsApi.getById(response.playlists[0].id) as any
                    if (playlist.tracks && Array.isArray(playlist.tracks)) {
                        setEmsTracks(playlist.tracks.slice(0, emsTrackLimit))
                    }
                }
            } catch (e) {
                console.error('Fallback also failed:', e)
            }
        } finally {
            setEmsLoading(false)
        }
    }

    useEffect(() => {
        loadEmsTracks()
    }, [emsTrackLimit, userId])

    // Run recommendation
    const runRecommendation = async () => {
        setModelResult({
            phase: 'running',
            progress: 0,
            message: 'EMS 데이터 로딩 중...',
            recommendations: []
        })

        // Progress animation
        const messages = [
            { progress: 10, message: 'PMS 사용자 프로필 분석 중...' },
            { progress: 25, message: `${selectedModel} 모델 초기화 중...` },
            { progress: 40, message: 'Audio Feature 예측 중...' },
            { progress: 55, message: 'EMS 후보곡 스코어링 중...' },
            { progress: 70, message: '유사도 매트릭스 계산 중...' },
            { progress: 85, message: 'Top-K 추천 생성 중...' },
        ]
        
        let msgIndex = 0
        const progressInterval = setInterval(() => {
            if (msgIndex < messages.length) {
                setModelResult(prev => ({
                    ...prev,
                    progress: messages[msgIndex].progress,
                    message: messages[msgIndex].message
                }))
                msgIndex++
            }
        }, 500)

        const startTime = Date.now()

        try {
            // 화면에 표시된 EMS 트랙 ID 배열을 전달하여 동일한 트랙으로 모델 비교
            const trackIds = emsTracks.map(t => t.id).filter(id => id !== undefined)

            const response = await fetch('/api/recommend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    model: selectedModel,
                    top_k: topK,
                    ems_track_limit: emsTrackLimit,
                    track_ids: trackIds  // 동일한 EMS 트랙으로 비교
                })
            })
            
            clearInterval(progressInterval)
            
            // Check if response is OK
            if (!response.ok) {
                console.error('API Error:', response.status, response.statusText)
                setModelResult({
                    phase: 'idle',
                    progress: 0,
                    message: `API 오류: ${response.status} ${response.statusText}`,
                    recommendations: []
                })
                return
            }
            
            const result = await response.json()
            
            const processingTime = Date.now() - startTime

            if (result.success) {
                setModelResult({
                    phase: 'complete',
                    progress: 100,
                    message: `${result.count}곡 추천 완료!`,
                    recommendations: result.recommendations.map((r: any) => ({
                        track_id: r.track_id,
                        title: r.track_name || r.title,
                        artist: r.artists || r.artist,
                        score: r.final_score || r.recommendation_score || r.probability || 0
                    })),
                    processingTime
                })
            } else {
                setModelResult({
                    phase: 'idle',
                    progress: 0,
                    message: result.error || result.message || '추천 실패',
                    recommendations: []
                })
            }
        } catch (error) {
            clearInterval(progressInterval)
            console.error('Recommendation error:', error)
            setModelResult({
                phase: 'idle',
                progress: 0,
                message: `오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
                recommendations: []
            })
        }
    }

    const reset = () => {
        setModelResult({
            phase: 'idle',
            progress: 0,
            message: '',
            recommendations: []
        })
    }

    const info = MODEL_INFO[selectedModel]
    const Icon = info.icon

    return (
        <div className={`min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white ${currentTrack ? 'pb-28' : ''}`}>
            {/* Header */}
            <div className="bg-black/30 border-b border-gray-800 px-8 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">AI Music Recommendation Demo</h1>
                            <p className="text-sm text-gray-400">3-Model Ensemble System</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">User ID:</span>
                        <input
                            type="number"
                            value={userId}
                            onChange={(e) => setUserId(Number(e.target.value))}
                            className="w-20 px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700"
                        />
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-8 py-8">
                {/* Model Selection */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    {(['M1', 'M2', 'M3'] as const).map((model) => {
                        const m = MODEL_INFO[model]
                        const MIcon = m.icon
                        const isSelected = selectedModel === model
                        
                        return (
                            <button
                                key={model}
                                onClick={() => setSelectedModel(model)}
                                className={`p-4 rounded-xl border-2 transition-all ${
                                    isSelected
                                        ? `border-transparent bg-gradient-to-br ${m.color} shadow-lg ${m.bgGlow}`
                                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <MIcon className="w-8 h-8" />
                                    <div className="text-left">
                                        <div className="font-bold">{model}</div>
                                        <div className="text-sm opacity-80">{m.name}</div>
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-2 gap-8">
                    {/* Left: EMS Tracks */}
                    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Database className="w-5 h-5 text-blue-400" />
                                EMS 후보곡 Pool
                            </h2>
                            <select
                                value={emsTrackLimit}
                                onChange={(e) => setEmsTrackLimit(Number(e.target.value))}
                                className="px-3 py-1.5 bg-gray-700 rounded-lg text-sm"
                            >
                                <option value={30}>30곡</option>
                                <option value={50}>50곡</option>
                                <option value={100}>100곡</option>
                            </select>
                        </div>
                        
                        <div className="h-[500px] overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                            {emsLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                                </div>
                            ) : emsTracks.length > 0 ? (
                                emsTracks.map((track, idx) => (
                                    <div 
                                        key={track.id}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                                    >
                                        <span className="w-6 text-center text-gray-500 text-sm">{idx + 1}</span>
                                        <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center">
                                            <Music className="w-5 h-5 text-gray-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate text-sm">{track.title}</div>
                                            <div className="text-xs text-gray-400 truncate">{track.artist}</div>
                                        </div>
                                        <span className="text-xs text-gray-500">{formatDuration(track.duration || 0)}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                    <Database className="w-12 h-12 mb-2" />
                                    <p>EMS 데이터 없음</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Model & Results */}
                    <div className="space-y-6">
                        {/* Model Card */}
                        <div className={`bg-gradient-to-br ${info.color} rounded-2xl p-6 shadow-lg ${info.bgGlow}`}>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Icon className="w-10 h-10" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">{selectedModel} Model</h2>
                                    <p className="text-white/80">{info.description}</p>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            {modelResult.phase === 'running' && (
                                <div className="mb-4">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span>{modelResult.message}</span>
                                        <span>{modelResult.progress}%</span>
                                    </div>
                                    <div className="h-3 bg-black/30 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-white transition-all duration-300"
                                            style={{ width: `${modelResult.progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Controls */}
                            <div className="flex gap-3">
                                <button
                                    onClick={runRecommendation}
                                    disabled={modelResult.phase === 'running'}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-xl font-bold hover:bg-gray-100 disabled:opacity-50 transition-all"
                                >
                                    {modelResult.phase === 'running' ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> 추천 생성 중...</>
                                    ) : (
                                        <><Play className="w-5 h-5" /> 추천 시작</>
                                    )}
                                </button>
                                <button
                                    onClick={reset}
                                    className="px-4 py-3 bg-white/20 rounded-xl hover:bg-white/30 transition-all"
                                >
                                    <RotateCcw className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Results */}
                        <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-yellow-400" />
                                    추천 결과 (Top {topK})
                                </h2>
                                {modelResult.processingTime && (
                                    <span className="text-sm text-gray-400">
                                        {(modelResult.processingTime / 1000).toFixed(2)}s
                                    </span>
                                )}
                            </div>

                            <div className="h-[320px] overflow-y-auto space-y-2 pr-2">
                                {modelResult.phase === 'complete' && modelResult.recommendations.length > 0 ? (
                                    modelResult.recommendations.slice(0, topK).map((rec, idx) => (
                                        <div 
                                            key={rec.track_id}
                                            onClick={() => playTrack(rec)}
                                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                                                currentTrack?.track_id === rec.track_id 
                                                    ? `bg-gradient-to-r ${info.color} bg-opacity-30` 
                                                    : 'bg-gray-700/50 hover:bg-gray-700'
                                            }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${info.color} flex items-center justify-center font-bold text-sm relative group`}>
                                                <span className="group-hover:hidden">{idx + 1}</span>
                                                <Play className="w-4 h-4 hidden group-hover:block" fill="white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate flex items-center gap-2">
                                                    {rec.title}
                                                    {currentTrack?.track_id === rec.track_id && isPlaying && (
                                                        <span className="flex gap-0.5">
                                                            <span className="w-1 h-3 bg-white rounded-full animate-pulse"></span>
                                                            <span className="w-1 h-4 bg-white rounded-full animate-pulse delay-75"></span>
                                                            <span className="w-1 h-2 bg-white rounded-full animate-pulse delay-150"></span>
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-gray-400 truncate">{rec.artist}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-lg font-bold bg-gradient-to-r ${info.color} bg-clip-text text-transparent`}>
                                                    {(rec.score * 100).toFixed(1)}%
                                                </div>
                                                <div className="text-xs text-gray-500">score</div>
                                            </div>
                                        </div>
                                    ))
                                ) : modelResult.phase === 'running' ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                        <Loader2 className="w-10 h-10 animate-spin mb-3" />
                                        <p>추천 생성 중...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                        <ArrowRight className="w-10 h-10 mb-3" />
                                        <p>추천 시작을 눌러주세요</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Flow Diagram */}
                {modelResult.phase === 'complete' && (
                    <div className="mt-8 bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                        <h3 className="text-lg font-bold mb-4 text-center">Recommendation Pipeline</h3>
                        <div className="flex items-center justify-center gap-4">
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center mb-2">
                                    <Database className="w-8 h-8 text-blue-400" />
                                </div>
                                <span className="text-sm text-gray-400">EMS Pool</span>
                                <span className="text-xs text-gray-500">{emsTracks.length}곡</span>
                            </div>
                            <ArrowRight className="w-6 h-6 text-gray-600" />
                            <div className="flex flex-col items-center">
                                <div className={`w-16 h-16 bg-gradient-to-br ${info.color} rounded-xl flex items-center justify-center mb-2`}>
                                    <Icon className="w-8 h-8" />
                                </div>
                                <span className="text-sm text-gray-400">{selectedModel}</span>
                                <span className="text-xs text-gray-500">{info.name}</span>
                            </div>
                            <ArrowRight className="w-6 h-6 text-gray-600" />
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 bg-yellow-500/20 rounded-xl flex items-center justify-center mb-2">
                                    <Sparkles className="w-8 h-8 text-yellow-400" />
                                </div>
                                <span className="text-sm text-gray-400">GMS 추천</span>
                                <span className="text-xs text-gray-500">{modelResult.recommendations.length}곡</span>
                            </div>
                            <ArrowRight className="w-6 h-6 text-gray-600" />
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 bg-green-500/20 rounded-xl flex items-center justify-center mb-2">
                                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                                </div>
                                <span className="text-sm text-gray-400">사용자 확인</span>
                                <span className="text-xs text-gray-500">PMS 이동</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Hidden Audio Element */}
            <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onEnded={playNextTrack}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
            />

            {/* Bottom Player Bar */}
            {currentTrack && (
                <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-t border-gray-700 px-8 py-4 z-50">
                    <div className="max-w-7xl mx-auto flex items-center gap-6">
                        {/* Track Info */}
                        <div className="flex items-center gap-4 w-64">
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                                {currentTrack.artwork ? (
                                    <img src={currentTrack.artwork} alt={currentTrack.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className={`w-full h-full bg-gradient-to-br ${info.color} flex items-center justify-center`}>
                                        <Music className="w-6 h-6 text-white/70" />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="font-medium truncate text-white">{currentTrack.title}</div>
                                <div className="text-sm text-gray-400 truncate">{currentTrack.artist}</div>
                            </div>
                        </div>

                        {/* Player Controls */}
                        <div className="flex-1 flex flex-col items-center gap-2">
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={playPrevTrack}
                                    className="p-2 text-gray-400 hover:text-white transition-colors"
                                >
                                    <SkipBack className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={togglePlay}
                                    disabled={!currentTrack.previewUrl || isLoadingTrack}
                                    className={`w-12 h-12 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50`}
                                >
                                    {isLoadingTrack ? (
                                        <Loader2 className="w-6 h-6 text-gray-900 animate-spin" />
                                    ) : isPlaying ? (
                                        <Pause className="w-6 h-6 text-gray-900" fill="currentColor" />
                                    ) : (
                                        <Play className="w-6 h-6 text-gray-900 ml-1" fill="currentColor" />
                                    )}
                                </button>
                                <button 
                                    onClick={playNextTrack}
                                    className="p-2 text-gray-400 hover:text-white transition-colors"
                                >
                                    <SkipForward className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full max-w-xl flex items-center gap-3">
                                <span className="text-xs text-gray-400 w-10 text-right">{formatDuration(currentTime)}</span>
                                <input
                                    type="range"
                                    min={0}
                                    max={duration || 30}
                                    value={currentTime}
                                    onChange={handleSeek}
                                    className="flex-1 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                                />
                                <span className="text-xs text-gray-400 w-10">{formatDuration(duration)}</span>
                            </div>
                        </div>

                        {/* Volume Control */}
                        <div className="flex items-center gap-2 w-40">
                            <button onClick={toggleMute} className="p-2 text-gray-400 hover:text-white">
                                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                            </button>
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-24 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AIModelDemo
