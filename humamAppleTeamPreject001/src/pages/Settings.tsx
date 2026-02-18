import { useState, useEffect } from 'react'
import {
    User,
    Bell,
    Lock,
    Palette,
    Globe,
    Shield,
    CreditCard,
    Mail,
    Smartphone,
    Moon,
    Sun,
    Save,
    Music,
    Link,
    Unlink,
    Download,
    Loader2,
    CheckCircle,
    List,
} from 'lucide-react'
import HudCard from '../components/common/HudCard'
import Button from '../components/common/Button'
import { spotifyApi, SpotifyPlaylist } from '../services/api/spotify'
import { useAuth } from '../contexts/AuthContext'

const settingsSections = [
    { id: 'profile', label: 'Profile', icon: <User size={18} /> },
    { id: 'music', label: 'Music Services', icon: <Music size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { id: 'security', label: 'Security', icon: <Lock size={18} /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={18} /> },
    { id: 'language', label: 'Language', icon: <Globe size={18} /> },
    { id: 'privacy', label: 'Privacy', icon: <Shield size={18} /> },
    { id: 'billing', label: 'Billing', icon: <CreditCard size={18} /> },
]

const Settings = () => {
    const [activeSection, setActiveSection] = useState('profile')
    const [darkMode, setDarkMode] = useState(true)
    const { user } = useAuth()

    // Spotify state
    const [spotifyConnected, setSpotifyConnected] = useState(false)
    const [spotifyUser, setSpotifyUser] = useState<{ displayName: string; image?: string } | null>(null)
    const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylist[]>([])
    const [spotifyLoading, setSpotifyLoading] = useState(false)
    const [importingPlaylist, setImportingPlaylist] = useState<string | null>(null)
    const [importedPlaylists, setImportedPlaylists] = useState<Set<string>>(new Set())

    // Check Spotify connection status
    useEffect(() => {
        const checkSpotify = async () => {
            try {
                const status = await spotifyApi.getAuthStatus()
                setSpotifyConnected(status.connected)
                if (status.connected && status.user) {
                    setSpotifyUser({ displayName: status.user.displayName, image: status.user.image })
                }
            } catch (e) {
                console.error('Spotify status check failed:', e)
            }
        }
        checkSpotify()

        // Listen for login success message
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'SPOTIFY_LOGIN_SUCCESS') {
                setSpotifyConnected(true)
                setSpotifyUser({ displayName: event.data.user.displayName, image: event.data.user.image })
            }
        }
        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [])

    // Load playlists when connected
    useEffect(() => {
        if (spotifyConnected) {
            loadSpotifyPlaylists()
        }
    }, [spotifyConnected])

    const handleSpotifyLogin = async () => {
        try {
            const authUrl = await spotifyApi.getLoginUrl()
            window.open(authUrl, 'SpotifyLogin', 'width=500,height=700')
        } catch (e) {
            console.error('Spotify login failed:', e)
        }
    }

    const handleSpotifyLogout = async () => {
        try {
            await spotifyApi.logout()
            setSpotifyConnected(false)
            setSpotifyUser(null)
            setSpotifyPlaylists([])
        } catch (e) {
            console.error('Spotify logout failed:', e)
        }
    }

    const loadSpotifyPlaylists = async () => {
        setSpotifyLoading(true)
        try {
            const response = await spotifyApi.getPlaylists()
            setSpotifyPlaylists(response.playlists)
        } catch (e) {
            console.error('Failed to load playlists:', e)
        } finally {
            setSpotifyLoading(false)
        }
    }

    const handleImportPlaylist = async (playlist: SpotifyPlaylist) => {
        if (!user?.id) {
            alert('로그인이 필요합니다')
            return
        }
        setImportingPlaylist(playlist.id)
        try {
            const result = await spotifyApi.importPlaylist(playlist.id, user.id)
            if (result.success) {
                setImportedPlaylists(prev => new Set(prev).add(playlist.id))
                alert(`"${result.title}" 가져오기 완료! (${result.importedTracks}/${result.totalTracks} 트랙)`)
            }
        } catch (e) {
            console.error('Import failed:', e)
            alert('가져오기 실패')
        } finally {
            setImportingPlaylist(null)
        }
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">Settings</h1>
                    <p className="text-hud-text-muted mt-1">Manage your account and preferences.</p>
                </div>
                <Button variant="primary" glow leftIcon={<Save size={18} />}>
                    Save Changes
                </Button>
            </div>

            <div className="flex gap-6">
                {/* Sidebar */}
                <div className="w-56 flex-shrink-0">
                    <HudCard noPadding>
                        <div className="py-2">
                            {settingsSections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 transition-hud ${activeSection === section.id
                                            ? 'bg-hud-accent-primary/10 text-hud-accent-primary border-l-2 border-hud-accent-primary'
                                            : 'text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary'
                                        }`}
                                >
                                    {section.icon}
                                    <span className="text-sm">{section.label}</span>
                                </button>
                            ))}
                        </div>
                    </HudCard>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-6">
                    {activeSection === 'profile' && (
                        <HudCard title="Profile Settings" subtitle="Update your personal information">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">First Name</label>
                                    <input
                                        type="text"
                                        defaultValue="Admin"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Last Name</label>
                                    <input
                                        type="text"
                                        defaultValue="User"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Email</label>
                                    <input
                                        type="email"
                                        defaultValue="admin@hudadmin.com"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Phone</label>
                                    <input
                                        type="tel"
                                        defaultValue="+1 (555) 123-4567"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm text-hud-text-secondary mb-2">Bio</label>
                                    <textarea
                                        rows={4}
                                        defaultValue="Senior Full Stack Developer with 8+ years of experience."
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud resize-none"
                                    />
                                </div>
                            </div>
                        </HudCard>
                    )}

                    {activeSection === 'music' && (
                        <div className="space-y-6">
                            {/* Spotify */}
                            <HudCard title="Spotify" subtitle="Spotify 계정을 연결하고 플레이리스트를 가져오세요">
                                <div className="space-y-4">
                                    {/* Connection Status */}
                                    <div className="flex items-center justify-between p-4 bg-hud-bg-primary rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-[#1DB954] rounded-lg flex items-center justify-center">
                                                <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="currentColor">
                                                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                                                </svg>
                                            </div>
                                            <div>
                                                {spotifyConnected ? (
                                                    <>
                                                        <p className="text-sm text-hud-text-primary flex items-center gap-2">
                                                            <CheckCircle className="w-4 h-4 text-[#1DB954]" />
                                                            연결됨
                                                        </p>
                                                        <p className="text-xs text-hud-text-muted">{spotifyUser?.displayName}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-sm text-hud-text-primary">연결 안됨</p>
                                                        <p className="text-xs text-hud-text-muted">Spotify 계정을 연결하세요</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {spotifyConnected ? (
                                            <button
                                                onClick={handleSpotifyLogout}
                                                className="px-4 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-secondary hover:text-hud-accent-error hover:border-hud-accent-error/30 transition-all flex items-center gap-2"
                                            >
                                                <Unlink className="w-4 h-4" />
                                                연결 해제
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleSpotifyLogin}
                                                className="px-4 py-2 bg-[#1DB954] rounded-lg text-sm text-white font-medium hover:bg-[#1ed760] transition-all flex items-center gap-2"
                                            >
                                                <Link className="w-4 h-4" />
                                                연결하기
                                            </button>
                                        )}
                                    </div>

                                    {/* Playlists */}
                                    {spotifyConnected && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-medium text-hud-text-primary flex items-center gap-2">
                                                    <List className="w-4 h-4" />
                                                    내 플레이리스트
                                                </h4>
                                                <button
                                                    onClick={loadSpotifyPlaylists}
                                                    disabled={spotifyLoading}
                                                    className="text-xs text-hud-accent-primary hover:underline"
                                                >
                                                    새로고침
                                                </button>
                                            </div>

                                            {spotifyLoading ? (
                                                <div className="flex justify-center py-8">
                                                    <Loader2 className="w-6 h-6 text-[#1DB954] animate-spin" />
                                                </div>
                                            ) : spotifyPlaylists.length === 0 ? (
                                                <p className="text-center text-hud-text-muted py-4">플레이리스트가 없습니다</p>
                                            ) : (
                                                <div className="max-h-80 overflow-y-auto space-y-2">
                                                    {spotifyPlaylists.map((playlist) => (
                                                        <div
                                                            key={playlist.id}
                                                            className="flex items-center gap-3 p-3 bg-hud-bg-primary rounded-lg hover:bg-hud-bg-hover transition-all"
                                                        >
                                                            {playlist.image ? (
                                                                <img src={playlist.image} alt={playlist.name} className="w-12 h-12 rounded object-cover" />
                                                            ) : (
                                                                <div className="w-12 h-12 bg-hud-bg-secondary rounded flex items-center justify-center">
                                                                    <Music className="w-5 h-5 text-hud-text-muted" />
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-hud-text-primary truncate">{playlist.name}</p>
                                                                <p className="text-xs text-hud-text-muted">{playlist.trackCount} 트랙</p>
                                                            </div>
                                                            {importedPlaylists.has(playlist.id) ? (
                                                                <span className="text-xs text-hud-accent-success flex items-center gap-1">
                                                                    <CheckCircle className="w-4 h-4" />
                                                                    완료
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleImportPlaylist(playlist)}
                                                                    disabled={importingPlaylist === playlist.id}
                                                                    className="px-3 py-1.5 bg-hud-accent-primary/10 border border-hud-accent-primary/30 rounded text-xs text-hud-accent-primary hover:bg-hud-accent-primary/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                                                >
                                                                    {importingPlaylist === playlist.id ? (
                                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                                    ) : (
                                                                        <Download className="w-3 h-3" />
                                                                    )}
                                                                    가져오기
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </HudCard>

                            {/* YouTube Music - Coming Soon */}
                            <HudCard title="YouTube Music" subtitle="YouTube Music 플레이리스트 가져오기">
                                <div className="flex items-center justify-between p-4 bg-hud-bg-primary rounded-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-[#FF0000] rounded-lg flex items-center justify-center">
                                            <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="currentColor">
                                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-sm text-hud-text-primary">연결 안됨</p>
                                            <p className="text-xs text-hud-text-muted">Google OAuth 설정 필요</p>
                                        </div>
                                    </div>
                                    <button
                                        disabled
                                        className="px-4 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-muted cursor-not-allowed"
                                    >
                                        준비 중
                                    </button>
                                </div>
                            </HudCard>

                            {/* Tidal */}
                            <HudCard title="Tidal" subtitle="Tidal 플레이리스트 (기존 연동)">
                                <div className="flex items-center justify-between p-4 bg-hud-bg-primary rounded-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                                            <span className="text-white font-bold text-lg">T</span>
                                        </div>
                                        <div>
                                            <p className="text-sm text-hud-text-primary">EMS 페이지에서 연동</p>
                                            <p className="text-xs text-hud-text-muted">External Music Space에서 사용</p>
                                        </div>
                                    </div>
                                    <a
                                        href="/music/external-space"
                                        className="px-4 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-secondary hover:text-hud-text-primary transition-all"
                                    >
                                        EMS로 이동
                                    </a>
                                </div>
                            </HudCard>
                        </div>
                    )}

                    {activeSection === 'notifications' && (
                        <HudCard title="Notification Preferences" subtitle="Manage how you receive notifications">
                            <div className="space-y-6">
                                {[
                                    { icon: <Mail size={18} />, title: 'Email Notifications', desc: 'Receive email updates about your account' },
                                    { icon: <Bell size={18} />, title: 'Push Notifications', desc: 'Get push notifications on your devices' },
                                    { icon: <Smartphone size={18} />, title: 'SMS Notifications', desc: 'Receive SMS for important updates' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-hud-bg-primary rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-hud-accent-primary/10 rounded-lg text-hud-accent-primary">
                                                {item.icon}
                                            </div>
                                            <div>
                                                <p className="text-sm text-hud-text-primary">{item.title}</p>
                                                <p className="text-xs text-hud-text-muted">{item.desc}</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" defaultChecked className="sr-only peer" />
                                            <div className="w-11 h-6 bg-hud-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hud-accent-primary"></div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </HudCard>
                    )}

                    {activeSection === 'appearance' && (
                        <HudCard title="Appearance" subtitle="Customize the look and feel">
                            <div className="space-y-6">
                                {/* Theme Toggle */}
                                <div className="flex items-center justify-between p-4 bg-hud-bg-primary rounded-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-hud-accent-primary/10 rounded-lg text-hud-accent-primary">
                                            {darkMode ? <Moon size={18} /> : <Sun size={18} />}
                                        </div>
                                        <div>
                                            <p className="text-sm text-hud-text-primary">Dark Mode</p>
                                            <p className="text-xs text-hud-text-muted">Toggle dark/light theme</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={darkMode}
                                            onChange={() => setDarkMode(!darkMode)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-hud-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hud-accent-primary"></div>
                                    </label>
                                </div>

                                {/* Accent Color */}
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-3">Accent Color</label>
                                    <div className="flex gap-3">
                                        {['#00FFCC', '#6366F1', '#FF1493', '#FFA500', '#10B981', '#EF4444'].map((color) => (
                                            <button
                                                key={color}
                                                className={`w-10 h-10 rounded-lg transition-transform hover:scale-110 ${color === '#00FFCC' ? 'ring-2 ring-offset-2 ring-offset-hud-bg-secondary ring-white' : ''}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Font Size */}
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-3">Font Size</label>
                                    <div className="flex gap-2">
                                        {['Small', 'Medium', 'Large'].map((size) => (
                                            <button
                                                key={size}
                                                className={`px-4 py-2 rounded-lg text-sm transition-hud ${size === 'Medium'
                                                        ? 'bg-hud-accent-primary text-hud-bg-primary'
                                                        : 'bg-hud-bg-primary text-hud-text-secondary hover:text-hud-text-primary'
                                                    }`}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </HudCard>
                    )}

                    {activeSection === 'security' && (
                        <HudCard title="Security Settings" subtitle="Protect your account">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Current Password</label>
                                    <input
                                        type="password"
                                        placeholder="Enter current password"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">New Password</label>
                                    <input
                                        type="password"
                                        placeholder="Enter new password"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Confirm Password</label>
                                    <input
                                        type="password"
                                        placeholder="Confirm new password"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>

                                <div className="pt-4 border-t border-hud-border-secondary">
                                    <div className="flex items-center justify-between p-4 bg-hud-bg-primary rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-hud-accent-primary/10 rounded-lg text-hud-accent-primary">
                                                <Shield size={18} />
                                            </div>
                                            <div>
                                                <p className="text-sm text-hud-text-primary">Two-Factor Authentication</p>
                                                <p className="text-xs text-hud-text-muted">Add an extra layer of security</p>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm">Enable</Button>
                                    </div>
                                </div>
                            </div>
                        </HudCard>
                    )}

                    {(activeSection !== 'profile' && activeSection !== 'notifications' && activeSection !== 'appearance' && activeSection !== 'security') && (
                        <HudCard title={settingsSections.find(s => s.id === activeSection)?.label} subtitle="Settings coming soon">
                            <div className="py-12 text-center">
                                <p className="text-hud-text-muted">This section is under development.</p>
                            </div>
                        </HudCard>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Settings
