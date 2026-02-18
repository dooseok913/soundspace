import { Brain, Music2, ExternalLink, Eye } from 'lucide-react'
import { ItunesCollection } from '../../../services/api/itunes'

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

interface EMSRecommendationsProps {
    recommendations: ItunesCollection[]
    classicRecs: ItunesCollection[]
    jazzRecs: ItunesCollection[]
    kpopRecs: ItunesCollection[]
    onViewDetail: (collection: ItunesCollection) => void
}

const EMSRecommendations = ({
    recommendations,
    classicRecs,
    jazzRecs,
    kpopRecs,
    onViewDetail
}: EMSRecommendationsProps) => {
    const sections = [
        { title: '오늘의 추천 믹스 (Auto Discovery)', data: recommendations, icon: <Brain className="w-5 h-5 text-hud-accent-primary" /> },
        { title: 'Classical Essentials', data: classicRecs, icon: <Brain className="w-5 h-5 text-hud-accent-warning" /> },
        { title: 'Vocal Jazz Collection', data: jazzRecs, icon: <Music2 className="w-5 h-5 text-hud-accent-info" /> },
        { title: 'K-Pop Trends', data: kpopRecs, icon: <ExternalLink className="w-5 h-5 text-hud-accent-success" /> }
    ]

    return (
        <>
            {sections.map((section, idx) => section.data.length > 0 && (
                <section key={idx} className="hud-card hud-card-bottom rounded-xl p-6 mb-6 mt-6">
                    <h2 className="text-xl font-bold text-hud-text-primary flex items-center gap-3 mb-6">
                        {section.icon}
                        {section.title}
                        <span className="text-sm font-normal text-hud-text-muted ml-2">(iTunes Auto Discovery)</span>
                    </h2>
                    <div className="flex overflow-x-auto gap-4 pb-4 custom-scrollbar">
                        {section.data.map((album) => (
                            <div
                                key={album.id}
                                className="min-w-[200px] w-[200px] bg-hud-bg-secondary border border-hud-border-secondary rounded-lg p-3 hover:border-hud-accent-warning/50 transition-all flex flex-col group cursor-pointer"
                                onClick={() => onViewDetail(album)}
                            >
                                <div className="relative aspect-square mb-3 rounded-md overflow-hidden bg-hud-bg-primary">
                                    {fixImageUrl(album.artwork) ? (
                                        <img
                                            src={fixImageUrl(album.artwork)}
                                            alt={album.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 absolute inset-0"
                                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                                        />
                                    ) : null}
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Music2 className="w-12 h-12 text-hud-text-muted" />
                                    </div>
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                        <button
                                            className="bg-hud-accent-primary text-hud-bg-primary px-4 py-2 rounded-full font-bold flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-all hover:bg-hud-accent-primary/90"
                                        >
                                            <Eye className="w-4 h-4" />
                                            상세보기
                                        </button>
                                    </div>
                                </div>
                                <div className="font-bold text-hud-text-primary truncate" title={album.title}>{album.title}</div>
                                <div className="text-sm text-hud-text-secondary truncate">{album.artist}</div>
                                <div className="text-xs text-hud-text-muted mt-1 flex justify-between">
                                    <span>{album.genre}</span>
                                    <span>{album.count}곡</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </>
    )
}

export default EMSRecommendations
