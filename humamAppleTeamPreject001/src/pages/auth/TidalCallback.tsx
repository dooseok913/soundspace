import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { post } from '../../services/api'

// Get visitorId for session management
const getVisitorId = () => {
    let visitorId = localStorage.getItem('tidal_visitor_id')
    if (!visitorId) {
        visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        localStorage.setItem('tidal_visitor_id', visitorId)
    }
    return visitorId
}

const TidalCallback = () => {
    const [searchParams] = useSearchParams()
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
    const [errorMsg, setErrorMsg] = useState('')
    const [user, setUser] = useState<{ username: string } | null>(null)
    const isExchanging = useRef(false) // Flag to ensure handleExchange runs only once

    // Check if this is a popup window
    const isPopup = window.opener !== null || window.name === 'TidalLogin'

    useEffect(() => {
        const code = searchParams.get('code')
        const error = searchParams.get('error')

        if (error) {
            setStatus('error')
            setErrorMsg(error)
            return
        }

        if (code && !isExchanging.current) {
            isExchanging.current = true // Set flag to true to prevent re-execution
            handleExchange(code)
        } else if (!code) { // Only set error if no code and no error param
            setStatus('error')
            setErrorMsg('No authorization code found')
        }
    }, [searchParams])

    const handleExchange = async (code: string) => {
        try {
            const visitorId = getVisitorId()
            // Docker/Nginx environment running on port 80 usually is http
            // Force http if on localhost to match backend expectation
            const origin = window.location.origin.replace('https://', 'http://');
            const redirectUri = `${origin}/tidal-callback`
            const response = await post<any>('/tidal/auth/exchange', { code, visitorId, redirectUri })
            if (response.success) {
                setStatus('success')
                if (response.user) {
                    setUser({ username: response.user.username || 'Tidal User' })
                }

                // Normalize response field names for consistency
                const normalizedResponse = {
                    ...response,
                    accessToken: response.access_token || response.accessToken,
                    refreshToken: response.refresh_token || response.refreshToken,
                    expiresIn: response.expires_in || response.expiresIn
                }

                const messageData = {
                    type: 'TIDAL_LOGIN_SUCCESS',
                    response: normalizedResponse,
                    visitorId,
                    timestamp: Date.now()
                }

                // 1. Primary: postMessage to opener
                if (window.opener) {
                    try {
                        window.opener.postMessage(messageData, '*')
                    } catch (e) {
                        console.error('postMessage failed', e)
                    }
                }

                // 2. Fallback: localStorage (works if same origin)
                localStorage.setItem('tidal_login_result', JSON.stringify(messageData))

                // Always try to close if it's a popup
                if (isPopup) {
                    // Try to close after a short delay
                    setTimeout(() => {
                        window.close()
                    }, 1000)
                }
            } else {
                throw new Error('Exchange failed')
            }
        } catch (err: any) {
            setStatus('error')
            setErrorMsg(err.message || 'Failed to exchange token')
        }
    }

    return (
        <div className="min-h-screen bg-hud-bg-primary flex items-center justify-center">
            <div className="bg-hud-bg-card border border-hud-border-secondary rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
                {status === 'processing' && (
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-12 h-12 text-hud-accent-primary animate-spin" />
                        <h2 className="text-xl font-bold text-hud-text-primary">Connecting to Tidal...</h2>
                        <p className="text-hud-text-secondary">Please wait while we verify your login.</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center gap-4">
                        <CheckCircle className="w-12 h-12 text-teal-400" />
                        <h2 className="text-xl font-bold text-teal-400">연결 성공!</h2>
                        {user && (
                            <p className="text-hud-text-primary">환영합니다, {user.username}님!</p>
                        )}
                        <p className="text-hud-text-secondary">이 창은 자동으로 닫힙니다.</p>
                        <button
                            onClick={() => window.close()}
                            className="mt-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-900"
                        >
                            창 닫기
                        </button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center gap-4">
                        <XCircle className="w-12 h-12 text-hud-accent-error" />
                        <h2 className="text-xl font-bold text-hud-accent-error">Login Failed</h2>
                        <p className="text-hud-text-secondary mb-4">{errorMsg}</p>
                        <button
                            onClick={() => window.close()}
                            className="bg-hud-bg-secondary px-4 py-2 rounded-lg text-hud-text-primary hover:bg-hud-bg-hover"
                        >
                            Close Window
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default TidalCallback
