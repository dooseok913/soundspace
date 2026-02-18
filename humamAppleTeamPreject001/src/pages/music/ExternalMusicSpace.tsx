import UploadZone from '../../components/music/UploadZone'
import PlaylistDetailModal from '../../components/music/PlaylistDetailModal'
import FavoriteButton from '../../components/music/FavoriteButton'
import {
    EMSYoutubePick,
    EMSPlatformBest,
    EMSRecommendations,
    EMSMusicSearch,
    EMSPlaylistTable,
    EMSCartDrawer
} from '../../components/music/ems'
import { Sparkles, Plus, Link as LinkIcon, Play } from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { playlistsApi, Playlist as ApiPlaylist, Track } from '../../services/api/playlists'
import { fastapiService } from '../../services/api/fastapi'
import { itunesService, ItunesTrack, ItunesCollection } from '../../services/api/itunes'
import { tidalApi } from '../../services/api/tidal'
import { youtubeApi, YoutubePlaylist } from '../../services/api/youtube'
import { appleMusicApi, AppleMusicItem } from '../../services/api/apple'
import { cartApi, CartItem } from '../../services/api/cart'
import { useMusic } from '../../context/MusicContext'

interface Playlist {
    id: number
    name: string
    source: string
    trackCount: number
    status: 'unverified' | 'processing' | 'ready'
    addedDate: string
}

// Map API response to UI format
const mapApiPlaylist = (p: ApiPlaylist): Playlist => {
    let source = 'tidal'
    if (p.sourceType === 'Upload') source = 'file'
    else if (p.sourceType === 'Platform') {
        const lowerDesc = (p.description || '').toLowerCase()
        if (lowerDesc.includes('youtube')) source = 'youtube'
        else if (lowerDesc.includes('apple') || lowerDesc.includes('itunes')) source = 'apple'
        else source = 'tidal'
    } else {
        source = 'url'
    }

    return {
        id: p.id,
        name: p.title,
        source,
        trackCount: p.trackCount || 0,
        status: p.status === 'PTP' ? 'unverified' : p.status === 'PRP' ? 'processing' : 'ready',
        addedDate: new Date(p.createdAt).toLocaleDateString('ko-KR')
    }
}

