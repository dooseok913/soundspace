import { useState, useEffect } from 'react'
import { Search, Sparkles, Send, Loader2, Music, Play } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { post } from '../../services/api'
import { useMusic } from '../../context/MusicContext'
import type { Track as PmsTrack } from '../../services/api/playlists'
import FavoriteButton from '../../components/music/FavoriteButton'

interface Track {
    track_id: string
    artist: string
    title: string
    genre: string
    tags: string
    similarity_score: number
    explanation?: string
    audio_features?: {
        energy: number
        valence: number
        acousticness?: number
    }
}

interface SearchResponse {
    success: boolean
    tracks: Track[]
    analyzed_query?: string
    detected_emotion?: string
    collection_size?: number
    has_more?: boolean
    page?: number
    max_page?: number
    error?: string
}

const CACHE_KEY = 'deep_dive_cache'

const DeepDive = () => {
    const [query, setQuery] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}').query || '' } catch { return '' }
    })
    const [isLoading, setIsLoading] = useState(false)
    const [results, setResults] = useState<Track[]>(() => {
        try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}').results || [] } catch { return [] }
    })
    const [analyzedInfo, setAnalyzedInfo] = useState<{ query: string; emotion: string } | null>(() => {
        try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}').analyzedInfo || null } catch { return null }
    })
    const [searchError, setSearchError] = useState<string | null>(null)
    const [placeholderIndex, setPlaceholderIndex] = useState(0)
    const { playPlaylist } = useMusic()

    const toPmsTrack = (track: Track, index: number): PmsTrack => ({
        id: index,
        title: track.title,
        artist: track.artist,
        album: track.genre,
        duration: 0,
        orderIndex: index,
        sourceId: track.track_id,
        sourceType: 'deep-dive',
    } as PmsTrack)

    const placeholders = [
        "비오는 날 카페에서 들을 잔잔한 재즈...",
        "새벽 감성에 어울리는 어쿠스틱...",
        "집중할 때 듣는 Lo-Fi...",
        "추운 아침 이불 속에서 듣는 음악...",
    ]

    useEffect(() => {
        const interval = setInterval(() => {
            setPlaceholderIndex((prev) => (prev + 1) % placeholders.length)
        }, 3000)
        return () => clearInterval(interval)
    }, [])

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!query.trim()) return

        setIsLoading(true)
        setSearchError(null)
        setResults([])
        setAnalyzedInfo(null)

        try {
            const response = await post<SearchResponse>('/llm/search', {
                query,
                page: 1,
                include_explanation: true,
            })

            if (response.success) {
                const info = response.analyzed_query
                    ? { query: response.analyzed_query, emotion: response.detected_emotion || '' }
                    : null
                setResults(response.tracks)
                setAnalyzedInfo(info)
                // 페이지 이동 후 복원을 위해 sessionStorage에 캐시
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                    query,
                    results: response.tracks,
                    analyzedInfo: info,
                }))
            } else {
                setSearchError(response.error || '검색에 실패했습니다.')
            }
        } catch {
            setSearchError('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.')
        } finally {
            setIsLoading(false)
        }
    }

    const getTagList = (tags: string) =>
        tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 4)

    // Gemini fallback: tags + audio features 기반 로컬 설명 생성
    const buildLocalExplanation = (track: Track): string => {
        const tags = getTagList(track.tags)
        const energy = track.audio_features?.energy ?? 0.5
        const valence = track.audio_features?.valence ?? 0.5
        const mood = energy < 0.3 ? '잔잔하고 차분한' : energy < 0.6 ? '부드러운' : '신나고 활기찬'
        const feeling = valence < 0.3 ? '감성적인' : valence < 0.6 ? '중립적인' : '밝고 긍정적인'
        const mainTags = tags.slice(0, 2).join(', ')
        const score = Math.round(track.similarity_score * 100)
        return `${mood} ${feeling} 분위기의 ${mainTags} 트랙 — 검색어와 ${score}% 매칭`
    }

    // Gemini 설명이 모두 동일(quota 초과 fallback)이면 로컬 설명으로 교체
    const getExplanation = (track: Track): string => {
        const apiExplanation = track.explanation
        if (!apiExplanation) return buildLocalExplanation(track)
        // generic fallback 패턴 감지: 모든 트랙이 동일한 텍스트
        const first = results[0]?.explanation
        const allSame = results.length > 1 && results.every(t => t.explanation === first)
        return allSame ? buildLocalExplanation(track) : apiExplanation
    }

    const getAcousticnessColor = (v: number) => {
        if (v > 0.7) return 'bg-emerald-500'
        if (v > 0.4) return 'bg-blue-500'
        return 'bg-orange-500'
    }

    return (
        <div className="px-6 py-10 max-w-4xl mx-auto min-h-screen">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-10"
            >
                <div className="flex items-center gap-3 mb-2">
                    <Sparkles className="w-6 h-6 text-hud-accent-purple" />
                    <h1 className="text-3xl font-bold text-hud-text-primary tracking-tight">Deep Dive</h1>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-hud-accent-purple/20 border border-hud-accent-purple/30 text-hud-accent-purple">
                        L2
                    </span>
                </div>
                <p className="text-sm text-hud-text-muted pl-9">
                    상황과 감정을 자유롭게 입력하세요 — AI가 81,765곡 중 가장 어울리는 음악을 찾아드립니다
                </p>
            </motion.div>

            {/* Search */}
            <div className="mb-8">
                <form onSubmit={handleSearch} className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-hud-accent-purple/30 to-blue-600/20 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    <div className="relative flex items-center bg-hud-bg-secondary border border-hud-border-secondary rounded-xl overflow-hidden transition-colors group-hover:border-hud-accent-purple/40">
                        <Search className="w-5 h-5 text-hud-text-muted ml-4 shrink-0" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={placeholders[placeholderIndex]}
                            className="flex-1 bg-transparent text-base text-hud-text-primary placeholder:text-hud-text-muted/40 focus:outline-none px-4 py-4"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !query.trim()}
                            className="flex items-center gap-2 bg-hud-accent-purple hover:bg-hud-accent-purple/80 disabled:bg-hud-accent-purple/30 text-white px-5 py-4 text-sm font-medium transition-colors disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            <span className="hidden sm:inline">검색</span>
                        </button>
                    </div>
                </form>

                {/* Analyzed info */}
                <AnimatePresence>
                    {analyzedInfo && !isLoading && (
                        <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mt-3 flex flex-wrap gap-2"
                        >
                            {analyzedInfo.query && (
                                <span className="px-3 py-1 rounded-full text-xs bg-hud-bg-tertiary border border-hud-border-secondary text-hud-text-muted">
                                    번역됨 <span className="text-hud-accent-info font-medium">{analyzedInfo.query}</span>
                                </span>
                            )}
                            {analyzedInfo.emotion && (
                                <span className="px-3 py-1 rounded-full text-xs bg-hud-bg-tertiary border border-hud-border-secondary text-hud-text-muted">
                                    감정 <span className="text-hud-accent-purple font-medium">{analyzedInfo.emotion}</span>
                                </span>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Error */}
            {searchError && (
                <div className="mb-6 px-4 py-3 rounded-lg bg-hud-accent-danger/10 border border-hud-accent-danger/20 text-sm text-hud-accent-danger">
                    {searchError}
                </div>
            )}

            {/* Results */}
            <AnimatePresence mode="popLayout">
                {results.length > 0 && (
                    <motion.div
                        key="results"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-2"
                    >
                        {/* Play All header */}
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-hud-text-muted">{results.length}곡</span>
                            <button
                                onClick={() => playPlaylist(results.map(toPmsTrack))}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-hud-accent-purple hover:bg-hud-accent-purple/80 text-white text-sm font-medium transition-colors"
                            >
                                <Play className="w-3.5 h-3.5" fill="currentColor" />
                                전체 재생
                            </button>
                        </div>

                        {results.map((track, index) => {
                            const energy = track.audio_features?.energy ?? 0
                            const valence = track.audio_features?.valence ?? 0
                            const acousticness = track.audio_features?.acousticness ?? 0
                            const tags = getTagList(track.tags)
                            const explanation = getExplanation(track)

                            return (
                                <motion.div
                                    key={track.track_id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0, transition: { delay: index * 0.07 } }}
                                    className="group flex items-start gap-4 px-5 py-4 rounded-xl bg-hud-bg-card/40 hover:bg-hud-bg-card border border-transparent hover:border-hud-border-secondary transition-all cursor-pointer"
                                    onClick={() => playPlaylist(results.map(toPmsTrack), index)}
                                >
                                    {/* Index */}
                                    <div className="w-6 shrink-0 text-center mt-0.5">
                                        <span className="text-xs font-mono text-hud-text-muted/40 group-hover:text-hud-text-muted transition-colors">
                                            {String(index + 1).padStart(2, '0')}
                                        </span>
                                    </div>

                                    {/* Music icon */}
                                    <div className="w-9 h-9 shrink-0 rounded-lg bg-hud-accent-purple/10 border border-hud-accent-purple/20 flex items-center justify-center mt-0.5">
                                        <Music className="w-4 h-4 text-hud-accent-purple" />
                                    </div>

                                    {/* Main info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-hud-text-primary truncate group-hover:text-hud-accent-purple transition-colors">
                                                    {track.title}
                                                </p>
                                                <p className="text-xs text-hud-text-muted truncate mt-0.5">
                                                    {track.artist}
                                                </p>
                                            </div>

                                            {/* Similarity + Genre + Favorite */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                {track.genre && (
                                                    <span className="px-2 py-0.5 rounded-md bg-hud-bg-tertiary border border-hud-border-secondary text-[10px] text-hud-text-muted">
                                                        {track.genre}
                                                    </span>
                                                )}
                                                <span className="text-xs font-medium text-green-400 tabular-nums">
                                                    {Math.round(track.similarity_score * 100)}%
                                                </span>
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <FavoriteButton
                                                        track={{ title: track.title, artist: track.artist }}
                                                        size="sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tags */}
                                        {tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {tags.map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="px-2 py-0.5 rounded-full text-[10px] bg-hud-bg-tertiary/50 text-hud-text-muted border border-hud-border-secondary/50"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* AI explanation (Gemini or local fallback) */}
                                        {explanation && (
                                            <p className="mt-2 text-xs text-hud-text-secondary/70 italic leading-relaxed">
                                                {explanation}
                                            </p>
                                        )}

                                        {/* Audio features */}
                                        {track.audio_features && (
                                            <div className="flex items-center gap-4 mt-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] text-hud-text-muted w-10">Energy</span>
                                                    <div className="w-20 h-1 bg-hud-bg-tertiary rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-yellow-500 rounded-full transition-all"
                                                            style={{ width: `${energy * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-hud-text-muted/50 tabular-nums w-6">
                                                        {Math.round(energy * 100)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] text-hud-text-muted w-8">Mood</span>
                                                    <div className="w-20 h-1 bg-hud-bg-tertiary rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-pink-500 rounded-full transition-all"
                                                            style={{ width: `${valence * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-hud-text-muted/50 tabular-nums w-6">
                                                        {Math.round(valence * 100)}
                                                    </span>
                                                </div>
                                                {acousticness > 0 && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] text-hud-text-muted w-14">Acoustic</span>
                                                        <div className="w-20 h-1 bg-hud-bg-tertiary rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${getAcousticnessColor(acousticness)}`}
                                                                style={{ width: `${acousticness * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] text-hud-text-muted/50 tabular-nums w-6">
                                                            {Math.round(acousticness * 100)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )
                        })}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Empty state */}
            {!isLoading && results.length === 0 && !searchError && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-center py-24 text-hud-text-muted"
                >
                    <Sparkles className="w-10 h-10 mx-auto mb-4 opacity-20" />
                    <p className="text-sm">검색어를 입력하면 AI가 어울리는 음악을 찾아드립니다</p>
                </motion.div>
            )}
        </div>
    )
}

export default DeepDive
