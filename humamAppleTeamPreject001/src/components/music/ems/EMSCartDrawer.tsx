import { ShoppingBag, X, Brain, Trash2, Music2, RotateCcw } from 'lucide-react'
import { ItunesTrack } from '../../../services/api/itunes'

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

interface EMSCartDrawerProps {
    cartTracks: ItunesTrack[]
    isCartOpen: boolean
    setIsCartOpen: (open: boolean) => void
    onRemoveFromCart: (trackId: number) => void
    onClearCart: () => void
    onSaveToPlaylist: () => void
}

const EMSCartDrawer = ({
    cartTracks,
    isCartOpen,
    setIsCartOpen,
    onRemoveFromCart,
    onClearCart,
    onSaveToPlaylist
}: EMSCartDrawerProps) => {
    return (
        <>
            {/* Floating Cart Button - 플레이어 위로 위치 (bottom-28 = 112px) */}
            <div className="fixed bottom-28 right-8 z-50">
                <button
                    onClick={() => setIsCartOpen(!isCartOpen)}
                    className="relative bg-hud-accent-primary text-hud-bg-primary p-4 rounded-full shadow-lg hover:scale-110 transition-transform btn-glow"
                >
                    <ShoppingBag className="w-6 h-6" />
                    {cartTracks.length > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-hud-bg-primary">
                            {cartTracks.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Cart Drawer - 플레이어 높이(약 96px)를 고려하여 하단 여백 추가 */}
            {isCartOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-hud-bg-secondary border-l border-hud-border-secondary shadow-2xl flex flex-col h-[calc(100%-96px)] mt-0 animate-in slide-in-from-right duration-300">
                        <div className="p-4 border-b border-hud-border-secondary flex items-center justify-between">
                            <h3 className="text-lg font-bold text-hud-text-primary flex items-center gap-2">
                                <ShoppingBag className="w-5 h-5 text-hud-accent-primary" />
                                EMS 트랙 카트
                                <span className="text-sm font-normal text-hud-text-muted">({cartTracks.length})</span>
                            </h3>
                            <button onClick={() => setIsCartOpen(false)} className="text-hud-text-secondary hover:text-hud-text-primary">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {cartTracks.length === 0 ? (
                                <div className="text-center py-10 text-hud-text-muted">
                                    <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>카트가 비어있습니다.</p>
                                    <p className="text-xs mt-1">검색 결과에서 + 버튼을 눌러 추가하세요.</p>
                                </div>
                            ) : (
                                cartTracks.map((track, idx) => (
                                    <div key={`${track.id}-${idx}`} className="flex items-center gap-3 p-3 bg-hud-bg-primary rounded-lg border border-hud-border-secondary">
                                        <div className="w-10 h-10 rounded bg-hud-bg-secondary flex items-center justify-center relative overflow-hidden shrink-0">
                                            {fixImageUrl(track.artwork) && (
                                                <img
                                                    src={fixImageUrl(track.artwork)}
                                                    alt={track.title}
                                                    className="w-full h-full object-cover absolute inset-0"
                                                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                                                />
                                            )}
                                            <Music2 className="w-5 h-5 text-hud-text-muted" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-hud-text-primary truncate">{track.title}</div>
                                            <div className="text-xs text-hud-text-secondary truncate">{track.artist}</div>
                                        </div>
                                        <button
                                            onClick={() => onRemoveFromCart(track.id)}
                                            className="text-hud-text-muted hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-hud-border-secondary bg-hud-bg-primary space-y-2">
                            <button
                                onClick={onSaveToPlaylist}
                                disabled={cartTracks.length === 0}
                                className="w-full bg-hud-accent-primary text-hud-bg-primary py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-hud-accent-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Brain className="w-5 h-5" />
                                분석 요청
                            </button>
                            <button
                                onClick={onClearCart}
                                disabled={cartTracks.length === 0}
                                className="w-full bg-transparent border border-hud-border-secondary text-hud-text-secondary py-2 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-hud-bg-secondary hover:text-hud-text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <RotateCcw className="w-4 h-4" />
                                전체 비우기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default EMSCartDrawer
