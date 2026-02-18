import { Music, Home, Beaker, Warehouse, Heart, Clock, Plug, Menu, X, LayoutDashboard, Sparkles, Headphones, ScanSearch, Settings } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { LLMModal } from './LLMModal'
import { useAuth } from '../../contexts/AuthContext'

const MusicSidebar = () => {
    const location = useLocation()
    const isActive = (path: string) => location.pathname === path
    const [isOpen, setIsOpen] = useState(false)
    const [isLLMModalOpen, setIsLLMModalOpen] = useState(false)
    const { user } = useAuth()
    const isMaster = user?.role === 'MASTER'

    return (
        <>
            {/* Mobile Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden fixed top-4 left-4 z-[60] w-10 h-10 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg flex items-center justify-center text-hud-text-primary"
            >
                {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-hud-bg-primary/80 backdrop-blur-sm z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed left-0 top-0 w-64 h-screen bg-hud-bg-secondary border-r border-hud-border-secondary z-50 overflow-y-auto transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                }`}>
                {/* Logo */}
                <Link to="/" className="flex items-center gap-3 px-5 py-6">
                    <Music className="w-7 h-7 text-hud-accent-primary" />
                    <span className="text-2xl font-bold text-hud-accent-primary text-glow">MusicSpace</span>
                </Link>

                {/* 음악 공간 섹션 */}
                <div className="mb-6 px-3">
                    <div className="text-xs text-hud-text-muted uppercase tracking-wider mb-3 px-3">음악 공간</div>
                    <nav className="space-y-1">
                        <Link
                            to="/music/home"
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive('/music/home')
                                ? 'menu-active text-hud-accent-info'
                                : 'text-hud-text-secondary hover:bg-hud-accent-info/10 hover:text-hud-text-primary'
                                }`}
                        >
                            <Home className="w-5 h-5" />
                            <span>HOME</span>
                            <span className="ml-auto px-2 py-0.5 bg-hud-accent-info/20 border border-hud-accent-info/30 rounded-full text-[10px] text-hud-accent-info font-semibold">
                                🔵
                            </span>
                        </Link>

                        <Link
                            to="/music/lounge"
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive('/music/lounge')
                                ? 'menu-active text-hud-accent-success'
                                : 'text-hud-text-secondary hover:bg-hud-accent-success/10 hover:text-hud-text-primary'
                                }`}
                        >
                            <Headphones className="w-5 h-5" />
                            <span>My Lounge</span>
                            <span className="ml-auto px-2 py-0.5 bg-hud-accent-success/20 border border-hud-accent-success/30 rounded-full text-[10px] text-hud-accent-success font-semibold">
                                PMS
                            </span>
                        </Link>



                        <Link
                            to="/music/lab"
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive('/music/lab')
                                ? 'menu-active text-hud-accent-warning'
                                : 'text-hud-text-secondary hover:bg-hud-accent-warning/10 hover:text-hud-text-primary'
                                }`}
                        >
                            <Beaker className="w-5 h-5" />
                            <span>The Lab</span>
                            <span className="ml-auto px-2 py-0.5 bg-hud-accent-warning/20 border border-hud-accent-warning/30 rounded-full text-[10px] text-hud-accent-warning font-semibold">
                                GMS
                            </span>
                        </Link>

                        <Link
                            to="/music/external-space"
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive('/music/external-space')
                                ? 'menu-active text-hud-accent-secondary'
                                : 'text-hud-text-secondary hover:bg-hud-accent-secondary/10 hover:text-hud-text-primary'
                                }`}
                        >
                            <Warehouse className="w-5 h-5" />
                            <span>The Cargo</span>
                            <span className="ml-auto px-2 py-0.5 bg-hud-accent-secondary/20 border border-hud-accent-secondary/30 rounded-full text-[10px] text-hud-accent-secondary font-semibold">
                                EMS
                            </span>
                        </Link>
                    </nav>
                </div>

                {/* 라이브러리 섹션 */}
                <div className="mb-6 px-3">
                    <div className="text-xs text-hud-text-muted uppercase tracking-wider mb-3 px-3">라이브러리</div>
                    <nav className="space-y-1">
                        <Link to="/music/favorites" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-hud-text-secondary hover:bg-hud-accent-danger/10 hover:text-hud-accent-danger transition-all">
                            <Heart className="w-5 h-5" />
                            <span>Favorites</span>
                        </Link>
                        <Link to="/music/recent" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-hud-text-secondary hover:bg-hud-accent-primary/10 hover:text-hud-text-primary transition-all">
                            <Clock className="w-5 h-5" />
                            <span>Recently Played</span>
                        </Link>
                        {/* Kuka House 모달 버튼 */}
                        <button
                            onClick={() => {
                                setIsOpen(false)
                                setIsLLMModalOpen(true)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                                       text-hud-text-secondary hover:bg-gradient-to-r hover:from-hud-accent-primary/10 hover:to-hud-accent-info/10
                                       hover:text-hud-accent-primary transition-all group"
                        >
                            <Sparkles className="w-5 h-5 group-hover:animate-pulse" />
                            <span>Kuka House</span>
                            <span className="ml-auto px-2 py-0.5 bg-gradient-to-r from-hud-accent-primary/20 to-hud-accent-info/20
                                             border border-hud-accent-primary/30 rounded-full text-[10px] text-hud-accent-primary font-semibold">
                                L1
                            </span>
                        </button>

                        <Link
                            to="/music/deep-dive"
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive('/music/deep-dive')
                                ? 'menu-active text-hud-accent-purple'
                                : 'text-hud-text-secondary hover:bg-hud-accent-purple/10 hover:text-hud-text-primary'
                                }`}
                        >
                            <ScanSearch className="w-5 h-5" />
                            <span>Deep Dive</span>
                            <span className="ml-auto px-2 py-0.5 bg-hud-accent-purple/20 border border-hud-accent-purple/30 rounded-full text-[10px] text-hud-accent-purple font-semibold">
                                L2
                            </span>
                        </Link>
                    </nav>
                </div>

                {/* 설정 섹션 */}
                <div className="px-3">
                    <div className="text-xs text-hud-text-muted uppercase tracking-wider mb-3 px-3">설정</div>
                    <nav className="space-y-1">
                        <Link
                            to="/music/connections"
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive('/music/connections')
                                ? 'menu-active text-hud-accent-primary'
                                : 'text-hud-text-secondary hover:bg-hud-accent-primary/10 hover:text-hud-text-primary'
                                }`}
                        >
                            <Plug className="w-5 h-5" />
                            <span>Connections</span>
                        </Link>
                        {isMaster && (
                            <>
                                <Link
                                    to="/music/settings"
                                    onClick={() => setIsOpen(false)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive('/music/settings')
                                        ? 'menu-active text-hud-accent-primary'
                                        : 'text-hud-text-secondary hover:bg-hud-accent-primary/10 hover:text-hud-text-primary'
                                        }`}
                                >
                                    <Settings className="w-5 h-5" />
                                    <span>Settings</span>
                                </Link>
                                <Link
                                    to="/admin"
                                    onClick={() => setIsOpen(false)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive('/admin')
                                        ? 'menu-active text-hud-accent-primary'
                                        : 'text-hud-text-secondary hover:bg-hud-accent-primary/10 hover:text-hud-text-primary'
                                        }`}
                                >
                                    <LayoutDashboard className="w-5 h-5" />
                                    <span>Admin Portal</span>
                                </Link>

                                {/* Admin / Theme Config */}
                                <Link
                                    to="/music/theme-config"
                                    onClick={() => setIsOpen(false)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all mt-6 border-t border-hud-border-secondary pt-4 ${isActive('/music/theme-config')
                                        ? 'text-hud-accent-warning'
                                        : 'text-hud-text-muted hover:text-hud-accent-warning'
                                        }`}
                                >
                                    <span className="text-lg">🎨</span>
                                    <span>Theme Config</span>
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            </aside>

            {/* LLM Modal */}
            <LLMModal
                isOpen={isLLMModalOpen}
                onClose={() => setIsLLMModalOpen(false)}
            />
        </>
    )
}

export default MusicSidebar