const ExternalMusicSpace = () => {
    const [playlists, setPlaylists] = useState<Playlist[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [tidalConnected, setTidalConnected] = useState(false)
    const [tidalUserLoggedIn, setTidalUserLoggedIn] = useState(false)
    const [youtubeConnected, setYoutubeConnected] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [selectedDetailId, setSelectedDetailId] = useState<number | null>(null)

    // Music Search & Apple Music State
    const [trackSearchTerm, setTrackSearchTerm] = useState('')
    const [trackResults, setTrackResults] = useState<ItunesTrack[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [newReleases, setNewReleases] = useState<{ songs: AppleMusicItem[], playlists: AppleMusicItem[], albums: AppleMusicItem[] }>({ songs: [], playlists: [], albums: [] })
    const [isAutoImporting, setIsAutoImporting] = useState(false)

    // Recommendations State
    const [recommendations, setRecommendations] = useState<ItunesCollection[]>([])
    const [classicRecs, setClassicRecs] = useState<ItunesCollection[]>([])
    const [jazzRecs, setJazzRecs] = useState<ItunesCollection[]>([])
    const [kpopRecs, setKpopRecs] = useState<ItunesCollection[]>([])

    // Toast notification state
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

    // Spotify Special Event State
    const [spotifySpecial, setSpotifySpecial] = useState<{
        event: { title: string; subtitle: string; description: string };
        stats: { totalPlaylists: number; totalTracks: number; hotTracks: number };
        categories: Record<string, any[]>;
        hotTracks: any[];
        playlists: any[];
    } | null>(null)

    // YouTube Search State
    const [youtubeSearchTerm, setYoutubeSearchTerm] = useState('')
    const [youtubeResults, setYoutubeResults] = useState<YoutubePlaylist[]>([])
    const [isYoutubeSearching, setIsYoutubeSearching] = useState(false)
    const [viewingYoutubeId, setViewingYoutubeId] = useState<string | null>(null)

    // Track Cart State (DB 연동)
    const [cartTracks, setCartTracks] = useState<ItunesTrack[]>([])
    const [cartItemIds, setCartItemIds] = useState<Map<number, number>>(new Map()) // trackId -> cartItemId
    const [isCartOpen, setIsCartOpen] = useState(false)
    const [isCartLoading, setIsCartLoading] = useState(false)

    // Modal State
    const [isModalLoading, setIsModalLoading] = useState(false)

    const seedAttempted = useRef(false)
    const tidalSyncDone = useRef(false)

    // Music playback
    const { playTrack } = useMusic()
    const navigate = useNavigate()

    // Analysis progress state
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [analysisProgress, setAnalysisProgress] = useState(0)
    const [analysisMessage, setAnalysisMessage] = useState('')

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    // Handle playing a track from Spotify Special Event
    const handlePlaySpotifyTrack = (track: any) => {
        const trackToPlay: Track = {
            id: track.trackId || Date.now(),
            title: track.title || 'Unknown Track',
            artist: track.artist || 'Unknown Artist',
            album: track.album || 'Unknown Album',
            duration: track.duration || 180,
            isrc: track.isrc,
            orderIndex: 0,
            externalMetadata: {
                youtubeId: track.youtubeId,
                previewUrl: track.previewUrl,
                thumbnail: track.artwork,
                ...track.externalMetadata
            }
        }
        playTrack(trackToPlay)
    }

    // Fetch playlists from API
    const fetchPlaylists = useCallback(async (skipSeed = false) => {
        try {
            setLoading(true)
            setError(null)

            if (!skipSeed && !seedAttempted.current) {
                seedAttempted.current = true
                try {
                    const seedResult = await playlistsApi.seedPlaylists()
                    if (seedResult?.imported && seedResult.imported > 0) {
                        showToast(`${seedResult.imported}개 플레이리스트 자동 로드 완료!`, 'success')
                    }
                } catch (seedErr) {
                    console.log('Seed skipped:', seedErr)
                }
            }

            const response = await playlistsApi.getPlaylists('EMS')
            const playlists = response?.playlists || []
            setPlaylists(playlists.map(mapApiPlaylist))
        } catch (err) {
            console.error('Failed to fetch playlists:', err)
            setError('플레이리스트를 불러오는데 실패했습니다')
            setPlaylists([])
        } finally {
            setLoading(false)
        }
    }, [])

    const checkConnections = useCallback(async () => {
        try {
            const tidal = await tidalApi.getAuthStatus()
            setTidalConnected(tidal.authenticated)
            setTidalUserLoggedIn(tidal.userConnected || false)

            const youtube = await youtubeApi.getAuthStatus()
            setYoutubeConnected(youtube.authenticated)
        } catch (err) {
            console.error('Failed to check connection status:', err)
        }
    }, [])

    // 장바구니 DB에서 로드
    const loadCart = useCallback(async () => {
        try {
            setIsCartLoading(true)
            const response = await cartApi.getCart()
            if (response.success && response.cart) {
                const tracks: ItunesTrack[] = response.cart.map((item: CartItem) => ({
                    id: item.trackId || item.id,
                    title: item.title,
                    artist: item.artist,
                    album: item.album || '',
                    artwork: item.artwork || '',
                    audio: item.previewUrl || '',
                    url: '',
                    date: item.createdAt || '',
                    previewUrl: item.previewUrl || ''
                }))
                setCartTracks(tracks)

                // trackId -> cartItemId 매핑 저장
                const idMap = new Map<number, number>()
                response.cart.forEach((item: CartItem) => {
                    idMap.set(item.trackId || item.id, item.id)
                })
                setCartItemIds(idMap)
            }
        } catch (err) {
            console.error('Failed to load cart:', err)
        } finally {
            setIsCartLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchPlaylists()
        checkConnections()
        loadCart()
    }, [fetchPlaylists, checkConnections, loadCart])

    // Load Spotify Special Event
    useEffect(() => {
        const fetchSpotifySpecial = async () => {
            try {
                const res = await fetch('/api/ems/spotify-special')
                if (res.ok) {
                    const data = await res.json()
                    setSpotifySpecial(data)
                }
            } catch (e) {
                console.error('Failed to load Spotify Special:', e)
            }
        }
        fetchSpotifySpecial()
    }, [])

    // Load Apple Music New Releases (display only, no auto-import)
    useEffect(() => {
        const loadAppleNew = async () => {
            try {
                const data = await appleMusicApi.getNewReleases()
                setNewReleases(data as any)
            } catch (e) {
                console.error('Failed to load Apple Music new releases:', e)
            }
        }
        loadAppleNew()
    }, [])

    // Load Recommendations
    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                const [mixed, classic, jazz, kpop] = await Promise.all([
                    itunesService.getRecommendations(),
                    itunesService.getRecommendations('Classical'),
                    itunesService.getRecommendations('Vocal Jazz'),
                    itunesService.getRecommendations('K-Pop')
                ])
                setRecommendations(mixed)
                setClassicRecs(classic)
                setJazzRecs(jazz)
                setKpopRecs(kpop)
            } catch (err) {
                console.error('Failed to load recommendations', err)
            }
        }
        fetchRecommendations()
    }, [])

    // Tidal Sync
    const handleTidalSync = async () => {
        if (!tidalUserLoggedIn) return
        setSyncing(true)
        try {
            const response = await tidalApi.getFeatured()
            const featuredPlaylists = response.featured.flatMap(f => f.playlists)

            for (const p of featuredPlaylists) {
                try {
                    await playlistsApi.importPlaylist({
                        platformPlaylistId: p.uuid,
                        title: p.title,
                        description: p.description || `Imported from Tidal (${p.creator?.name || 'Unknown'})`,
                        coverImage: p.squareImage,
                        platform: 'Tidal'
                    })
                } catch (err: any) {
                    if (err.response?.status !== 409) console.error(err)
                }
            }
            await fetchPlaylists(true)
        } catch (err) {
            console.error('Tidal Sync failed:', err)
        } finally {
            setSyncing(false)
        }
    }

    // Train Model
    const trainModel = async () => {
        console.log('Train Model - Not implemented')
    }

    useEffect(() => {
        const syncAndTrain = async () => {
            if (tidalConnected && !syncing && !tidalSyncDone.current) {
                tidalSyncDone.current = true
                await handleTidalSync()
                await trainModel()
            }
        }
        if (tidalUserLoggedIn && !tidalSyncDone.current) {
            syncAndTrain()
        }
    }, [tidalUserLoggedIn, tidalConnected, syncing])

    // Handlers
    const handleSelectAll = (checked: boolean) => {
        setSelectedIds(checked ? playlists.map(p => p.id) : [])
    }

    const handleSelectRow = (id: number, checked: boolean) => {
        setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(sid => sid !== id))
    }

    // YouTube handlers
    const handleYoutubeSearch = async () => {
        if (!youtubeSearchTerm.trim()) return
        setIsYoutubeSearching(true)
        try {
            const response = await youtubeApi.searchPlaylists(youtubeSearchTerm)
            setYoutubeResults(response?.playlists || [])
        } catch (err) {
            console.error('YouTube search failed:', err)
            showToast('YouTube 검색 실패', 'error')
            setYoutubeResults([])
        } finally {
            setIsYoutubeSearching(false)
        }
    }

    const handleViewYoutubeDetail = async (playlist: YoutubePlaylist) => {
        setViewingYoutubeId(playlist.id)
        let targetId: number | null = null
        const match = playlists.find(p => p.name === playlist.title)

        if (match) {
            targetId = match.id
        } else {
            try {
                showToast(`'${playlist.title}' 정보를 저장 중...`, 'success')
                const result = await playlistsApi.importPlaylist({
                    platformPlaylistId: playlist.id,
                    title: playlist.title,
                    description: playlist.description || `Imported from YouTube (${playlist.channelTitle})`,
                    coverImage: playlist.thumbnail,
                    platform: 'YouTube'
                })
                targetId = result.playlist.id
                setYoutubeResults(prev => prev.filter(p => p.id !== playlist.id))
                await fetchPlaylists(true)
            } catch (err: any) {
                if (err.message?.includes('409') || err.response?.status === 409) {
                    const refreshed = await playlistsApi.getPlaylists('EMS')
                    const found = refreshed.playlists.find(p => p.title === playlist.title)
                    if (found) targetId = found.id
                } else {
                    console.error('YouTube import for view failed', err)
                    showToast('상세 보기 실패', 'error')
                    setViewingYoutubeId(null)
                    return
                }
            }
        }
        setViewingYoutubeId(null)
        if (targetId) setSelectedDetailId(targetId)
    }

    // Music search handlers
    const handleSearch = async () => {
        if (!trackSearchTerm.trim()) return
        setIsSearching(true)
        try {
            const results = await itunesService.search(trackSearchTerm)
            setTrackResults(results)
        } catch (err) {
            console.error(err)
            showToast('음악 검색 실패', 'error')
        } finally {
            setIsSearching(false)
        }
    }

    // Cart handlers (DB 연동)
    const addToCart = async (track: ItunesTrack) => {
        if (cartTracks.some(t => t.id === track.id)) {
            showToast('이미 카트에 담긴 곡입니다.', 'error')
            return
        }

        try {
            const response = await cartApi.addToCart({
                trackId: track.id,
                title: track.title,
                artist: track.artist,
                album: track.album || '',
                artwork: track.artwork || '',
                previewUrl: track.previewUrl || track.audio || ''
            })

            if (response.success) {
                setCartTracks(prev => [...prev, track])
                setCartItemIds(prev => new Map(prev).set(track.id, response.cartItemId))
                showToast('카트에 담았습니다.', 'success')
            }
        } catch (err: any) {
            if (err.message?.includes('409') || err.message?.includes('already')) {
                showToast('이미 카트에 담긴 곡입니다.', 'error')
            } else {
                console.error('Failed to add to cart:', err)
                showToast('장바구니 추가 실패', 'error')
            }
        }
    }

    const removeFromCart = async (trackId: number) => {
        const cartItemId = cartItemIds.get(trackId)
        if (!cartItemId) {
            // fallback: 로컬 상태에서만 제거
            setCartTracks(prev => prev.filter(t => t.id !== trackId))
            return
        }

        try {
            await cartApi.removeFromCart(cartItemId)
            setCartTracks(prev => prev.filter(t => t.id !== trackId))
            setCartItemIds(prev => {
                const newMap = new Map(prev)
                newMap.delete(trackId)
                return newMap
            })
        } catch (err) {
            console.error('Failed to remove from cart:', err)
            showToast('장바구니 삭제 실패', 'error')
        }
    }

    // 플레이리스트의 모든 트랙을 장바구니에 추가 (DB 연동)
    const addPlaylistToCart = async (playlistId: number) => {
        try {
            const playlistDetail = await playlistsApi.getById(playlistId) as any
            const tracks = playlistDetail.tracks || []
            if (tracks.length === 0) {
                showToast('플레이리스트에 트랙이 없습니다.', 'error')
                return
            }

            let addedCount = 0
            for (const track of tracks) {
                if (cartTracks.some(t => t.id === track.id)) {
                    continue // 이미 있으면 스킵
                }

                try {
                    const response = await cartApi.addToCart({
                        trackId: track.id,
                        title: track.title,
                        artist: track.artist,
                        album: track.album || '',
                        artwork: track.artwork || '',
                        previewUrl: track.previewUrl || track.audio || ''
                    })

                    if (response.success) {
                        const cartTrack: ItunesTrack = {
                            id: track.id,
                            title: track.title,
                            artist: track.artist,
                            album: track.album || '',
                            artwork: track.artwork || '',
                            audio: track.audio || track.previewUrl || '',
                            url: track.url || '',
                            date: track.date || '',
                            previewUrl: track.previewUrl || track.audio || ''
                        }
                        setCartTracks(prev => [...prev, cartTrack])
                        setCartItemIds(prev => new Map(prev).set(track.id, response.cartItemId))
                        addedCount++
                    }
                } catch (err: any) {
                    // 중복은 무시
                    if (!err.message?.includes('409')) {
                        console.warn('Failed to add track to cart:', track.title)
                    }
                }
            }

            if (addedCount > 0) {
                showToast(`${addedCount}곡을 장바구니에 담았습니다.`, 'success')
                setIsCartOpen(true)
            } else {
                showToast('이미 모든 곡이 장바구니에 있습니다.', 'success')
            }
        } catch (err) {
            console.error('Failed to add playlist to cart:', err)
            showToast('장바구니 추가 실패', 'error')
        }
    }

    const requestAnalysis = async () => {
        if (cartTracks.length === 0) {
            showToast('카트에 트랙이 없습니다.', 'error')
            return
        }

        // Get user's selected model
        const selectedModel = fastapiService.getSelectedModel()

        setIsAnalyzing(true)
        setAnalysisProgress(0)
        setAnalysisMessage('분석 준비 중...')
        setIsCartOpen(false)

        // Progress animation steps
        const progressSteps = [
            { progress: 15, message: '분석 준비 중...' },
            { progress: 35, message: '플레이리스트 생성 중...' },
            { progress: 55, message: `${selectedModel} 모델에 분석 요청 중...` },
            { progress: 75, message: 'AI 추천 결과 대기 중...' },
            { progress: 90, message: 'GMS 플레이리스트 생성 중...' },
        ]

        let stepIndex = 0
        const progressInterval = setInterval(() => {
            if (stepIndex < progressSteps.length) {
                setAnalysisProgress(progressSteps[stepIndex].progress)
                setAnalysisMessage(progressSteps[stepIndex].message)
                stepIndex++
            }
        }, 800)

        // 타임아웃 설정 (60초)
        const timeoutId = setTimeout(() => {
            clearInterval(progressInterval)
            setAnalysisProgress(0)
            setAnalysisMessage('')
            setIsAnalyzing(false)
            showToast('분석 요청 시간 초과 (60초). 다시 시도해주세요.', 'error')
        }, 60000)

        try {
            // Spring Boot analyzeCart가 모든 것을 처리:
            // 1. 장바구니 트랙으로 플레이리스트 생성
            // 2. FastAPI에 분석 요청
            // 3. GMS 플레이리스트 생성
            // 4. 장바구니 비우기
            const result = await cartApi.analyzeCart({ model: selectedModel })

            clearTimeout(timeoutId)
            clearInterval(progressInterval)
            setAnalysisProgress(100)
            setAnalysisMessage('분석 완료! 🎉')

            if (result.success) {
                showToast(`${selectedModel} 모델로 ${result.trackCount || cartTracks.length}곡 분석 완료!`, 'success')

                // 장바구니 비우기 - Spring Boot에서 이미 처리됨
                setCartTracks([])
                setCartItemIds(new Map())

                // GMS 페이지로 이동
                setTimeout(() => {
                    setIsAnalyzing(false)
                    navigate('/music/lab')
                }, 1500)
            } else {
                const errorMsg = result.message || result.error || 'AI 분석 실패'
                showToast(errorMsg, 'error')
                setIsAnalyzing(false)
            }
        } catch (err: any) {
            clearTimeout(timeoutId)
            clearInterval(progressInterval)
            console.error('Analysis request failed:', err)

            // 에러 메시지 상세화
            let errorMessage = '분석 요청 실패'
            if (err.message) {
                errorMessage = err.message
            } else if (err.response?.status === 500) {
                errorMessage = '서버 내부 오류가 발생했습니다.'
            } else if (err.response?.status === 404) {
                errorMessage = 'API 엔드포인트를 찾을 수 없습니다.'
            } else if (!navigator.onLine) {
                errorMessage = '네트워크 연결을 확인해주세요.'
            }

            showToast(errorMessage, 'error')
            setAnalysisProgress(0)
            setAnalysisMessage('')
            setIsAnalyzing(false)
        }
    }

    // 장바구니 전체 비우기
    const clearCart = async () => {
        if (cartTracks.length === 0) return

        try {
            await cartApi.clearCart()
            setCartTracks([])
            setCartItemIds(new Map())
            showToast('장바구니가 비워졌습니다.', 'success')
        } catch (err) {
            console.error('Failed to clear cart:', err)
            showToast('장바구니 비우기 실패', 'error')
        }
    }

    // Collection detail handler
    const handleViewCollectionDetail = async (collection: ItunesCollection) => {
        setIsModalLoading(true)
        setSelectedDetailId(null)
        let targetId: number | null = null
        const match = playlists.find(p => p.name === collection.title)

        if (match) {
            targetId = match.id
        } else {
            try {
                const albumDetails = await itunesService.getAlbum(collection.id)
                const result = await playlistsApi.importAlbumAsPlaylist({
                    title: collection.title,
                    artist: collection.artist,
                    coverImage: collection.artwork,
                    tracks: albumDetails.tracks
                })
                targetId = result.playlist.id
                setRecommendations(prev => prev.filter(r => r.id !== collection.id))
                setClassicRecs(prev => prev.filter(r => r.id !== collection.id))
                setJazzRecs(prev => prev.filter(r => r.id !== collection.id))
                setKpopRecs(prev => prev.filter(r => r.id !== collection.id))
                fetchPlaylists(true)
            } catch (err: any) {
                if (err.message?.includes('409') || err.response?.status === 409) {
                    const refreshed = await playlistsApi.getPlaylists('EMS')
                    const found = refreshed.playlists.find(p => p.title === collection.title)
                    if (found) targetId = found.id
                } else {
                    console.error('Import for view failed', err)
                    showToast('상세 보기 실패', 'error')
                    setIsModalLoading(false)
                    return
                }
            }
        }
        if (targetId) setSelectedDetailId(targetId)
        setIsModalLoading(false)
    }

    // File Upload
    const parseTracksFromFile = (text: string, fileName: string): { title: string, artist: string, album?: string, duration?: number }[] => {
        const ext = fileName.split('.').pop()?.toLowerCase()

        // JSON 파싱
        if (ext === 'json') {
            try {
                const data = JSON.parse(text)
                const items = Array.isArray(data) ? data : (data.tracks || data.items || data.songs || [])
                return items.map((item: any) => ({
                    title: item.title || item.name || item.track || item.trackName || '',
                    artist: item.artist || item.artistName || item.creator || 'Unknown Artist',
                    album: item.album || item.albumName || '',
                    duration: item.duration || item.duration_ms ? Math.round((item.duration_ms || item.duration) / 1000) : 0
                })).filter((t: any) => t.title)
            } catch {
                showToast('JSON 파일 파싱 실패', 'error')
                return []
            }
        }

        // M3U/M3U8 파싱
        if (ext === 'm3u' || ext === 'm3u8') {
            const tracks: { title: string, artist: string, duration?: number }[] = []
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
            let pendingInfo: { title: string, artist: string, duration?: number } | null = null

            lines.forEach(line => {
                if (line.startsWith('#EXTINF:')) {
                    // #EXTINF:duration,Artist - Title
                    const info = line.slice(8)
                    const commaIdx = info.indexOf(',')
                    const duration = commaIdx > 0 ? parseInt(info.slice(0, commaIdx)) : 0
                    const displayName = commaIdx > 0 ? info.slice(commaIdx + 1).trim() : ''
                    if (displayName.includes(' - ')) {
                        const parts = displayName.split(' - ')
                        pendingInfo = { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim(), duration }
                    } else {
                        pendingInfo = { artist: 'Unknown Artist', title: displayName, duration }
                    }
                } else if (!line.startsWith('#') && pendingInfo) {
                    tracks.push(pendingInfo)
                    pendingInfo = null
                } else if (!line.startsWith('#') && line.includes(' - ')) {
                    const parts = line.split(' - ')
                    tracks.push({ artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() })
                }
            })
            if (pendingInfo) tracks.push(pendingInfo)
            return tracks
        }

        // PLS 파싱
        if (ext === 'pls') {
            const lines = text.split('\n').map(l => l.trim())
            const titleMap: Record<string, string> = {}
            const lengthMap: Record<string, number> = {}

            lines.forEach(line => {
                const titleMatch = line.match(/^Title(\d+)=(.+)/i)
                if (titleMatch) titleMap[titleMatch[1]] = titleMatch[2].trim()
                const lenMatch = line.match(/^Length(\d+)=(-?\d+)/i)
                if (lenMatch) lengthMap[lenMatch[1]] = parseInt(lenMatch[2])
            })

            return Object.entries(titleMap).map(([idx, displayName]) => {
                const duration = lengthMap[idx] > 0 ? lengthMap[idx] : 0
                if (displayName.includes(' - ')) {
                    const parts = displayName.split(' - ')
                    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim(), duration }
                }
                return { artist: 'Unknown Artist', title: displayName, duration }
            }).filter(t => t.title)
        }

        // CSV 파싱 (기본)
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
        const tracks: { title: string, artist: string, album?: string }[] = []

        // 헤더 행 감지
        const headerLine = lines[0]?.toLowerCase() || ''
        const startIdx = (headerLine.includes('track') || headerLine.includes('title') || headerLine.includes('artist')) ? 1 : 0
        const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
        const titleIdx = headers.indexOf('track name') !== -1 ? headers.indexOf('track name')
            : headers.indexOf('title') !== -1 ? headers.indexOf('title')
            : headers.indexOf('name') !== -1 ? headers.indexOf('name') : 0
        const artistIdx = headers.indexOf('artist name') !== -1 ? headers.indexOf('artist name')
            : headers.indexOf('artist') !== -1 ? headers.indexOf('artist') : 1
        const albumIdx = headers.indexOf('album name') !== -1 ? headers.indexOf('album name')
            : headers.indexOf('album') !== -1 ? headers.indexOf('album') : -1

        lines.slice(startIdx).forEach(line => {
            if (!line) return
            const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
            let title = cols[titleIdx] || ''
            let artist = cols[artistIdx] || 'Unknown Artist'
            const album = albumIdx >= 0 ? cols[albumIdx] || '' : ''

            // CSV 헤더가 없는 경우 "Artist - Title" 형식 시도
            if (!title && line.includes(' - ')) {
                const parts = line.split(' - ')
                artist = parts[0].trim()
                title = parts.slice(1).join(' - ').trim()
            }
            if (title) tracks.push({ title, artist, album })
        })
        return tracks
    }

    const enrichUploadedTracks = async (trackIds: number[]) => {
        if (trackIds.length === 0) return
        try {
            const res = await fetch('/api/enrich-tracks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track_ids: trackIds })
            })
            if (res.ok) {
                const data = await res.json()
                if (data.enriched_count > 0) {
                    showToast(`오디오 특성 추론 완료 (${data.enriched_count}곡)`, 'success')
                }
            }
        } catch (err) {
            console.warn('Audio feature enrichment failed:', err)
        }
    }

    const handleFileUpload = async (files: FileList) => {
        console.log('[handleFileUpload] called, files:', files.length, Array.from(files).map(f => f.name))
        if (files.length === 0) {
            console.warn('[handleFileUpload] files.length is 0, returning')
            return
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const reader = new FileReader()

            reader.onload = async (e) => {
                console.log('[handleFileUpload] reader.onload fired for:', file.name, 'result length:', (e.target?.result as string)?.length)
                const text = e.target?.result as string
                if (!text) {
                    console.warn('[handleFileUpload] text is empty for:', file.name)
                    return
                }

                const tracksToImport = parseTracksFromFile(text, file.name)

                if (tracksToImport.length === 0) {
                    showToast(`'${file.name}': 트랙을 찾을 수 없습니다.`, 'error')
                    return
                }

                try {
                    const playlistName = file.name.replace(/\.[^/.]+$/, "")
                    showToast(`'${playlistName}' (${tracksToImport.length}곡) 저장 중...`, 'info')

                    const createResult = await playlistsApi.create({
                        title: playlistName,
                        description: `Imported from file: ${file.name}`,
                        sourceType: 'Upload',
                        spaceType: 'GMS',
                        status: 'PTP'
                    })

                    let successCount = 0
                    const addedTrackIds: number[] = []
                    for (const track of tracksToImport) {
                        try {
                            const result = await playlistsApi.addTrack(createResult.id, {
                                title: track.title,
                                artist: track.artist,
                                album: track.album || 'Imported',
                                duration: track.duration || 0
                            })
                            if (result?.trackId) addedTrackIds.push(result.trackId)
                            successCount++
                        } catch (err) { console.warn('Failed to add track:', track, err) }
                    }

                    showToast(`'${playlistName}' 완료 (${successCount}/${tracksToImport.length}곡) — 오디오 특성 추론 중...`, 'success')
                    fetchPlaylists(true)

                    // 오디오 특성 추론 (백그라운드)
                    enrichUploadedTracks(addedTrackIds)
                } catch (err) {
                    console.error('File import failed:', err)
                    showToast(`'${file.name}' 가져오기 실패`, 'error')
                }
            }
            reader.readAsText(file)
        }
    }

    return (
        <div className="p-4 md:p-6">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-hud-accent-warning mb-2">The Cargo</h1>
                <p className="text-hud-text-secondary mb-6">외부에서 가져온 검증되지 않은 플레이리스트를 수집하고 관리합니다</p>

                <div className="flex gap-3">
                    <button
                        onClick={() => document.getElementById('fileInput')?.click()}
                        className="bg-hud-accent-warning text-hud-bg-primary px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-hud-accent-warning/90 transition-all">
                        <LinkIcon className="w-4 h-4" />
                        Upload Files
                    </button>
                </div>
            </header>

            <UploadZone onFilesSelected={handleFileUpload} />

            {/* File Upload Guide */}
            <div className="hud-card hud-card-bottom rounded-xl p-5 mb-6 mt-4">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-hud-accent-primary/15 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-5 h-5 text-hud-accent-primary" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-semibold text-hud-text-primary mb-1">파일 업로드 → GMS 자동 등록</h3>
                        <p className="text-sm text-hud-text-secondary leading-relaxed">
                            업로드한 파일의 트랙은 <span className="text-hud-accent-primary font-medium">GMS (AI 추천 공간)</span>에 바로 저장됩니다.
                            저장 완료 후 AI가 각 곡의 오디오 특성(댄서빌리티·에너지·템포 등 9가지)을 자동으로 추론하여 채워넣습니다.
                        </p>
                        <div className="flex flex-wrap gap-3 mt-3">
                            <span className="text-xs bg-hud-bg-secondary border border-hud-border-secondary text-hud-text-muted px-2.5 py-1 rounded-full">CSV — 헤더 자동 감지</span>
                            <span className="text-xs bg-hud-bg-secondary border border-hud-border-secondary text-hud-text-muted px-2.5 py-1 rounded-full">JSON — tracks / items / songs 배열</span>
                            <span className="text-xs bg-hud-bg-secondary border border-hud-border-secondary text-hud-text-muted px-2.5 py-1 rounded-full">M3U — #EXTINF 태그 파싱</span>
                            <span className="text-xs bg-hud-bg-secondary border border-hud-border-secondary text-hud-text-muted px-2.5 py-1 rounded-full">PLS — Title / Length 키 파싱</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Analysis Progress Overlay */}
            {isAnalyzing && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center">
                    <div className="bg-hud-bg-secondary border border-hud-border-secondary rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-hud-accent-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Sparkles className="w-8 h-8 text-hud-accent-primary animate-pulse" />
                            </div>
                            <h3 className="text-xl font-bold text-hud-text-primary mb-2">AI 분석 진행 중</h3>
                            <p className="text-hud-text-secondary text-sm">{analysisMessage}</p>
                        </div>

                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-hud-accent-primary">{analysisMessage}</span>
                                <span className="text-sm text-hud-text-muted">{analysisProgress}%</span>
                            </div>
                            <div className="h-3 bg-hud-bg-primary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-hud-accent-primary to-hud-accent-warning transition-all duration-500 ease-out"
                                    style={{ width: `${analysisProgress}%` }}
                                />
                            </div>
                        </div>

                        <p className="text-center text-xs text-hud-text-muted">
                            분석이 완료되면 자동으로 GMS 페이지로 이동합니다
                        </p>
                    </div>
                </div>
            )}

            {/* New Releases */}
            {newReleases.songs.length > 0 && (
                <section className="hud-card hud-card-bottom rounded-xl p-6 mb-6">
                    <h2 className="text-xl font-bold text-hud-text-primary flex items-center gap-3 mb-6">
                        <Sparkles className="w-5 h-5 text-pink-500" />
                        최신 인기 차트 (Apple Music Top 40)
                        <span className="text-sm font-normal text-hud-text-muted ml-2">(KR Store Real-time)</span>
                    </h2>
                    <div className="flex overflow-x-auto gap-4 pb-4 custom-scrollbar">
                        {newReleases.songs.map((song) => {
                            const artworkUrl = song.attributes.artwork?.url.replace('{w}', '300').replace('{h}', '300').replace('{c}', 'bb').replace('{f}', 'jpg')
                            return (
                                <div key={song.id} className="min-w-[160px] w-[160px] bg-hud-bg-secondary border border-hud-border-secondary rounded-lg p-3 hover:border-pink-500/50 transition-all group">
                                    <div className="relative aspect-square mb-3 rounded-md overflow-hidden">
                                        <img src={artworkUrl} alt={song.attributes.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <FavoriteButton
                                                track={{
                                                    title: song.attributes.name,
                                                    artist: song.attributes.artistName || 'Unknown',
                                                    album: song.attributes.name,
                                                    artwork: artworkUrl,
                                                    audio: (song.attributes.previews && song.attributes.previews[0]) ? song.attributes.previews[0].url : ''
                                                }}
                                                size="sm"
                                                className="bg-black/50 hover:bg-hud-accent-danger/30"
                                            />
                                            <button
                                                onClick={() => playTrack({
                                                    id: parseInt(song.id),
                                                    title: song.attributes.name,
                                                    artist: song.attributes.artistName || 'Unknown',
                                                    album: song.attributes.name,
                                                    duration: 0,
                                                    orderIndex: 0,
                                                    artwork: artworkUrl,
                                                    externalMetadata: {
                                                        previewUrl: (song.attributes.previews && song.attributes.previews[0]) ? song.attributes.previews[0].url : undefined
                                                    }
                                                })}
                                                className="bg-white text-black p-2 rounded-full transform translate-y-2 group-hover:translate-y-0 transition-all hover:scale-110"
                                                title="재생"
                                            >
                                                <Play className="w-5 h-5" fill="currentColor" />
                                            </button>
                                            <button
                                                onClick={() => addToCart({
                                                    id: parseInt(song.id),
                                                    title: song.attributes.name,
                                                    artist: song.attributes.artistName || 'Unknown',
                                                    album: song.attributes.name,
                                                    artwork: artworkUrl || '',
                                                    url: song.attributes.url,
                                                    date: song.attributes.releaseDate || '',
                                                    audio: '',
                                                    previewUrl: (song.attributes.previews && song.attributes.previews[0]) ? song.attributes.previews[0].url : undefined
                                                })}
                                                className="bg-pink-500 text-white p-2 rounded-full transform translate-y-2 group-hover:translate-y-0 transition-all hover:bg-pink-600"
                                                title="카트에 담기"
                                            >
                                                <Plus className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="font-bold text-hud-text-primary truncate text-sm" title={song.attributes.name}>{song.attributes.name}</div>
                                    <div className="text-xs text-hud-text-secondary truncate">{song.attributes.artistName}</div>
                                </div>
                            )
                        })}
                    </div>
                </section>
            )}

            {/* Spotify Special */}
            <EMSPlatformBest
                spotifySpecial={spotifySpecial}
                onSelectPlaylist={setSelectedDetailId}
                onPlayTrack={handlePlaySpotifyTrack}
            />

            {/* Recommendations */}
            <EMSRecommendations
                recommendations={recommendations}
                classicRecs={classicRecs}
                jazzRecs={jazzRecs}
                kpopRecs={kpopRecs}
                onViewDetail={handleViewCollectionDetail}
            />

            {/* YouTube Search */}
            <EMSYoutubePick
                youtubeConnected={youtubeConnected}
                youtubeSearchTerm={youtubeSearchTerm}
                setYoutubeSearchTerm={setYoutubeSearchTerm}
                youtubeResults={youtubeResults}
                isYoutubeSearching={isYoutubeSearching}
                viewingYoutubeId={viewingYoutubeId}
                onSearch={handleYoutubeSearch}
                onViewDetail={handleViewYoutubeDetail}
            />

            {/* Music Search */}
            <EMSMusicSearch
                trackSearchTerm={trackSearchTerm}
                setTrackSearchTerm={setTrackSearchTerm}
                trackResults={trackResults}
                isSearching={isSearching}
                onSearch={handleSearch}
                onAddToCart={addToCart}
            />

            {/* Playlist Table */}
            {/* <EMSPlaylistTable
                playlists={playlists}
                selectedIds={selectedIds}
                searchTerm={searchTerm}
                onSelectAll={handleSelectAll}
                onSelectRow={handleSelectRow}
                onViewDetail={setSelectedDetailId}
                onAddToCart={addPlaylistToCart}
            /> */}

            {/* Cart Drawer */}
            <EMSCartDrawer
                cartTracks={cartTracks}
                isCartOpen={isCartOpen}
                setIsCartOpen={setIsCartOpen}
                onRemoveFromCart={removeFromCart}
                onClearCart={clearCart}
                onSaveToPlaylist={requestAnalysis}
            />

            {/* Modals */}
            {(selectedDetailId || isModalLoading) && (
                <PlaylistDetailModal
                    playlistId={selectedDetailId}
                    isOpen={true}
                    onClose={() => {
                        setSelectedDetailId(null)
                        setIsModalLoading(false)
                    }}
                    onAddToCart={(track) => {
                        // Track을 ItunesTrack 형식으로 변환하여 장바구니에 추가
                        // externalMetadata가 string인 경우 파싱
                        let previewUrl = ''
                        if (track.externalMetadata) {
                            if (typeof track.externalMetadata === 'string') {
                                try {
                                    const parsed = JSON.parse(track.externalMetadata)
                                    previewUrl = parsed.previewUrl || ''
                                } catch { /* ignore */ }
                            } else {
                                previewUrl = track.externalMetadata.previewUrl || ''
                            }
                        }
                        const cartTrack: ItunesTrack = {
                            id: track.id,
                            title: track.title,
                            artist: track.artist,
                            album: track.album || '',
                            artwork: track.artwork || '',
                            audio: '',
                            url: '',
                            date: '',
                            previewUrl
                        }
                        addToCart(cartTrack)
                    }}
                    cartTrackIds={new Set(cartTracks.map(t => t.id))}
                />
            )}

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border transition-all duration-300 max-w-sm
                    ${toast.type === 'success' ? 'bg-hud-bg-secondary border-green-500/40 text-green-400' :
                      toast.type === 'error' ? 'bg-hud-bg-secondary border-red-500/40 text-red-400' :
                      'bg-hud-bg-secondary border-hud-accent-primary/40 text-hud-accent-primary'}`}>
                    <span className="text-lg">
                        {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
                    </span>
                    <span className="text-sm font-medium text-hud-text-primary">{toast.message}</span>
                </div>
            )}
        </div>
    )
}

export default ExternalMusicSpace
