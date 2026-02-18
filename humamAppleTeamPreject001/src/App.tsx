import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { MusicProvider } from './context/MusicContext'
import MainLayout from './layouts/MainLayout'
import MusicLayout from './layouts/MusicLayout'
import MusicHomeLayout from './layouts/MusicHomeLayout'

// Dashboard
import Dashboard from './pages/dashboard/Dashboard'
import Analytics from './pages/dashboard/Analytics'

// Email
import EmailInbox from './pages/email/EmailInbox'
import EmailCompose from './pages/email/EmailCompose'
import EmailDetail from './pages/email/EmailDetail'

// Core Pages
import Widgets from './pages/Widgets'
import Profile from './pages/Profile'
import Calendar from './pages/Calendar'
import Settings from './pages/Settings'
import ScrumBoard from './pages/ScrumBoard'
import Products from './pages/Products'
import Pricing from './pages/Pricing'
import Gallery from './pages/Gallery'

// Auth
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Onboarding from './pages/auth/Onboarding'
import TidalCallback from './pages/auth/TidalCallback'
import SpotifyCallback from './pages/auth/SpotifyCallback'
import YouTubeCallback from './pages/auth/YouTubeCallback'
import ProtectedRoute from './components/auth/ProtectedRoute'

// AI Studio
import AiChat from './pages/ai/AiChat'
import AiImageGenerator from './pages/ai/AiImageGenerator'

// POS System
import PosCustomerOrder from './pages/pos/PosCustomerOrder'
import PosKitchenOrder from './pages/pos/PosKitchenOrder'
import PosCounterCheckout from './pages/pos/PosCounterCheckout'
import PosTableBooking from './pages/pos/PosTableBooking'
import PosMenuStock from './pages/pos/PosMenuStock'

// UI Components
import UiBootstrap from './pages/ui/UiBootstrap'
import UiButtons from './pages/ui/UiButtons'
import UiCard from './pages/ui/UiCard'
import UiIcons from './pages/ui/UiIcons'
import UiModalNotification from './pages/ui/UiModalNotification'
import UiTypography from './pages/ui/UiTypography'
import UiTabsAccordions from './pages/ui/UiTabsAccordions'

// Forms
import FormElements from './pages/forms/FormElements'
import FormPlugins from './pages/forms/FormPlugins'
import FormWizards from './pages/forms/FormWizards'

// Tables
import TableElements from './pages/tables/TableElements'
import TablePlugins from './pages/tables/TablePlugins'

// Charts
import ChartJs from './pages/charts/ChartJs'

// Misc Pages
import Error404 from './pages/Error404'
import ComingSoon from './pages/ComingSoon'

// Music Pages
import MusicLounge from './pages/music/MusicLounge'
import ExternalMusicSpace from './pages/music/ExternalMusicSpace'
import MusicHome from './pages/music/MusicHome'
import GatewayMusicSpace from './pages/music/GatewayMusicSpace'
import DeepDive from './pages/music/DeepDive'
import MusicConnections from './pages/music/MusicConnections'
import MusicSettings from './pages/music/MusicSettings'
import Favorites from './pages/music/Favorites'
import RecentlyPlayed from './pages/music/RecentlyPlayed'
import ThemeConfig from './pages/admin/ThemeConfig'
import MusicPlayer from './components/music/MusicPlayer'

// Admin Pages
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import UserManagement from './pages/admin/UserManagement'
import ContentManagement from './pages/admin/ContentManagement'
import AdminSettings from './pages/admin/AdminSettings'

// Demo Pages
import AIModelDemo from './pages/demo/AIModelDemo'

import { ThemeProvider } from './contexts/ThemeContext'

