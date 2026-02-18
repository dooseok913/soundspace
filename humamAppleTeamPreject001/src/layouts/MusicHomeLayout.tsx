import { Outlet, Link, useLocation } from 'react-router-dom'
import { LogIn, LogOut, User, UserPlus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Footer from '../components/layout/Footer'

const MusicHomeLayout = () => {
    const { user, isAuthenticated, logout } = useAuth()
    const location = useLocation()

    const navItems = [
        { path: '/music/home', label: 'HOME', color: 'text-hud-accent-primary' },
        { path: '/music/lounge', label: 'PMS', color: 'text-hud-accent-success' },
        { path: '/music/lab', label: 'GMS', color: 'text-hud-accent-warning' },
        { path: '/music/external-space', label: 'EMS', color: 'text-hud-accent-info' },
    ]

    return (
        <div className="h-screen bg-hud-bg-primary hud-grid-bg overflow-hidden flex flex-col">
            {/* Header without sidebar offset */}
            <header className="bg-hud-bg-secondary/80 backdrop-blur-md border-b border-hud-border-secondary z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-music w-8 h-8 text-hud-accent-primary"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                            <span className="text-2xl font-bold bg-gradient-to-r from-hud-accent-primary to-hud-accent-info bg-clip-text text-transparent hidden sm:block">
                                MusicSpace
                            </span>
                        </Link>
                    </div>

                    <nav className="flex items-center gap-6">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`font-medium transition-colors ${location.pathname === item.path
                                    ? item.color
                                    : 'text-hud-text-secondary hover:' + item.color
                                    }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <div className="flex items-center gap-3 ml-4 pl-4 border-l border-hud-border-secondary">
                            {isAuthenticated ? (
                                <>
                                    <div className="flex items-center gap-2 text-hud-text-secondary">
                                        <div className="w-8 h-8 bg-gradient-to-br from-hud-accent-primary to-hud-accent-info rounded-full flex items-center justify-center">
                                            <User className="w-4 h-4 text-white" />
                                        </div>
                                        <span className="text-hud-text-primary font-medium">{user?.name}</span>
                                    </div>
                                    <button
                                        onClick={logout}
                                        className="flex items-center gap-1.5 text-hud-text-muted hover:text-hud-accent-danger transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" /> 로그아웃
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to="/login" className="flex items-center gap-1.5 text-hud-text-secondary hover:text-hud-accent-primary transition-colors">
                                        <LogIn className="w-4 h-4" /> 로그인
                                    </Link>
                                    <Link to="/register" className="flex items-center gap-1.5 bg-hud-accent-primary text-hud-bg-primary px-3 py-1.5 rounded-lg font-medium hover:bg-hud-accent-primary/90 transition-all">
                                        <UserPlus className="w-4 h-4" /> 회원가입
                                    </Link>
                                </>
                            )}
                        </div>
                    </nav>
                </div>
            </header>
            <main className="overflow-y-auto flex-1 min-h-0 flex flex-col">
                <div className="flex-1">
                    <Outlet />
                </div>
                <Footer />
            </main>
        </div>
    )
}

export default MusicHomeLayout
