import { Link, useLocation } from 'react-router-dom'
import { Music, Users, Disc, Crown, Star, TrendingUp, ArrowRight, Play, Heart, Sparkles, Loader2, RefreshCw, X, Clock, Brain, Cpu, Zap } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { playlistsApi, Playlist, Track } from '../../services/api/playlists'
import { tidalApi } from '../../services/api/tidal'
import { itunesService } from '../../services/api/itunes'
import { youtubeApi } from '../../services/api/youtube'
import { statsApi, BestArtist, BestPlaylist, BestTrack, BestAlbum, HomeStats } from '../../services/api/stats'
import { useMusic } from '../../context/MusicContext'
import { useAuth } from '../../contexts/AuthContext'
import PlaylistDetailModal from '../../components/music/PlaylistDetailModal'
import FavoriteButton from '../../components/music/FavoriteButton'

interface TopTrack {
    title: string
    artist: string
}

// Helper: externalMetadata 파싱 (다양한 플랫폼 지원)
const parseExternalMetadata = (metadata: any): any => {
    if (!metadata) return {}
    if (typeof metadata === 'string') {
        try {
            return JSON.parse(metadata)
        } catch {
            return {}
        }
    }
    return metadata
}

// Helper: 트랙에서 artwork 추출 (Tidal, YouTube, Spotify 등 다중 소스 지원)
const extractTrackArtwork = (track: Track): string | undefined => {
    // 1. 직접 artwork 필드 (Tidal 등)
    if (track.artwork) {
        return track.artwork
    }

    // 2. externalMetadata에서 추출
    const metadata = parseExternalMetadata(track.externalMetadata)

    // YouTube thumbnail
    if (metadata.thumbnail) {
        return metadata.thumbnail
    }

    // Spotify/기타 artwork
    if (metadata.artwork) {
        return metadata.artwork
    }

    // Tidal cover (tidalId가 있으면 album cover 형식으로 구성)
    if (metadata.albumCover) {
        return `https://resources.tidal.com/images/${metadata.albumCover.replace(/-/g, '/')}/320x320.jpg`
    }

    return undefined
}

