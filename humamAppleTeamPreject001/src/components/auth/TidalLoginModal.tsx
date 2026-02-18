import { useState, useEffect, useRef } from 'react'
import { X, ExternalLink, Loader2, Check, Copy } from 'lucide-react'
import { tidalApi } from '../../services/api/tidal'

interface TidalLoginModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: (response: any) => void
}

interface DeviceAuthData {
    deviceCode: string
    userCode: string
    verificationUri: string
    expiresIn: number
    interval: number
}

const TidalLoginModal = ({ isOpen, onClose, onSuccess }: TidalLoginModalProps) => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [deviceAuth, setDeviceAuth] = useState<DeviceAuthData | null>(null)
    const [polling, setPolling] = useState(false)
    const [copied, setCopied] = useState(false)
    const [timeLeft, setTimeLeft] = useState(0)

    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const isMounted = useRef(true)

    useEffect(() => {
        isMounted.current = true
        return () => {
            isMounted.current = false
            stopPolling()
        }
    }, [])

    useEffect(() => {
        if (!isOpen) {
            resetState()
            stopPolling()
        }
    }, [isOpen])

    const resetState = () => {
        setLoading(false)
        setError(null)
        setDeviceAuth(null)
        setPolling(false)
        setCopied(false)
        setTimeLeft(0)
    }

    const stopPolling = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
        }
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current)
            timerIntervalRef.current = null
        }
    }

    const handleLoginSuccess = (response: any) => {
        if (!isMounted.current) return

        stopPolling()

        // Store tokens for player usage
        if (response.accessToken) {
            localStorage.setItem('tidal_access_token', response.accessToken)
        }
        if (response.refreshToken) {
            localStorage.setItem('tidal_refresh_token', response.refreshToken)
        }
        // Store visitor ID (for API calls)
        const visitorId = localStorage.getItem('tidal_visitor_id')
        if (visitorId) {
            console.log('[TidalModal] Visitor ID:', visitorId)
        }

        onSuccess(response)
        onClose()
    }

    // Device Code Flow 시작
    const initDeviceLogin = async () => {
        try {
            setLoading(true)
            setError(null)

            console.log('[TidalModal] Initiating Device Auth...')
            const response = await tidalApi.initDeviceAuth()
            console.log('[TidalModal] Device Auth Response:', response)

            if (!response.deviceCode || !response.userCode) {
                throw new Error('Failed to get device code')
            }

            setDeviceAuth({
                deviceCode: response.deviceCode,
                userCode: response.userCode,
                verificationUri: response.verificationUri || 'https://link.tidal.com',
                expiresIn: response.expiresIn || 300,
                interval: response.interval || 5
            })

            setTimeLeft(response.expiresIn || 300)
            setLoading(false)

            // Start polling for token
            startPolling(response.deviceCode, response.interval || 5)

            // Start countdown timer
            startTimer(response.expiresIn || 300)

        } catch (err: any) {
            if (isMounted.current) {
                console.error('[TidalModal] Device Auth Init Failed:', err)
                setError(err.message || 'Failed to initialize Tidal login')
                setLoading(false)
            }
        }
    }

    const startPolling = (deviceCode: string, interval: number) => {
        stopPolling()
        setPolling(true)

        const pollInterval = Math.max(interval, 5) * 1000 // At least 5 seconds

        pollIntervalRef.current = setInterval(async () => {
            try {
                console.log('[TidalModal] Polling for token...')
                const response = await tidalApi.pollToken(deviceCode)
                console.log('[TidalModal] Poll Response:', response)

                if (response.success && response.accessToken) {
                    console.log('[TidalModal] Login successful!')
                    handleLoginSuccess(response)
                } else if (response.error === 'expired_token') {
                    stopPolling()
                    setError('로그인 시간이 만료되었습니다. 다시 시도해주세요.')
                    setDeviceAuth(null)
                    setPolling(false)
                }
                // authorization_pending, slow_down 등은 계속 polling
            } catch (err: any) {
                console.warn('[TidalModal] Poll error:', err.message)
                // Don't stop on error, keep polling
            }
        }, pollInterval)
    }

    const startTimer = (seconds: number) => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current)
        }

        timerIntervalRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    stopPolling()
                    setError('로그인 시간이 만료되었습니다. 다시 시도해주세요.')
                    setDeviceAuth(null)
                    setPolling(false)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }

    const copyCode = async () => {
        if (deviceAuth?.userCode) {
            await navigator.clipboard.writeText(deviceAuth.userCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const openTidalLink = () => {
        let url = deviceAuth?.verificationUri || 'link.tidal.com'
        // Ensure URL has https:// prefix
        if (url && !url.startsWith('http')) {
            url = `https://${url}`
        }
        window.open(url, '_blank', 'noopener')
    }

    const formatTime = (seconds: number) => {
        const min = Math.floor(seconds / 60)
        const sec = seconds % 60
        return `${min}:${sec.toString().padStart(2, '0')}`
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-hud-bg-card border border-hud-border-secondary rounded-xl max-w-md w-full shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-hud-border-secondary flex items-center justify-between">
                    <h2 className="text-xl font-bold text-hud-text-primary flex items-center gap-2">
                        <div className="w-8 h-8 bg-black text-white rounded flex items-center justify-center font-bold font-serif">T</div>
                        Sign in with Tidal
                    </h2>
                    <button onClick={onClose} className="text-hud-text-muted hover:text-hud-text-primary transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 flex flex-col items-center min-h-[350px] justify-center">
                    {loading ? (
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
                            <p className="text-gray-400 animate-pulse">Tidal 로그인 준비 중...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                                <X size={24} />
                            </div>
                            <p className="text-red-400">{error}</p>
                            <button
                                onClick={initDeviceLogin}
                                className="px-4 py-2 bg-hud-bg-secondary hover:bg-hud-bg-primary border border-hud-border-secondary rounded text-sm text-hud-text-primary transition-colors"
                            >
                                다시 시도
                            </button>
                        </div>
                    ) : deviceAuth ? (
                        <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-4">
                                <h3 className="text-lg font-medium text-white mb-2">코드를 입력하세요</h3>
                                <p className="text-sm text-gray-400">
                                    아래 코드를 Tidal 웹사이트에 입력하세요
                                </p>
                            </div>

                            {/* User Code Display */}
                            <div className="relative group w-full max-w-[280px] mb-4">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                                <div 
                                    className="relative bg-black rounded-lg p-4 border border-white/10 flex items-center justify-between cursor-pointer hover:bg-gray-900 transition-colors"
                                    onClick={copyCode}
                                >
                                    <span className="text-3xl font-mono font-bold text-white tracking-widest">
                                        {deviceAuth.userCode}
                                    </span>
                                    <button className="p-2 hover:bg-white/10 rounded transition-colors">
                                        {copied ? (
                                            <Check size={20} className="text-green-400" />
                                        ) : (
                                            <Copy size={20} className="text-gray-400" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {copied && (
                                <p className="text-xs text-green-400 mb-2">코드가 복사되었습니다!</p>
                            )}

                            {/* Timer */}
                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                                <span>남은 시간: {formatTime(timeLeft)}</span>
                                {polling && <Loader2 size={14} className="animate-spin" />}
                            </div>

                            {/* Open Link Button */}
                            <button
                                onClick={openTidalLink}
                                className="w-full py-3 bg-white text-black rounded font-bold hover:bg-cyan-50 transition-colors flex items-center justify-center gap-2 mb-4"
                            >
                                link.tidal.com 열기 <ExternalLink size={16} />
                            </button>

                            {/* Instructions */}
                            <div className="bg-gray-900/50 rounded-lg p-4 w-full text-sm text-gray-400">
                                <p className="font-medium text-gray-300 mb-2">로그인 방법:</p>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>위 버튼을 클릭하여 Tidal 사이트 열기</li>
                                    <li>Tidal 계정으로 로그인</li>
                                    <li>위 코드를 입력</li>
                                    <li>자동으로 연결됩니다</li>
                                </ol>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-4">
                                <Check size={12} className="text-green-500" />
                                <span>코드 입력 완료 시 자동으로 연결됩니다</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-6">
                                <h3 className="text-lg font-medium text-white mb-2">Tidal 계정 연결</h3>
                                <p className="text-sm text-gray-400">
                                    Tidal 계정을 연결하여 플레이리스트를 가져오고<br />
                                    고음질 스트리밍을 즐기세요.
                                </p>
                            </div>

                            <div className="relative group w-full max-w-[280px] mb-6">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                                <div className="relative bg-black/50 rounded-lg p-5 border border-white/10">
                                    <ul className="text-sm text-gray-300 space-y-2">
                                        <li className="flex items-center gap-2">
                                            <Check size={14} className="text-cyan-400" />
                                            플레이리스트 가져오기
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check size={14} className="text-cyan-400" />
                                            LOSSLESS 고음질 스트리밍
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check size={14} className="text-cyan-400" />
                                            Device Code 인증 (안전)
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <button
                                onClick={initDeviceLogin}
                                className="w-full py-3 bg-white text-black rounded font-bold hover:bg-cyan-50 transition-colors flex items-center justify-center gap-2"
                            >
                                Tidal 연결하기 <ExternalLink size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default TidalLoginModal
