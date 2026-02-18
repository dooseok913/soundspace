import { Search, Loader2, Music2, Plus } from 'lucide-react'
import { ItunesTrack } from '../../../services/api/itunes'
import FavoriteButton from '../FavoriteButton'

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

interface EMSMusicSearchProps {
    trackSearchTerm: string
    setTrackSearchTerm: (term: string) => void
    trackResults: ItunesTrack[]
    isSearching: boolean
    onSearch: () => void
    onAddToCart: (track: ItunesTrack) => void
}

const EMSMusicSearch = ({
    trackSearchTerm,
    setTrackSearchTerm,
    trackResults,
    isSearching,
    onSearch,
    onAddToCart
}: EMSMusicSearchProps) => {
    return (
        <section className="hud-card hud-card-bottom rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-hud-text-primary flex items-center gap-3 mb-6">
                <Search className="w-5 h-5 text-hud-accent-info" />
                Apple Music 카탈로그 검색
                <span className="text-sm font-normal text-hud-text-muted ml-2">(iTunes DB 기반 고음질 메타데이터 검색)</span>
            </h2>
            <div className="flex gap-2 mb-6">
                <input
                    id="music-search-input"
                    type="text"
                    placeholder="곡, 아티스트, 앨범 검색 (예: NewJeans)"
                    value={trackSearchTerm}
                    onChange={(e) => setTrackSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                    className="flex-1 px-4 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-info placeholder-hud-text-muted"
                />
                <button onClick={onSearch} disabled={isSearching} className="bg-hud-accent-info text-white px-6 py-2 rounded-lg font-semibold hover:bg-hud-accent-info/90 transition-all flex items-center gap-2">
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} 검색
                </button>
            </div>
            {trackResults.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {trackResults.map((track) => (
                        <div key={track.id} className="flex items-center gap-3 p-3 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg hover:border-hud-accent-info/50 transition-all">
                            <div className="w-12 h-12 rounded bg-hud-bg-primary flex items-center justify-center relative overflow-hidden shrink-0">
                                {fixImageUrl(track.artwork) && (
                                    <img
                                        src={fixImageUrl(track.artwork)}
                                        alt={track.title}
                                        className="w-full h-full object-cover absolute inset-0"
                                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                                    />
                                )}
                                <Music2 className="w-6 h-6 text-hud-text-muted" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-hud-text-primary truncate">{track.title}</div>
                                <div className="text-sm text-hud-text-secondary truncate">{track.artist}</div>
                                <div className="text-xs text-hud-text-muted truncate flex items-center gap-2">
                                    {track.album}
                                    {track.previewUrl && (
                                        <span className="text-hud-accent-info flex items-center gap-0.5 text-[10px] border border-hud-accent-info/30 px-1 rounded">
                                            <Music2 className="w-2 h-2" /> 30s
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <FavoriteButton
                                    track={{
                                        title: track.title,
                                        artist: track.artist,
                                        album: track.album,
                                        artwork: fixImageUrl(track.artwork),
                                        audio: track.previewUrl
                                    }}
                                    size="sm"
                                />
                                <button
                                    onClick={() => onAddToCart(track)}
                                    className="p-2 text-hud-accent-primary hover:bg-hud-accent-primary/10 rounded-lg transition-colors"
                                    title="카트에 담기"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}

export default EMSMusicSearch