function App() {
    return (
        <AuthProvider>
            <ThemeProvider>
                <MusicProvider>
                    <Router>
                        <Routes>
                            {/* Auth Pages (No Layout) */}
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                            <Route path="/coming-soon" element={<ComingSoon />} />
                            <Route path="/404" element={<Error404 />} />

                            {/* OAuth Callbacks */}
                            <Route path="/tidal-callback" element={<TidalCallback />} />
                            <Route path="/spotify-callback" element={<SpotifyCallback />} />
                            <Route path="/youtube-callback" element={<YouTubeCallback />} />

                            {/* Demo Pages (No Layout - Full Screen) */}
                            <Route path="/demo/ai-models" element={<AIModelDemo />} />

                            {/* Root redirect to Music Home */}
                            <Route path="/" element={<Navigate to="/music/home" replace />} />

                            {/* Main Layout Pages (Protected) */}
                            <Route path="/dashboard" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                                <Route index element={<Dashboard />} />
                                <Route path="analytics" element={<Analytics />} />

                                {/* Email */}
                                <Route path="email/inbox" element={<EmailInbox />} />
                                <Route path="email/compose" element={<EmailCompose />} />
                                <Route path="email/detail/:id" element={<EmailDetail />} />

                                {/* Core Pages */}
                                <Route path="widgets" element={<Widgets />} />
                                <Route path="profile" element={<Profile />} />
                                <Route path="calendar" element={<Calendar />} />
                                <Route path="settings" element={<Settings />} />
                                <Route path="scrum-board" element={<ScrumBoard />} />
                                <Route path="products" element={<Products />} />
                                <Route path="pricing" element={<Pricing />} />
                                <Route path="gallery" element={<Gallery />} />

                                {/* AI Studio */}
                                <Route path="ai/chat" element={<AiChat />} />
                                <Route path="ai/image-generator" element={<AiImageGenerator />} />

                                {/* POS System */}
                                <Route path="pos/customer-order" element={<PosCustomerOrder />} />
                                <Route path="pos/kitchen-order" element={<PosKitchenOrder />} />
                                <Route path="pos/counter-checkout" element={<PosCounterCheckout />} />
                                <Route path="pos/table-booking" element={<PosTableBooking />} />
                                <Route path="pos/menu-stock" element={<PosMenuStock />} />

                                {/* UI Components */}
                                <Route path="ui/bootstrap" element={<UiBootstrap />} />
                                <Route path="ui/buttons" element={<UiButtons />} />
                                <Route path="ui/card" element={<UiCard />} />
                                <Route path="ui/icons" element={<UiIcons />} />
                                <Route path="ui/modal-notification" element={<UiModalNotification />} />
                                <Route path="ui/typography" element={<UiTypography />} />
                                <Route path="ui/tabs-accordions" element={<UiTabsAccordions />} />

                                {/* Forms */}
                                <Route path="form/elements" element={<FormElements />} />
                                <Route path="form/plugins" element={<FormPlugins />} />
                                <Route path="form/wizards" element={<FormWizards />} />

                                {/* Tables */}
                                <Route path="table/elements" element={<TableElements />} />
                                <Route path="table/plugins" element={<TablePlugins />} />

                                {/* Charts */}
                                <Route path="chart/chartjs" element={<ChartJs />} />
                            </Route>

                            {/* Music Home (without sidebar) */}
                            <Route path="/music" element={<MusicHomeLayout />}>
                                <Route path="home" element={<MusicHome />} />
                            </Route>

                            {/* Admin Layout Pages (Protected) */}
                            <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
                                <Route index element={<AdminDashboard />} />
                                <Route path="users" element={<UserManagement />} />
                                <Route path="content" element={<ContentManagement />} />
                                <Route path="settings" element={<AdminSettings />} />
                            </Route>

                            {/* Music Pages (with sidebar) */}
                            <Route path="/music" element={<MusicLayout />}>
                                <Route path="lounge" element={<ProtectedRoute><MusicLounge /></ProtectedRoute>} />
                                <Route path="favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
                                <Route path="recent" element={<ProtectedRoute><RecentlyPlayed /></ProtectedRoute>} />
                                <Route path="lab" element={<ProtectedRoute><GatewayMusicSpace /></ProtectedRoute>} />
                                <Route path="deep-dive" element={<ProtectedRoute><DeepDive /></ProtectedRoute>} />
                                <Route path="external-space" element={<ProtectedRoute><ExternalMusicSpace /></ProtectedRoute>} />
                                <Route path="connections" element={<ProtectedRoute><MusicConnections /></ProtectedRoute>} />
                                <Route path="settings" element={<ProtectedRoute><MusicSettings /></ProtectedRoute>} />
                                <Route path="theme-config" element={<ProtectedRoute><ThemeConfig /></ProtectedRoute>} />
                            </Route>

                            {/* 404 Fallback */}
                            <Route path="*" element={<Error404 />} />
                        </Routes>
                        {/* Global Music Player - persists across all routes */}
                        <MusicPlayer />
                    </Router>
                </MusicProvider>
            </ThemeProvider>
        </AuthProvider>
    )
}

export default App
