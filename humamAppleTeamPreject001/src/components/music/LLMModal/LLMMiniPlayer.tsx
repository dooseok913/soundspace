import { Play, Pause, Loader2, Music, SkipBack, SkipForward } from 'lucide-react'

interface LLMTrack {
    title: string
    artist: string
    artwork: string
    previewUrl: string
}

interface LLMMiniPlayerProps {
    currentTrack: LLMTrack | null
    isPlaying: boolean
    audioState: {
        currentTime: number
        duration: number
        isBuffering: boolean
    }
    onTogglePlay: () => void
    onPrevious: () => void
    onNext: () => void
}

const LLMMiniPlayer = ({
    currentTrack,
    isPlaying,
    audioState,
    onTogglePlay,
    onPrevious,
    onNext
}: LLMMiniPlayerProps) => {
    if (!currentTrack) {
        return (
            <div className="border-t border-hud-border-secondary bg-hud-bg-primary/50 px-3 py-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-hud-bg-secondary flex items-center justify-center">
                        <Music className="w-4 h-4 text-hud-text-muted" />
                    </div>
                    <p className="text-xs text-hud-text-muted">곡을 선택해주세요</p>
                </div>
            </div>
        )
    }

    const progress = audioState.duration > 0
        ? (audioState.currentTime / audioState.duration) * 100
        : 0

    const formatTime = (seconds: number) => {
        const min = Math.floor(seconds / 60)
        const sec = Math.floor(seconds % 60)
        return `${min}:${sec.toString().padStart(2, '0')}`
    }

    return (
        <div className="border-t border-hud-border-secondary bg-hud-bg-primary/80 backdrop-blur-sm">
            {/* Progress Bar */}
            <div className="h-0.5 bg-hud-bg-secondary">
                <div
                    className="h-full bg-gradient-to-r from-hud-accent-primary to-hud-accent-info transition-all duration-200"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="px-3 py-2">
                <div className="flex items-center gap-2">
                    {/* Album Art */}
                    <div className="w-10 h-10 rounded-lg bg-hud-bg-secondary overflow-hidden shrink-0">
                        {currentTrack.artwork ? (
                            <img
                                src={currentTrack.artwork}
                                alt={currentTrack.title}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-hud-accent-primary/20 to-hud-accent-info/20">
                                <Music className="w-5 h-5 text-hud-accent-primary/50" />
                            </div>
                        )}
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-hud-text-primary truncate">
                            {currentTrack.title}
                        </p>
                        <p className="text-[10px] text-hud-text-muted truncate">
                            {currentTrack.artist} · {formatTime(audioState.currentTime)}/{formatTime(audioState.duration || 0)}
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-0.5 shrink-0">
                        <button
                            onClick={onPrevious}
                            className="p-1.5 text-hud-text-secondary hover:text-hud-text-primary transition-colors"
                        >
                            <SkipBack className="w-3.5 h-3.5" fill="currentColor" />
                        </button>

                        <button
                            onClick={onTogglePlay}
                            className="w-8 h-8 rounded-full bg-hud-accent-primary flex items-center
                                       justify-center text-white hover:scale-105 active:scale-95 transition-transform
                                       shadow-md shadow-hud-accent-primary/30"
                        >
                            {audioState.isBuffering ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isPlaying ? (
                                <Pause className="w-4 h-4" fill="currentColor" />
                            ) : (
                                <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                            )}
                        </button>

                        <button
                            onClick={onNext}
                            className="p-1.5 text-hud-text-secondary hover:text-hud-text-primary transition-colors"
                        >
                            <SkipForward className="w-3.5 h-3.5" fill="currentColor" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LLMMiniPlayer
