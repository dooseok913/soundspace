import { Outlet } from 'react-router-dom'
import MusicHeader from '../components/music/MusicHeader'
import MusicSidebar from '../components/music/MusicSidebar'
import Footer from '../components/layout/Footer'

const MusicLayout = () => {
    return (
        <div className="h-screen bg-hud-bg-primary hud-grid-bg overflow-hidden flex flex-col">
            <MusicSidebar />
            <MusicHeader />
            <main className="md:ml-64 overflow-y-auto flex-1 min-h-0 flex flex-col">
                <div className="flex-1">
                    <Outlet />
                </div>
                <Footer />
            </main>
        </div>
    )
}

export default MusicLayout
