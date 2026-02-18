import { Eye, ShoppingCart, Music } from 'lucide-react'

interface Playlist {
    id: number
    name: string
    source: string
    trackCount: number
    status: 'unverified' | 'processing' | 'ready'
    addedDate: string
}

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'ready':
            return <span className="inline-flex px-2 py-1 rounded bg-hud-accent-success/20 text-hud-accent-success text-xs font-medium border border-hud-accent-success/30">Ready</span>
        case 'processing':
            return <span className="inline-flex px-2 py-1 rounded bg-hud-accent-info/20 text-hud-accent-info text-xs font-medium border border-hud-accent-info/30">Processing</span>
        case 'unverified':
        default:
            return <span className="inline-flex px-2 py-1 rounded bg-hud-accent-warning/20 text-hud-accent-warning text-xs font-medium border border-hud-accent-warning/30">Unverified</span>
    }
}

interface EMSPlaylistTableProps {
    playlists: Playlist[]
    selectedIds: number[]
    searchTerm: string
    onSelectAll: (checked: boolean) => void
    onSelectRow: (id: number, checked: boolean) => void
    onViewDetail: (id: number) => void
    onAddToCart: (id: number) => void
}

const EMSPlaylistTable = ({
    playlists,
    selectedIds,
    searchTerm,
    onSelectAll,
    onSelectRow,
    onViewDetail,
    onAddToCart
}: EMSPlaylistTableProps) => {
    const filteredPlaylists = playlists.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <section className="hud-card hud-card-bottom rounded-xl overflow-hidden">
            <div className="p-6 border-b border-hud-border-secondary flex items-center justify-between">
                <h2 className="text-xl font-bold text-hud-text-primary flex items-center gap-3">
                    <Music className="w-5 h-5 text-hud-accent-primary" />
                    EMS 플레이리스트 목록
                    <span className="text-sm font-normal text-hud-text-muted ml-2">
                        (총 {playlists.length}개)
                    </span>
                </h2>
                {selectedIds.length > 0 && (
                    <button
                        onClick={() => selectedIds.forEach(id => onAddToCart(id))}
                        className="text-hud-accent-primary hover:bg-hud-accent-primary/10 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                    >
                        <ShoppingCart className="w-4 h-4" /> 선택 항목 장바구니 ({selectedIds.length})
                    </button>
                )}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-hud-bg-secondary text-hud-text-secondary text-xs uppercase font-semibold">
                        <tr>
                            <th className="p-4 w-10">
                                <input
                                    type="checkbox"
                                    className="rounded border-hud-border-secondary bg-hud-bg-primary text-hud-accent-primary focus:ring-0"
                                    checked={playlists.length > 0 && selectedIds.length === playlists.length}
                                    onChange={(e) => onSelectAll(e.target.checked)}
                                />
                            </th>
                            <th className="p-4">플레이리스트</th>
                            <th className="p-4">소스</th>
                            <th className="p-4">트랙 수</th>
                            <th className="p-4">추가일</th>
                            <th className="p-4">상태</th>
                            <th className="p-4 text-right">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-hud-border-secondary">
                        {filteredPlaylists.length > 0 ? (
                            filteredPlaylists.map((playlist) => (
                                <tr
                                    key={playlist.id}
                                    className="hover:bg-hud-bg-secondary/50 transition-colors group cursor-pointer"
                                    onClick={() => onViewDetail(playlist.id)}
                                >
                                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className="rounded border-hud-border-secondary bg-hud-bg-primary text-hud-accent-primary focus:ring-0"
                                            checked={selectedIds.includes(playlist.id)}
                                            onChange={(e) => onSelectRow(playlist.id, e.target.checked)}
                                        />
                                    </td>
                                    <td className="p-4 font-medium text-hud-text-primary hover:text-hud-accent-primary transition-colors">
                                        {playlist.name}
                                    </td>
                                    <td className="p-4 text-hud-text-secondary capitalize">{playlist.source}</td>
                                    <td className="p-4 text-hud-text-secondary">{playlist.trackCount}</td>
                                    <td className="p-4 text-hud-text-muted text-sm">{playlist.addedDate}</td>
                                    <td className="p-4">{getStatusBadge(playlist.status)}</td>
                                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onAddToCart(playlist.id)}
                                                className="p-2 text-hud-accent-primary hover:bg-hud-accent-primary/10 rounded-lg transition-colors"
                                                title="장바구니에 추가"
                                            >
                                                <ShoppingCart className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onViewDetail(playlist.id)}
                                                className="p-2 text-hud-text-secondary hover:text-hud-text-primary hover:bg-hud-bg-hover rounded-lg transition-colors"
                                                title="상세 보기"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-hud-text-muted">
                                    {searchTerm ? '검색 결과가 없습니다.' : '아직 수집된 플레이리스트가 없습니다.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    )
}

export default EMSPlaylistTable
