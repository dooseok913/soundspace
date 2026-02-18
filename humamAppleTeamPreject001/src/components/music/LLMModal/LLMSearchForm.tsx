import { useState } from 'react'
import { Search, Loader2, Sparkles } from 'lucide-react'
import { KukaModel } from '../../../services/api/kukaApi'

interface LLMSearchFormProps {
    onSearch: (params: {
        artist?: string
        song?: string
        k: number
        model: KukaModel
        explain: boolean
    }) => void
    loading: boolean
}

const LLMSearchForm = ({ onSearch, loading }: LLMSearchFormProps) => {
    const [artist, setArtist] = useState('')
    const [song, setSong] = useState('')
    const [model, setModel] = useState<KukaModel>('ensemble')
    const [k, setK] = useState(10)
    const [explain, setExplain] = useState(true)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!artist && !song) return

        onSearch({
            artist: artist || undefined,
            song: song || undefined,
            k,
            model,
            explain
        })
    }

    const canSubmit = (artist || song) && !loading

    return (
        <form onSubmit={handleSubmit} className="px-4 py-2 space-y-2 border-b border-hud-border-secondary">
            {/* Input Fields - Compact */}
            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="아티스트"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    className="flex-1 px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary
                               rounded-lg text-sm text-hud-text-primary placeholder:text-hud-text-muted
                               focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary/20
                               focus:outline-none transition-all"
                />
                <input
                    type="text"
                    placeholder="곡명 (선택)"
                    value={song}
                    onChange={(e) => setSong(e.target.value)}
                    className="flex-1 px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary
                               rounded-lg text-sm text-hud-text-primary placeholder:text-hud-text-muted
                               focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary/20
                               focus:outline-none transition-all"
                />
            </div>

            {/* Options Row - Compact */}
            <div className="flex items-center gap-2 flex-wrap">
                <select
                    value={model}
                    onChange={(e) => setModel(e.target.value as KukaModel)}
                    className="px-2 py-1.5 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg
                               text-xs text-hud-text-primary focus:border-hud-accent-primary focus:outline-none"
                >
                    <option value="ensemble">앙상블</option>
                    <option value="knn">오디오</option>
                    <option value="text">텍스트</option>
                    <option value="hybrid">하이브리드</option>
                </select>

                <select
                    value={k}
                    onChange={(e) => setK(Number(e.target.value))}
                    className="px-2 py-1.5 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg
                               text-xs text-hud-text-primary focus:border-hud-accent-primary focus:outline-none"
                >
                    <option value={5}>5곡</option>
                    <option value={10}>10곡</option>
                    <option value={20}>20곡</option>
                </select>

                <label className="flex items-center gap-1 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={explain}
                        onChange={(e) => setExplain(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-hud-border-secondary bg-hud-bg-secondary
                                   text-hud-accent-primary focus:ring-hud-accent-primary/20"
                    />
                    <span className="text-xs text-hud-text-secondary flex items-center gap-0.5">
                        <Sparkles className="w-3 h-3" />
                        설명
                    </span>
                </label>

                {/* Submit Button - Inline */}
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="ml-auto flex items-center gap-1.5 px-4 py-1.5
                               bg-gradient-to-r from-hud-accent-primary to-hud-accent-info
                               text-white text-sm rounded-lg font-medium
                               hover:scale-[1.02] active:scale-[0.98] transition-all
                               disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                               shadow-md shadow-hud-accent-primary/20"
                >
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Search className="w-4 h-4" />
                    )}
                    <span>{loading ? '검색중' : '추천'}</span>
                </button>
            </div>
        </form>
    )
}

export default LLMSearchForm