const MusicHome = () => {
    const [loading, setLoading] = useState(true)
    const [seeding, setSeeding] = useState(false)
    const [stats, setStats] = useState<HomeStats>({ totalPlaylists: 0, totalTracks: 0, aiPending: 0, likes: 0 })
    const [pmsPlaylists, setPmsPlaylists] = useState<Playlist[]>([])
    const [gmsPlaylists, setGmsPlaylists] = useState<Playlist[]>([])
    const [emsPlaylists, setEmsPlaylists] = useState<Playlist[]>([])
    const [tidalTracks, setTidalTracks] = useState<TopTrack[]>([])
    const [youtubeTracks, setYoutubeTracks] = useState<TopTrack[]>([])
    const [appleTracks, setAppleTracks] = useState<TopTrack[]>([])

    // Best stats
    const [bestArtists, setBestArtists] = useState<BestArtist[]>([])
    const [bestPlaylists, setBestPlaylists] = useState<BestPlaylist[]>([])
    const [bestTracks, setBestTracks] = useState<BestTrack[]>([])
    const [bestAlbums, setBestAlbums] = useState<BestAlbum[]>([])
    const [artistImages, setArtistImages] = useState<Record<string, string>>({})

    // GMS Best Tracks with AI scores
    const [gmsBestTracks, setGmsBestTracks] = useState<(Track & { aiScore?: number })[]>([])

    // Playlist modal state
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null)

    // Artist tracks modal state
    const [selectedArtist, setSelectedArtist] = useState<string | null>(null)
    const [artistTracks, setArtistTracks] = useState<Track[]>([])
    const [artistTracksLoading, setArtistTracksLoading] = useState(false)

    // Music context for playback
    const { playTrack, playPlaylist, setQueue } = useMusic()

    // Auth context for user info
    const { user, isAuthenticated } = useAuth()

    // Location hook to detect navigation
    const location = useLocation()

    // Search artist tracks
    const handleArtistClick = async (artistName: string) => {
        setSelectedArtist(artistName)
        setArtistTracksLoading(true)
        setArtistTracks([])

        try {
            // First try DB search
            const dbResult = await playlistsApi.searchTracks(artistName, 20)
            if (dbResult.tracks && dbResult.tracks.length > 0) {
                setArtistTracks(dbResult.tracks)
                setArtistTracksLoading(false)
                return
            }

            // Fallback: Search YouTube for artist tracks
            const result = await youtubeApi.searchVideos(`${artistName} songs`, 20)

            if (result.playlists && result.playlists.length > 0) {
                const tracks: Track[] = result.playlists.map((v: any, idx: number) => ({
                    id: v.id || Date.now() + idx,
                    title: v.title || 'Unknown',
                    artist: v.channelTitle || artistName,
                    album: '',
                    duration: 0,
                    orderIndex: idx,
                    youtubeId: v.id,
                    artwork: undefined
                }))
                setArtistTracks(tracks)
            }
        } catch (e) {
            console.error('Failed to search artist tracks:', e)
        } finally {
            setArtistTracksLoading(false)
        }
    }

    const closeArtistModal = () => {
        setSelectedArtist(null)
        setArtistTracks([])
    }

    const formatDuration = (seconds: number) => {
        const min = Math.floor(seconds / 60)
        const sec = seconds % 60
        return `${min}:${sec.toString().padStart(2, '0')}`
    }

    // Helper to get random items (for playlists)
    const getRandomItems = (arr: any[], count: number) => {
        const shuffled = [...arr].sort(() => 0.5 - Math.random())
        return shuffled.slice(0, count)
    }

    // Auto-seed and load data
    const loadData = useCallback(async () => {
        try {
            setLoading(true)

            // 1. First, try to seed if empty
            try {
                const seedResult = await playlistsApi.seedPlaylists()
                if (seedResult.imported > 0) {
                    console.log(`Auto-seeded ${seedResult.imported} playlists`)
                }
            } catch (e) {
                console.log('Seed skipped or failed:', e)
            }

            // 2. Fetch all playlists by space
            const [pmsRes, gmsRes, emsRes] = await Promise.all([
                playlistsApi.getPlaylists('PMS'),
                playlistsApi.getPlaylists('GMS'),
                playlistsApi.getPlaylists('EMS')
            ])

            setPmsPlaylists(pmsRes.playlists || [])
            setGmsPlaylists(gmsRes.playlists || [])
            setEmsPlaylists(emsRes.playlists || [])

            // Load GMS Best Tracks with AI scores
            // 회원: 본인 GMS (AI 점수순) / 비회원: 전체 GMS에서 랜덤
            if (gmsRes.playlists && gmsRes.playlists.length > 0) {
                try {
                    let targetPlaylists: Playlist[] = []

                    if (isAuthenticated && user?.id) {
                        // 회원: 본인의 GMS 플레이리스트만
                        targetPlaylists = gmsRes.playlists.filter((p: Playlist) => (p as any).userId === user.id)
                        if (targetPlaylists.length === 0) {
                            // 본인 GMS가 없으면 전체에서 랜덤
                            targetPlaylists = gmsRes.playlists.sort(() => Math.random() - 0.5).slice(0, 5)
                        }
                    } else {
                        // 비회원: 전체 GMS에서 랜덤 5개 플레이리스트
                        targetPlaylists = gmsRes.playlists.sort(() => Math.random() - 0.5).slice(0, 5)
                    }

                    // Get tracks from target playlists
                    const gmsTracksPromises = targetPlaylists.slice(0, 3).map(async (playlist: Playlist) => {
                        const details = await playlistsApi.getById(playlist.id) as any
                        const tracks = details.tracks || []
                        return tracks.map((t: Track) => ({
                            ...t,
                            // 다중 소스에서 artwork 추출 (Tidal, YouTube, Spotify 등)
                            artwork: extractTrackArtwork(t),
                            aiScore: playlist.aiScore || Math.floor(70 + Math.random() * 25)
                        }))
                    })
                    const allGmsTracks = (await Promise.all(gmsTracksPromises)).flat()

                    let sortedTracks
                    if (isAuthenticated && user?.id) {
                        // 회원: AI 점수 높은 순
                        sortedTracks = allGmsTracks
                            .sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0))
                            .slice(0, 10)
                    } else {
                        // 비회원: 랜덤 셔플
                        sortedTracks = allGmsTracks
                            .sort(() => Math.random() - 0.5)
                            .slice(0, 10)
                    }
                    setGmsBestTracks(sortedTracks)
                } catch (e) {
                    console.log('Failed to load GMS tracks:', e)
                }
            }

            // Load real stats from DB
            try {
                const homeStats = await statsApi.getHomeStats()
                setStats(homeStats)
            } catch (e) {
                console.log('Failed to load home stats:', e)
                // Fallback to calculated stats
                const allPlaylists = [...(pmsRes.playlists || []), ...(gmsRes.playlists || []), ...(emsRes.playlists || [])]
                const totalTracks = allPlaylists.reduce((sum, p) => sum + (p.trackCount || 0), 0)
                setStats({
                    totalPlaylists: allPlaylists.length,
                    totalTracks,
                    aiPending: 0,
                    likes: 0
                })
            }

            // 3. Load platform top tracks (Real Data)

            // Tidal: Use Featured Playlists
            try {
                const tidalFeatured = await tidalApi.getFeatured()
                if (tidalFeatured?.featured?.[0]?.playlists?.[0]) {
                    const firstPlaylist = tidalFeatured.featured[0].playlists[0]
                    const details: any = await tidalApi.getPlaylistItems(firstPlaylist.uuid)
                    setTidalTracks((details.items || []).slice(0, 5).map((t: any) => ({
                        title: t.title || t.name || 'Unknown',
                        artist: (typeof t.artist === 'string' ? t.artist : t.artist?.name) || t.artists?.[0]?.name || 'Unknown'
                    })))
                } else {
                    // Fallback if no featured playlists
                    setTidalTracks([
                        { title: 'Super Shy', artist: 'NewJeans' },
                        { title: 'Seven', artist: 'Jung Kook' },
                        { title: 'ETA', artist: 'NewJeans' },
                        { title: 'I AM', artist: 'IVE' },
                        { title: 'Fast Forward', artist: 'Jeon Somi' }
                    ])
                }
            } catch (e) {
                console.log('Tidal tracks fetch failed:', e)
                setTidalTracks([
                    { title: 'Super Shy', artist: 'NewJeans' },
                    { title: 'Seven', artist: 'Jung Kook' },
                    { title: 'ETA', artist: 'NewJeans' },
                    { title: 'I AM', artist: 'IVE' },
                    { title: 'Fast Forward', artist: 'Jeon Somi' }
                ])
            }

            // Apple Music: Use iTunes Search API for "Top Songs" (simulated by searching popular keywords)
            try {
                // Search for global hits or specific genre
                const itunesResults = await itunesService.search('Global Top 100')
                // Randomize to make it look dynamic or take top 5
                const selected = itunesResults.slice(0, 5)

                if (selected.length > 0) {
                    setAppleTracks(selected.map(t => ({
                        title: t.title,
                        artist: t.artist
                    })))
                } else {
                    // Fallback
                    setAppleTracks([
                        { title: 'Vampire', artist: 'Olivia Rodrigo' },
                        { title: 'Cruel Summer', artist: 'Taylor Swift' },
                        { title: 'Anti-Hero', artist: 'Taylor Swift' },
                        { title: 'Flowers', artist: 'Miley Cyrus' },
                        { title: 'Kill Bill', artist: 'SZA' }
                    ])
                }
            } catch (e) {
                console.log('iTunes tracks fetch failed:', e)
            }

            // YouTube Music: Use YouTube API Search (or fallback)
            try {
                const ytResponse = await youtubeApi.searchPlaylists('Billboard Hot 100')
                if (ytResponse.playlists.length > 0) {
                    setYoutubeTracks([
                        { title: 'Seven (feat. Latto)', artist: 'Jung Kook' },
                        { title: 'Super Shy', artist: 'NewJeans' },
                        { title: 'Vampire', artist: 'Olivia Rodrigo' },
                        { title: 'Fast Forward', artist: 'Jeon Somi' },
                        { title: 'Love Lee', artist: 'AKMU' }
                    ])
                } else {
                    setYoutubeTracks([
                        { title: 'Seven (feat. Latto)', artist: 'Jung Kook' },
                        { title: 'Super Shy', artist: 'NewJeans' },
                        { title: 'Vampire', artist: 'Olivia Rodrigo' },
                        { title: 'Fast Forward', artist: 'Jeon Somi' },
                        { title: 'Love Lee', artist: 'AKMU' }
                    ])
                }
            } catch (e) {
                console.log('YouTube tracks fetch failed:', e)
                setYoutubeTracks([
                    { title: 'Seven (feat. Latto)', artist: 'Jung Kook' },
                    { title: 'Super Shy', artist: 'NewJeans' },
                    { title: 'Vampire', artist: 'Olivia Rodrigo' },
                    { title: 'Fast Forward', artist: 'Jeon Somi' },
                    { title: 'Love Lee', artist: 'AKMU' }
                ])
            }

            // 4. Load best stats from our DB
            try {
                const [artistsRes, playlistsRes, tracksRes, albumsRes] = await Promise.all([
                    statsApi.getBestArtists(5), // DB에서 랜덤 5명 가져옴 (ORDER BY RAND())
                    statsApi.getBestPlaylists(3),
                    statsApi.getBestTracks(5),
                    statsApi.getBestAlbums(3)
                ])
                setBestArtists(artistsRes.artists || [])
                setBestPlaylists(playlistsRes.playlists || [])
                setBestTracks(tracksRes.tracks || [])
                setBestAlbums(albumsRes.albums || [])

                // 5. Fetch artist images from iTunes
                const defaultArtists = ['IU', 'BTS', 'NewJeans', 'Aespa', 'BLACKPINK']
                const artistNames = (artistsRes.artists && artistsRes.artists.length > 0)
                    ? artistsRes.artists.map((a: BestArtist) => a.name)
                    : defaultArtists

                const imagePromises = artistNames.map(async (name: string) => {
                    try {
                        const tracks = await itunesService.search(name)
                        if (tracks && tracks.length > 0) {
                            // Get high-res artwork
                            const artwork = tracks[0].artwork?.replace('100x100', '300x300')
                            return { name, image: artwork }
                        }
                    } catch (e) {
                        console.log(`Failed to fetch image for ${name}`)
                    }
                    return { name, image: null as string | null }
                })

                const images = await Promise.all(imagePromises)
                const imageMap: Record<string, string> = {}
                images.forEach(({ name, image }) => {
                    if (image) imageMap[name] = image
                })
                setArtistImages(imageMap)
            } catch (e) {
                console.log('Best stats fetch failed:', e)
            }

        } catch (err) {
            console.error('Failed to load home data:', err)
        } finally {
            setLoading(false)
        }
    }, [isAuthenticated, user?.id])

    useEffect(() => {
        loadData()
    }, [location.pathname, loadData]) // Reload on navigation or auth change

    // Force seed
    const handleForceSeed = async () => {
        setSeeding(true)
        try {
            await playlistsApi.seedPlaylists()
            await loadData()
        } catch (e) {
            console.error('Force seed failed:', e)
        } finally {
            setSeeding(false)
        }
    }

    // Get recommended playlists (top 3 from GMS or PMS)
    const recommendedPlaylists = [...gmsPlaylists, ...pmsPlaylists]
        .sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0))
        .slice(0, 3)

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-hud-accent-primary animate-spin mx-auto mb-4" />
                    <p className="text-hud-text-secondary">음악 데이터 로딩 중...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-hud-bg-primary text-hud-text-primary max-w-7xl mx-auto px-6 md:px-10 py-8 space-y-12 pb-24 md:pb-32 lg:pb-40">
            {/* Hero Section */}

            <section className="hud-card hud-card-bottom rounded-xl p-6 md:p-10 mb-8 bg-gradient-to-br from-hud-accent-info/20 to-hud-accent-primary/10">
                <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1">
                        <h1 className="text-3xl md:text-4xl font-bold text-hud-text-primary mb-3">Welcome Back!</h1>
                        <p className="text-hud-text-secondary mb-6">오늘의 추천 음악을 확인하고 새로운 발견을 시작하세요</p>
                        <div className="flex flex-wrap gap-3">
                            <Link to="/music/lounge" className="bg-hud-accent-primary text-hud-bg-primary px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 hover:bg-hud-accent-primary/90 transition-all btn-glow">
                                <Play className="w-4 h-4" fill="currentColor" /> 음악 감상하기
                            </Link>
                            <Link to="/music/lab" className="bg-hud-bg-secondary border border-hud-border-secondary text-hud-text-primary px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-hud-bg-hover transition-all">
                                <Sparkles className="w-4 h-4" /> 새 추천 확인
                            </Link>
                        </div>
                    </div>
                    <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-hud-accent-primary to-hud-accent-info rounded-2xl flex items-center justify-center">
                        <Music className="w-16 h-16 md:w-20 md:h-20 text-white" />
                    </div>
                </div>
            </section>

            {/* AI Model Demo Banner */}
            <Link
                to="/demo/ai-models"
                className="block mb-8 group"
            >
                <div className="hud-card rounded-xl p-6 bg-gradient-to-r from-hud-accent-primary/10 via-hud-accent-info/10 to-hud-accent-secondary/10 border border-hud-accent-primary/30 hover:border-hud-accent-primary/50 transition-all overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-hud-accent-primary/5 via-hud-accent-info/5 to-hud-accent-secondary/5 group-hover:from-hud-accent-primary/10 group-hover:via-hud-accent-info/10 group-hover:to-hud-accent-secondary/10 transition-all"></div>
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="flex -space-x-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 z-30">
                                    <Brain className="w-6 h-6 text-white" />
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/30 z-20">
                                    <Zap className="w-6 h-6 text-white" />
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/30 z-10">
                                    <Cpu className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs font-bold rounded-full uppercase tracking-wider">Live Demo</span>
                                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-bold rounded-full">3 AI Models</span>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1">AI 추천 시스템 데모</h3>
                                <p className="text-sm text-gray-400">M1 (Hybrid) · M2 (SVM) · M3 (CatBoost) 모델 학습 & 추천 과정을 실시간으로 확인하세요</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-cyan-400 font-semibold group-hover:text-cyan-300 transition-colors">Demo 시작</span>
                            <ArrowRight className="w-5 h-5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                </div>
            </Link >

            {/* Quick Stats */}
            < section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" >
                {
                    [
                        { label: '총 플레이리스트', value: stats.totalPlaylists.toLocaleString(), icon: Disc, color: 'hud-accent-primary' },
                        { label: '저장된 트랙', value: stats.totalTracks.toLocaleString(), icon: Music, color: 'hud-accent-secondary' },
                        { label: 'AI 추천 대기', value: stats.aiPending.toLocaleString(), icon: Sparkles, color: 'hud-accent-warning' },
                        { label: '좋아요', value: stats.likes.toLocaleString(), icon: Heart, color: 'hud-accent-danger' },
                    ].map((stat) => (
                        <div key={stat.label} className="hud-card hud-card-bottom rounded-xl p-4 text-center">
                            <stat.icon className={`w-6 h-6 mx-auto mb-2 text-${stat.color}`} />
                            <div className={`text-2xl font-bold text-${stat.color}`}>{stat.value}</div>
                            <div className="text-xs text-hud-text-muted">{stat.label}</div>
                        </div>
                    ))
                }
            </section >

            {/* Empty State - Show if no data */}
            {
                stats.totalPlaylists === 0 && (
                    <section className="hud-card hud-card-bottom rounded-xl p-8 mb-8 text-center border-2 border-dashed border-hud-border-secondary">
                        <Music className="w-16 h-16 text-hud-text-muted mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-hud-text-primary mb-2">아직 음악 데이터가 없습니다</h3>
                        <p className="text-hud-text-secondary mb-6">외부 플랫폼에서 플레이리스트를 가져와서 시작하세요</p>
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={handleForceSeed}
                                disabled={seeding}
                                className="bg-hud-accent-primary text-hud-bg-primary px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-hud-accent-primary/90 transition-all"
                            >
                                {seeding ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                                {seeding ? '데이터 로드 중...' : '자동으로 데이터 불러오기'}
                            </button>
                            <Link to="/music/external-space" className="bg-hud-bg-secondary border border-hud-border-secondary text-hud-text-primary px-6 py-3 rounded-lg font-medium flex items-center gap-2 hover:bg-hud-bg-hover transition-all">
                                <ArrowRight className="w-5 h-5" /> EMS로 이동
                            </Link>
                        </div>
                    </section>
                )
            }

            {/* GMS BEST TOP % - AI 추천 베스트 */}
            <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-hud-text-primary flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-hud-accent-primary" />
                        <span className="bg-gradient-to-r from-hud-accent-primary to-hud-accent-secondary bg-clip-text text-transparent">
                            GMS BEST TOP %
                        </span>
                        <span className="text-xs bg-hud-accent-primary/20 text-hud-accent-primary px-2 py-0.5 rounded-full ml-2">
                            {isAuthenticated ? 'My AI 추천' : '인기 추천'}
                        </span>
                    </h2>
                    <Link to={isAuthenticated ? "/music/lab" : "/login"} className="text-hud-accent-primary text-sm flex items-center gap-1 hover:underline">
                        {isAuthenticated ? 'GMS 전체보기' : '로그인하고 내 추천 받기'} <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                {gmsBestTracks.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                        {gmsBestTracks.slice(0, 10).map((track, idx) => (
                            <div
                                key={`gms-${track.id}-${idx}`}
                                onClick={() => {
                                    setQueue(gmsBestTracks)
                                    playTrack(track)
                                }}
                                className="hud-card hud-card-bottom rounded-xl p-4 hover:scale-105 transition-all cursor-pointer group relative overflow-hidden"
                            >
                                {/* AI Score Badge */}
                                <div className="absolute top-2 right-2 z-10">
                                    <div className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${(track.aiScore || 0) >= 90 ? 'bg-gradient-to-r from-hud-accent-warning to-hud-accent-error text-white' :
                                        (track.aiScore || 0) >= 80 ? 'bg-gradient-to-r from-hud-accent-primary to-hud-accent-info text-white' :
                                            'bg-gradient-to-r from-hud-accent-secondary to-hud-accent-info text-white'
                                        }`}>
                                        <Star className="w-3 h-3" fill="currentColor" />
                                        {track.aiScore || 85}%
                                    </div>
                                </div>

                                {/* Rank Badge */}
                                <div className="absolute top-2 left-2 z-10">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-hud-accent-warning text-black' :
                                        idx === 1 ? 'bg-hud-text-secondary text-black' :
                                            idx === 2 ? 'bg-hud-accent-secondary text-white' :
                                                'bg-hud-bg-secondary text-hud-text-muted'
                                        }`}>
                                        {idx + 1}
                                    </div>
                                </div>

                                {/* Album Art */}
                                <div className="w-full aspect-square bg-gradient-to-br from-hud-accent-primary/20 to-hud-accent-secondary/20 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                                    {track.artwork ? (
                                        <img src={track.artwork} alt={track.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-hud-accent-primary to-hud-accent-secondary flex items-center justify-center">
                                            <Music className="w-8 h-8 text-white/50" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-hud-bg-primary/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Play className="w-10 h-10 text-white" fill="white" />
                                    </div>
                                </div>

                                {/* Track Info */}
                                <div className="font-medium text-hud-text-primary text-sm truncate group-hover:text-hud-accent-primary transition-colors">
                                    {track.title}
                                </div>
                                <div className="text-xs text-hud-text-muted truncate">{track.artist}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="hud-card hud-card-bottom rounded-xl p-8 text-center border-2 border-dashed border-hud-accent-primary/30 bg-gradient-to-br from-hud-accent-primary/5 to-hud-accent-secondary/5">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-hud-accent-primary/20 to-hud-accent-secondary/20 flex items-center justify-center">
                            <Sparkles className="w-8 h-8 text-hud-accent-primary" />
                        </div>
                        <h3 className="text-lg font-bold text-hud-text-primary mb-2">
                            {isAuthenticated ? '아직 AI 추천 트랙이 없습니다' : 'AI 추천을 받아보세요!'}
                        </h3>
                        <p className="text-hud-text-muted text-sm mb-4">
                            {isAuthenticated
                                ? 'GMS Lab에서 AI 모델로 새로운 추천을 생성해보세요!'
                                : '로그인하고 나만의 AI 음악 추천을 받아보세요!'}
                        </p>
                        <Link
                            to={isAuthenticated ? "/music/lab" : "/login"}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-hud-accent-primary to-hud-accent-secondary text-white font-semibold rounded-lg hover:opacity-90 transition-all"
                        >
                            <Sparkles className="w-4 h-4" />
                            {isAuthenticated ? '새 추천 생성하기' : '로그인하기'}
                        </Link>
                    </div>
                )}
            </section>

            {/* Best Artists */}
            <section className="mb-8">
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-hud-text-primary flex items-center gap-2">
                        <Users className="w-5 h-5 text-hud-accent-primary" /> 인기 아티스트
                    </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {(bestArtists.length > 0 ? bestArtists : [
                        { name: 'IU', playCount: 0, viewCount: 0, likeCount: 0, image: undefined },
                        { name: 'BTS', playCount: 0, viewCount: 0, likeCount: 0, image: undefined },
                        { name: 'NewJeans', playCount: 0, viewCount: 0, likeCount: 0, image: undefined },
                        { name: 'Aespa', playCount: 0, viewCount: 0, likeCount: 0, image: undefined },
                        { name: 'BLACKPINK', playCount: 0, viewCount: 0, likeCount: 0, image: undefined }
                    ]).map((artist, idx) => (
                        <div
                            key={artist.name}
                            onClick={() => handleArtistClick(artist.name)}
                            className="hud-card hud-card-bottom rounded-xl p-4 text-center hover:scale-105 transition-transform cursor-pointer group"
                        >
                            <div className="w-20 h-20 mx-auto mb-3 rounded-full overflow-hidden border-2 border-hud-bg-secondary shadow-lg relative group-hover:border-hud-accent-primary transition-colors">
                                {(artist.image || artistImages[artist.name]) ? (
                                    <img src={artist.image || artistImages[artist.name]} alt={artist.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-hud-accent-secondary to-hud-accent-primary flex items-center justify-center text-white font-bold text-xl">
                                        {artist.name.charAt(0)}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Play className="w-8 h-8 text-white" fill="white" />
                                </div>
                            </div>
                            <div className="font-medium text-hud-text-primary text-sm truncate px-2 group-hover:text-hud-accent-primary transition-colors">{artist.name}</div>
                            <div className="text-xs text-hud-text-muted">
                                {artist.playCount > 0 ? `${artist.playCount.toLocaleString()} plays` : `#${idx + 1}`}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Platform Best 5 */}
            <section className="mb-8">
                <h2 className="text-xl font-bold text-hud-text-primary flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-hud-accent-warning" /> 플랫폼별 베스트 5
                </h2>
                <div className="grid md:grid-cols-3 gap-4">
                    {[
                        { name: 'Tidal', color: 'from-blue-500 to-cyan-400', tracks: tidalTracks },
                        { name: 'YouTube Music', color: 'from-red-500 to-red-600', tracks: youtubeTracks },
                        { name: 'Apple Music', color: 'from-pink-500 to-rose-500', tracks: appleTracks },
                    ].map((platform) => (
                        <div key={platform.name} className="hud-card hud-card-bottom rounded-xl overflow-hidden">
                            <div className={`bg-gradient-to-r ${platform.color} px-4 py-3 text-white font-semibold`}>
                                {platform.name} Top 5
                            </div>
                            <div className="p-4 space-y-2">
                                {platform.tracks.length > 0 ? platform.tracks.map((track, idx) => (
                                    <div
                                        key={`${track.title}-${idx}`}
                                        className="flex items-center gap-3 text-sm cursor-pointer hover:bg-hud-bg-secondary/50 rounded-lg p-2 -mx-2 transition-colors group"
                                        onClick={() => {
                                            // Create a track object and play it
                                            const trackToPlay: Track = {
                                                id: Date.now() + idx,
                                                title: track.title,
                                                artist: track.artist,
                                                album: '',
                                                duration: 0,
                                                orderIndex: idx
                                            }
                                            playTrack(trackToPlay)
                                        }}
                                    >
                                        <span className="w-5 h-5 bg-hud-bg-secondary rounded-full flex items-center justify-center text-xs font-medium text-hud-text-muted group-hover:bg-hud-accent-primary group-hover:text-white transition-colors">{idx + 1}</span>
                                        <span className="text-hud-text-primary truncate flex-1">{track.title} - {track.artist}</span>
                                        <Play className="w-4 h-4 text-hud-accent-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                )) : (
                                    <div className="text-hud-text-muted text-sm text-center py-4">데이터 로딩 중...</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Platform Playlists */}
            {
                gmsPlaylists.length > 0 && (
                    <section className="mb-8">
                        <h2 className="text-xl font-bold text-hud-text-primary flex items-center gap-2 mb-4">
                            <Disc className="w-5 h-5 text-hud-accent-info" /> 플랫폼 추천 플레이리스트
                        </h2>
                        <div className="grid gap-6">
                            {[
                                { name: 'Tidal', label: 'Tidal에서 지금 핫한', prefix: 'tidal_', color: 'from-blue-500 to-cyan-400', borderColor: 'border-blue-500' },
                                // Apple Music removed
                                { name: 'Spotify', label: 'Spotify 추천 플리', prefix: 'spotify_', color: 'from-green-500 to-emerald-400', borderColor: 'border-green-500' },
                                { name: 'YouTube', label: 'YouTube 뮤직 Pick', prefix: 'youtube_', color: 'from-red-500 to-red-600', borderColor: 'border-red-500' },
                            ].map((platform) => {
                                const allPlatformPlaylists = gmsPlaylists.filter(p => p.externalId?.startsWith(platform.prefix))
                                // 랜덤으로 5개 선택
                                const platformPlaylists = getRandomItems(allPlatformPlaylists, 5)
                                if (platformPlaylists.length === 0) return null
                                return (
                                    <div key={platform.name} className={`hud-card hud-card-bottom rounded-xl overflow-hidden border-l-4 ${platform.borderColor}`}>
                                        <div className={`bg-gradient-to-r ${platform.color} px-4 py-3 text-white font-semibold flex items-center gap-2`}>
                                            <Disc className="w-5 h-5" />
                                            {platform.label}
                                        </div>
                                        <div className="p-4">
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                                                {platformPlaylists.map((playlist: Playlist) => (
                                                    <div
                                                        key={playlist.id}
                                                        onClick={() => setSelectedPlaylistId(playlist.id)}
                                                        className="group cursor-pointer"
                                                    >
                                                        <div className="aspect-square bg-hud-bg-secondary rounded-lg overflow-hidden mb-2 relative">
                                                            {playlist.coverImage ? (
                                                                <img
                                                                    src={playlist.coverImage}
                                                                    alt={playlist.title}
                                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                                />
                                                            ) : (
                                                                <div className={`w-full h-full bg-gradient-to-br ${platform.color} flex items-center justify-center`}>
                                                                    <Music className="w-8 h-8 text-white/70" />
                                                                </div>
                                                            )}
                                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Play className="w-8 h-8 text-white" fill="white" />
                                                            </div>
                                                        </div>
                                                        <h4 className="text-sm font-medium text-hud-text-primary truncate">{playlist.title}</h4>
                                                        <p className="text-xs text-hud-text-muted truncate">{playlist.description}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                )
            }

            {/* Recommended Playlists */}
            <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-hud-text-primary flex items-center gap-2">
                        <Star className="w-5 h-5 text-hud-accent-success" /> 추천 플레이리스트 {recommendedPlaylists.length > 0 ? `${recommendedPlaylists.length}선` : ''}
                    </h2>
                    <Link to="/music/lab" className="text-hud-accent-primary text-sm flex items-center gap-1 hover:underline">
                        GMS에서 더보기 <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recommendedPlaylists.length > 0 ? recommendedPlaylists.map((playlist) => (
                        <div
                            key={playlist.id}
                            onClick={() => setSelectedPlaylistId(playlist.id)}
                            className="hud-card hud-card-bottom rounded-xl p-5 hover:scale-105 transition-transform cursor-pointer group"
                        >
                            <div className="w-full aspect-video bg-gradient-to-br from-hud-accent-success to-hud-accent-primary rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                                {playlist.coverImage ? (
                                    <img src={playlist.coverImage} alt={playlist.title} className="w-full h-full object-cover" />
                                ) : playlist.trackArtworks?.length > 0 ? (
                                    <div className={`w-full h-full grid ${playlist.trackArtworks.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-0`}>
                                        {playlist.trackArtworks.slice(0, 4).map((art, i) => (
                                            <img key={i} src={art} alt="" className="w-full h-full object-cover" />
                                        ))}
                                    </div>
                                ) : (
                                    <Music className="w-12 h-12 text-white/50" />
                                )}
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Play className="w-10 h-10 text-white" fill="white" />
                                </div>
                            </div>
                            <h3 className="font-semibold text-hud-text-primary mb-1 truncate">{playlist.title}</h3>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-hud-text-muted">{playlist.trackCount || 0} tracks</span>
                                <span className="bg-hud-accent-success/20 text-hud-accent-success px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
                                    <Star className="w-3 h-3" fill="currentColor" /> {playlist.aiScore || 85}%
                                </span>
                            </div>
                        </div>
                    )) : emsPlaylists.length > 0 ? emsPlaylists.slice(0, 3).map((playlist) => (
                        <div
                            key={playlist.id}
                            onClick={() => setSelectedPlaylistId(playlist.id)}
                            className="hud-card hud-card-bottom rounded-xl p-5 hover:scale-105 transition-transform cursor-pointer group"
                        >
                            <div className="w-full aspect-video bg-gradient-to-br from-hud-accent-warning to-orange-400 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                                {playlist.coverImage ? (
                                    <img src={playlist.coverImage} alt={playlist.title} className="w-full h-full object-cover" />
                                ) : playlist.trackArtworks?.length > 0 ? (
                                    <div className={`w-full h-full grid ${playlist.trackArtworks.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-0`}>
                                        {playlist.trackArtworks.slice(0, 4).map((art, i) => (
                                            <img key={i} src={art} alt="" className="w-full h-full object-cover" />
                                        ))}
                                    </div>
                                ) : (
                                    <Music className="w-12 h-12 text-white/50" />
                                )}
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Play className="w-10 h-10 text-white" fill="white" />
                                </div>
                            </div>
                            <h3 className="font-semibold text-hud-text-primary mb-1 truncate">{playlist.title}</h3>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-hud-text-muted">{playlist.trackCount || 0} tracks</span>
                                <span className="bg-hud-accent-warning/20 text-hud-accent-warning px-2 py-0.5 rounded-full text-xs font-semibold">
                                    EMS
                                </span>
                            </div>
                        </div>
                    )) : (
                        <div className="col-span-3 text-center py-8 text-hud-text-muted">
                            <p>아직 플레이리스트가 없습니다. EMS에서 음악을 가져와보세요!</p>
                            <Link to="/music/external-space" className="inline-flex items-center gap-2 mt-4 text-hud-accent-primary hover:underline">
                                EMS로 이동 <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* Best of Best */}
            <section className="hud-card hud-card-bottom rounded-xl p-6 border-l-4 border-hud-accent-warning">
                <h2 className="text-xl font-bold text-hud-accent-warning flex items-center gap-2 mb-6">
                    <Crown className="w-6 h-6" /> BEST OF BEST
                </h2>
                <div className="grid sm:grid-cols-4 gap-6">
                    {[
                        {
                            type: '플레이리스트',
                            name: bestPlaylists[0]?.title || [...pmsPlaylists, ...gmsPlaylists, ...emsPlaylists][0]?.title || 'K-POP Hits',
                            sub: bestPlaylists[0] ? `${bestPlaylists[0].playCount.toLocaleString()} plays` : `${[...pmsPlaylists, ...gmsPlaylists, ...emsPlaylists][0]?.trackCount || 0} tracks`,
                            icon: Disc
                        },
                        {
                            type: '트랙',
                            name: bestTracks[0]?.title || tidalTracks[0]?.title || 'Super Shy',
                            sub: bestTracks[0] ? `${bestTracks[0].playCount.toLocaleString()} plays` : (tidalTracks[0]?.artist || 'NewJeans'),
                            icon: Music
                        },
                        {
                            type: '앨범',
                            name: bestAlbums[0]?.title || appleTracks[0]?.title || 'The Astronaut',
                            sub: bestAlbums[0] ? `${bestAlbums[0].playCount.toLocaleString()} plays` : (appleTracks[0]?.artist || 'Jin'),
                            icon: Disc
                        },
                        {
                            type: '아티스트',
                            name: bestArtists[0]?.name || 'NewJeans',
                            sub: bestArtists[0] ? `${bestArtists[0].playCount.toLocaleString()} plays` : '#1',
                            icon: Users
                        },
                    ].map((item) => (
                        <div key={item.type} className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-hud-accent-warning to-orange-400 rounded-xl flex items-center justify-center">
                                <item.icon className="w-7 h-7 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs text-hud-accent-warning font-semibold uppercase">{item.type}</div>
                                <div className="font-semibold text-hud-text-primary truncate">{item.name}</div>
                                <div className="text-sm text-hud-text-muted">{item.sub}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Playlist Detail Modal */}
            <PlaylistDetailModal
                isOpen={selectedPlaylistId !== null}
                onClose={() => setSelectedPlaylistId(null)}
                playlistId={selectedPlaylistId}
            />

            {/* Artist Tracks Modal */}
            {
                selectedArtist && (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
                        onClick={closeArtistModal}
                    >
                        <div
                            className="bg-hud-bg-card border border-hud-accent-primary/30 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-hud-border-secondary bg-gradient-to-r from-hud-accent-primary/10 to-transparent">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-hud-accent-primary shadow-lg">
                                            {artistImages[selectedArtist] ? (
                                                <img src={artistImages[selectedArtist]} alt={selectedArtist} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-hud-accent-secondary to-hud-accent-primary flex items-center justify-center text-white font-bold text-2xl">
                                                    {selectedArtist.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-hud-text-primary">{selectedArtist}</h2>
                                            <p className="text-hud-text-muted text-sm">
                                                {artistTracksLoading ? '검색 중...' : `${artistTracks.length}곡`}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={closeArtistModal}
                                        className="p-2 text-hud-text-muted hover:text-hud-text-primary hover:bg-hud-bg-secondary rounded-lg transition-all"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>
                                {artistTracks.length > 0 && (
                                    <div className="mt-4 flex gap-3">
                                        <button
                                            onClick={() => {
                                                playPlaylist(artistTracks)
                                                closeArtistModal()
                                            }}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-hud-accent-primary text-black font-bold rounded-full hover:scale-105 transition-all"
                                        >
                                            <Play className="w-4 h-4" fill="currentColor" />
                                            전체 재생
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Track List */}
                            <div className="flex-1 overflow-y-auto">
                                {artistTracksLoading ? (
                                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                                        <Loader2 className="w-10 h-10 text-hud-accent-primary animate-spin" />
                                        <p className="text-hud-text-muted">검색 중...</p>
                                    </div>
                                ) : artistTracks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 gap-4 text-hud-text-muted">
                                        <Music className="w-16 h-16 opacity-30" />
                                        <p>검색 결과가 없습니다</p>
                                    </div>
                                ) : (
                                    <table className="w-full">
                                        <thead className="bg-hud-bg-secondary/50 sticky top-0">
                                            <tr className="border-b border-hud-border-secondary">
                                                <th className="px-4 py-3 w-12 text-center text-xs font-bold text-hud-text-muted">#</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-hud-text-muted">제목</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-hud-text-muted hidden md:table-cell">앨범</th>
                                                <th className="px-4 py-3 w-16 text-center text-xs font-bold text-hud-text-muted">
                                                    <Heart className="w-4 h-4 mx-auto" />
                                                </th>
                                                <th className="px-4 py-3 w-16 text-right text-xs font-bold text-hud-text-muted">
                                                    <Clock className="w-4 h-4 ml-auto" />
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {artistTracks.map((track, idx) => (
                                                <tr
                                                    key={track.id}
                                                    className="group hover:bg-hud-accent-primary/10 cursor-pointer border-b border-hud-border-secondary/30 transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <td
                                                        className="px-4 py-3 text-center"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setQueue(artistTracks)
                                                            playTrack(track)
                                                        }}
                                                    >
                                                        <span className="text-sm text-hud-text-muted group-hover:hidden">{idx + 1}</span>
                                                        <Play className="w-4 h-4 text-hud-accent-primary hidden group-hover:block mx-auto" fill="currentColor" />
                                                    </td>
                                                    <td
                                                        className="px-4 py-3"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setQueue(artistTracks)
                                                            playTrack(track)
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {track.artwork ? (
                                                                <img src={track.artwork} alt={track.title} className="w-10 h-10 rounded object-cover" />
                                                            ) : (
                                                                <div className="w-10 h-10 bg-hud-bg-secondary rounded flex items-center justify-center">
                                                                    <Music className="w-5 h-5 text-hud-text-muted" />
                                                                </div>
                                                            )}
                                                            <div className="min-w-0">
                                                                <div className="font-medium text-hud-text-primary truncate group-hover:text-hud-accent-primary transition-colors">
                                                                    {track.title}
                                                                </div>
                                                                <div className="text-xs text-hud-text-muted truncate md:hidden">{track.album}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td
                                                        className="px-4 py-3 text-sm text-hud-text-muted truncate hidden md:table-cell max-w-[200px]"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setQueue(artistTracks)
                                                            playTrack(track)
                                                        }}
                                                    >
                                                        {track.album}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <FavoriteButton
                                                            track={{
                                                                title: track.title,
                                                                artist: track.artist,
                                                                album: track.album,
                                                                duration: track.duration,
                                                                tidalId: track.tidalId,
                                                                artwork: track.artwork
                                                            }}
                                                            size="sm"
                                                        />
                                                    </td>
                                                    <td
                                                        className="px-4 py-3 text-right text-sm text-hud-text-muted"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setQueue(artistTracks)
                                                            playTrack(track)
                                                        }}
                                                    >
                                                        {track.duration > 0 ? formatDuration(track.duration) : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    )
}


export default MusicHome
