import { Play, Sparkles, Music } from 'lucide-react'
import { KukaTrackInfo } from '../../../services/api/kukaApi'
import FavoriteButton from '../FavoriteButton'

interface LLMRecommendListProps {
    recommendations: KukaTrackInfo[]
    explanation?: string
    onPlayTrack: (track: KukaTrackInfo, index: number) => void
    currentPlayingIndex?: number
}

const LLMRecommendList = ({
    recommendations,
    explanation,
    onPlayTrack,
    currentPlayingIndex
}: LLMRecommendListProps) => {
    if (recommendations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-8 px-4">
                <div className="w-16 h-16 rounded-full bg-hud-accent-primary/10 flex items-center justify-center mb-3">
                    <Music className="w-8 h-8 text-hud-accent-primary/50" />
                </div>
                <p className="text-sm text-hud-text-muted text-center">
                    아티스트나 곡을 검색해서<br />
                    AI 추천을 받아보세요!
                </p>
            </div>
        )
    }

    return (
        <div className="p-3 space-y-2">
            {/* AI Explanation - Compact */}
            {explanation && (
                <div className="p-3 bg-gradient-to-r from-hud-accent-primary/10 to-hud-accent-info/10
                                border border-hud-accent-primary/20 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-hud-accent-primary" />
                        <span className="font-medium text-hud-text-primary text-xs">AI 추천 이유</span>
                    </div>
                    <p className="text-xs text-hud-text-secondary leading-relaxed whitespace-pre-line">
                        {explanation}
                    </p>
                </div>
            )}

            {/* Track List - Compact */}
            <div className="space-y-1.5">
                {recommendations.map((track, index) => (
                    <div
                        key={`${track.track_name}-${track.artists}-${index}`}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer
                                    hover:border-hud-accent-primary/50 hover:bg-hud-accent-primary/5
                                    ${currentPlayingIndex === index
                                        ? 'bg-hud-accent-primary/10 border-hud-accent-primary/50'
                                        : 'bg-hud-bg-secondary border-hud-border-secondary'
                                    }`}
                        onClick={() => onPlayTrack(track, index)}
                    >
                        {/* Rank Badge */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs
                                        ${currentPlayingIndex === index
                                            ? 'bg-hud-accent-primary text-white'
                                            : 'bg-hud-accent-primary/20 text-hud-accent-primary'
                                        }`}>
                            {currentPlayingIndex === index ? (
                                <Play className="w-3 h-3 ml-0.5" fill="currentColor" />
                            ) : (
                                <span className="font-bold">{track.rank}</span>
                            )}
                        </div>

                        {/* Track Info */}
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${currentPlayingIndex === index
                                ? 'text-hud-accent-primary'
                                : 'text-hud-text-primary'
                            }`}>
                                {track.track_name}
                            </p>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-hud-text-secondary truncate">
                                    {track.artists}
                                </p>
                                {/* Genre Tags - Inline */}
                                {track.genres && track.genres.length > 0 && (
                                    <div className="hidden sm:flex gap-1">
                                        {track.genres.slice(0, 2).map((genre, i) => (
                                            <span
                                                key={i}
                                                className="text-[9px] px-1.5 py-0.5 bg-hud-accent-info/20
                                                           text-hud-accent-info rounded"
                                            >
                                                {genre}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Similarity Score */}
                        <div className="text-[10px] text-hud-text-muted shrink-0">
                            {(track.similarity * 100).toFixed(0)}%
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onPlayTrack(track, index)
                                }}
                                className="p-1.5 rounded-full bg-hud-accent-primary/10
                                           hover:bg-hud-accent-primary text-hud-accent-primary
                                           hover:text-white transition-colors"
                            >
                                <Play className="w-3.5 h-3.5" fill="currentColor" />
                            </button>
                            <FavoriteButton
                                track={{
                                    title: track.track_name,
                                    artist: track.artists
                                }}
                                size="sm"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default LLMRecommendList
