import { Music } from 'lucide-react'

const Footer = () => {
    return (
        <footer className="border-t border-hud-border-secondary bg-hud-bg-secondary/60 backdrop-blur-sm py-4 px-6 flex items-center justify-between text-xs text-hud-text-muted flex-shrink-0">
            <div className="flex items-center gap-2">
                <Music className="w-3.5 h-3.5 text-hud-accent-primary" />
                <span className="text-hud-text-secondary font-medium">MusicSpace</span>
            </div>
            <span>© 2026 MusicSpace. All rights reserved.</span>
        </footer>
    )
}

export default Footer
