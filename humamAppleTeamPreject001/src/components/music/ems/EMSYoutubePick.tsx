import { Search, Loader2, Eye } from 'lucide-react'
import { YoutubePlaylist } from '../../../services/api/youtube'

interface EMSYoutubePickProps {
    youtubeConnected: boolean
    youtubeSearchTerm: string
    setYoutubeSearchTerm: (term: string) => void
    youtubeResults: YoutubePlaylist[]
    isYoutubeSearching: boolean
    viewingYoutubeId: string | null
    onSearch: () => void
    onViewDetail: (playlist: YoutubePlaylist) => void
}

const EMSYoutubePick = ({
    youtubeConnected,
    youtubeSearchTerm,
    setYoutubeSearchTerm,
    youtubeResults,
    isYoutubeSearching,
    viewingYoutubeId,
    onSearch,
    onViewDetail
}: EMSYoutubePickProps) => {
    if (!youtubeConnected) return null

    return (
        <section className="hud-card hud-card-bottom rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-hud-text-primary flex items-center gap-3 mb-6">
                <Search className="w-5 h-5 text-red-500" />
                YouTube 플레이리스트 검색
            </h2>
            <div className="flex gap-2 mb-6">
                <input
                    type="text"
                    placeholder="플레이리스트 검색 (예: K-Pop, 운동 음악)"
                    value={youtubeSearchTerm}
                    onChange={(e) => setYoutubeSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                    className="flex-1 px-4 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-red-500 placeholder-hud-text-muted"
                />
                <button onClick={onSearch} disabled={isYoutubeSearching} className="bg-red-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-600 transition-all flex items-center gap-2">
                    {isYoutubeSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} 검색
                </button>
            </div>
            {youtubeResults.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {youtubeResults.map((playlist) => (
                        <div
                            key={playlist.id}
                            className="bg-hud-bg-secondary border border-hud-border-secondary rounded-lg overflow-hidden group hover:border-red-500/50 transition-all cursor-pointer"
                            onClick={() => onViewDetail(playlist)}
                        >
                            <div className="relative aspect-video">
                                <img src={playlist.thumbnail || ''} alt={playlist.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                    {viewingYoutubeId === playlist.id ? (
                                        <div className="flex items-center gap-2 text-white">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span className="font-bold">로딩 중...</span>
                                        </div>
                                    ) : (
                                        <button className="bg-white text-red-600 px-4 py-2 rounded-full font-bold flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-all hover:bg-gray-100">
                                            <Eye className="w-4 h-4" />
                                            상세보기
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="p-3">
                                <div className="font-bold text-hud-text-primary truncate" title={playlist.title}>{playlist.title}</div>
                                <div className="text-sm text-hud-text-secondary truncate">{playlist.channelTitle}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}

export default EMSYoutubePick
