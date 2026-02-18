import { useState } from 'react'
import { Heart } from 'lucide-react'
import { favoritesService, FavoriteTrack } from '../../services/api/favorites'

interface FavoriteButtonProps {
    track: FavoriteTrack
    size?: 'sm' | 'md' | 'lg'
    showLabel?: boolean
    onToggle?: (isFavorited: boolean) => void
    className?: string
}

const FavoriteButton = ({
    track,
    size = 'md',
    showLabel = false,
    onToggle,
    className = ''
}: FavoriteButtonProps) => {
    const [isFavorited, setIsFavorited] = useState(false)
    const [checked, setChecked] = useState(false)

    const sizeConfig = {
        sm: { icon: 14, button: 'w-7 h-7', text: 'text-xs' },
        md: { icon: 18, button: 'w-9 h-9', text: 'text-sm' },
        lg: { icon: 22, button: 'w-11 h-11', text: 'text-base' }
    }

    const config = sizeConfig[size]

    const handleMouseEnter = async () => {
        if (checked) return
        setChecked(true)
        try {
            const result = await favoritesService.isFavorited(track)
            setIsFavorited(result)
        } catch (e) {
            console.error('[FavoriteButton] Failed to check favorite status:', e)
        }
    }

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation()
        const newStatus = !isFavorited
        setIsFavorited(newStatus)
        onToggle?.(newStatus)
        try {
            await favoritesService.toggleFavorite(track)
        } catch (e) {
            console.error('[FavoriteButton] Failed to toggle favorite:', e)
            setIsFavorited(!newStatus)
        }
    }

    return (
        <button
            onClick={handleToggle}
            onMouseEnter={handleMouseEnter}
            title={isFavorited ? '좋아요 취소' : '좋아요'}
            className={`
                flex items-center justify-center gap-1.5 rounded-full transition-all duration-200 cursor-pointer
                ${showLabel ? 'px-3 py-1.5' : config.button}
                ${isFavorited
                    ? 'bg-hud-accent-danger/20 text-hud-accent-danger hover:bg-hud-accent-danger/30'
                    : 'bg-hud-bg-secondary/50 text-hud-text-muted hover:text-hud-accent-danger hover:bg-hud-accent-danger/10'
                }
                ${className}
            `}
        >
            <Heart
                size={config.icon}
                fill={isFavorited ? 'currentColor' : 'none'}
            />
            {showLabel && (
                <span className={config.text}>
                    {isFavorited ? '좋아요 됨' : '좋아요'}
                </span>
            )}
        </button>
    )
}

export default FavoriteButton
