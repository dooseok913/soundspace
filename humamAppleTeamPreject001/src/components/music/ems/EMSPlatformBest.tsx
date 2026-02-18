import { Disc3, TrendingUp, Headphones, Play } from 'lucide-react'

// Fix image URL helper
const fixImageUrl = (url?: string, size: number = 300): string | undefined => {
    if (!url || typeof url !== 'string') return undefined
    try {
        let fixed = url
            .replace(/{w}/g, String(size))
            .replace(/{h}/g, String(size))
            .replace(/{c}/g, 'bb')
            .replace(/{f}/g, 'jpg')
        fixed = fixed.replace(/\/images\/\/images\//g, '/images/')
        fixed = fixed.replace(/([^:])\/\/+/g, '$1/')
        return fixed
    } catch {
        return undefined
    }
}

interface SpotifySpecialData {
    event: { title: string; subtitle: string; description: string }
    stats: { totalPlaylists: number; totalTracks: number; hotTracks: number }
    categories: Record<string, any[]>
    hotTracks: any[]
    playlists: any[]
}

interface EMSPlatformBestProps {
    spotifySpecial: SpotifySpecialData | null
    onSelectPlaylist: (playlistId: number) => void
    onPlayTrack?: (track: any) => void
}

const EMSPlatformBest = ({ spotifySpecial, onSelectPlaylist, onPlayTrack }: EMSPlatformBestProps) => {
    if (!spotifySpecial || !spotifySpecial.playlists || spotifySpecial.playlists.length === 0) {
        return null
    }

    const handlePlayTrack = (track: any) => {
        if (onPlayTrack) {
            onPlayTrack(track)
        }
    }

    return (
        <section className="hud-card hud-card-bottom rounded-xl p-6 mb-6 border-2 border-green-500/30 bg-gradient-to-br from-hud-bg-secondary to-green-900/10">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-hud-text-primary flex items-center gap-3">
                        <Disc3 className="w-6 h-6 text-green-500 animate-spin" style={{ animationDuration: '3s' }} />
                        {spotifySpecial.event?.title || 'Special Event'}
                    </h2>
                    <p className="text-hud-text-secondary mt-1">{spotifySpecial.event?.subtitle || 'Featured Playlists'}</p>
                </div>
                <div className="flex gap-4 text-sm">
                    <div className="text-center px-4 py-2 bg-green-500/10 rounded-lg border border-green-500/30">
                        <div className="text-2xl font-bold text-green-400">{spotifySpecial.stats?.totalPlaylists || 0}</div>
                        <div className="text-hud-text-muted text-xs">플레이리스트</div>
                    </div>
                    <div className="text-center px-4 py-2 bg-green-500/10 rounded-lg border border-green-500/30">
                        <div className="text-2xl font-bold text-green-400">{spotifySpecial.stats?.totalTracks || 0}</div>
                        <div className="text-hud-text-muted text-xs">트랙</div>
                    </div>
                </div>
            </div>

            {/* Hot Tracks */}
            {spotifySpecial.hotTracks && spotifySpecial.hotTracks.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-lg font-bold text-hud-text-primary flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-orange-500" />
                        인기 트랙 TOP 10
                    </h3>
                    <div className="flex overflow-x-auto gap-3 pb-4 custom-scrollbar">
                        {spotifySpecial.hotTracks.map((track: any, idx: number) => (
                            <div
                                key={track.trackId}
                                onClick={() => handlePlayTrack(track)}
                                className="min-w-[140px] w-[140px] bg-hud-bg-secondary border border-hud-border-secondary rounded-lg p-3 hover:border-green-500/50 transition-all group relative cursor-pointer"
                            >
                                <div className="absolute -top-2 -left-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold text-white z-10">
                                    {idx + 1}
                                </div>
                                <div className="aspect-square mb-2 rounded-md overflow-hidden bg-gradient-to-br from-green-900/50 to-hud-bg-primary relative">
                                    {fixImageUrl(track.artwork) ? (
                                        <img
                                            src={fixImageUrl(track.artwork)}
                                            alt={track.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 absolute inset-0"
                                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                                        />
                                    ) : null}
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Headphones className="w-10 h-10 text-green-500/50" />
                                    </div>
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="bg-green-500 text-white p-3 rounded-full transform scale-90 group-hover:scale-100 transition-all">
                                            <Play className="w-5 h-5 fill-current" />
                                        </div>
                                    </div>
                                </div>
                                <div className="font-bold text-hud-text-primary truncate text-sm" title={track.title}>{track.title}</div>
                                <div className="text-xs text-hud-text-secondary truncate">{track.artist}</div>
                                {track.popularity && (
                                    <div className="mt-1 flex items-center gap-1">
                                        <div className="h-1 flex-1 bg-hud-bg-primary rounded-full overflow-hidden">
                                            <div className="h-full bg-green-500" style={{ width: `${track.popularity}%` }}></div>
                                        </div>
                                        <span className="text-[10px] text-green-400">{track.popularity}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Categories */}
            {spotifySpecial.categories && Object.keys(spotifySpecial.categories).length > 0 && (
                <div>
                    <h3 className="text-lg font-bold text-hud-text-primary flex items-center gap-2 mb-4">
                        <Disc3 className="w-5 h-5 text-green-500" />
                        카테고리별 플레이리스트
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {Object.entries(spotifySpecial.categories).map(([category, categoryPlaylists]: [string, any[]]) => (
                            <div key={category} className="bg-hud-bg-primary/50 rounded-lg p-4 border border-hud-border-secondary">
                                <h4 className="font-bold text-green-400 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                    {category}
                                    <span className="text-xs text-hud-text-muted font-normal">({categoryPlaylists.length})</span>
                                </h4>
                                <div className="flex overflow-x-auto gap-3 pb-2 custom-scrollbar">
                                    {categoryPlaylists.map((playlist: any) => (
                                        <div
                                            key={playlist.playlistId}
                                            onClick={() => onSelectPlaylist(playlist.playlistId)}
                                            className="min-w-[180px] w-[180px] bg-hud-bg-secondary border border-hud-border-secondary rounded-lg overflow-hidden hover:border-green-500/50 transition-all cursor-pointer group"
                                        >
                                            <div className="aspect-square relative bg-gradient-to-br from-green-900/50 to-hud-bg-primary">
                                                {fixImageUrl(playlist.coverImage) ? (
                                                    <img
                                                        src={fixImageUrl(playlist.coverImage)}
                                                        alt={playlist.title}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 absolute inset-0"
                                                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                                                    />
                                                ) : null}
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Disc3 className="w-16 h-16 text-green-500/30" />
                                                </div>
                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">상세보기</span>
                                                </div>
                                            </div>
                                            <div className="p-3">
                                                <div className="font-bold text-hud-text-primary truncate text-sm" title={playlist.title}>{playlist.title}</div>
                                                <div className="text-xs text-hud-text-muted mt-1">{playlist.trackCount || 0}곡</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    )
}

export default EMSPlatformBest
