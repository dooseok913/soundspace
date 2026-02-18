import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { youtubeMusicApi } from '../../services/api/youtubeMusic'

const YouTubeCallback = () => {
    const [searchParams] = useSearchParams()
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
    const [errorMsg, setErrorMsg] = useState('')
    const [user, setUser] = useState<{ name: string } | null>(null)
    const isExchanging = useRef(false)

    const isPopup = window.opener !== null || window.name === 'YouTubeLogin'

    useEffect(() => {
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const error = searchParams.get('error')

        if (error) {
            setStatus('error')
            setErrorMsg(error === 'access_denied' ? '사용자가 접근을 거부했습니다.' : error)
            return
        }

        if (code && state && !isExchanging.current) {
            isExchanging.current = true
            handleExchange(code, state)
        } else if (!code) {
            setStatus('error')
            setErrorMsg('인증 코드를 찾을 수 없습니다.')
        }
    }, [searchParams])

    const handleExchange = async (code: string, state: string) => {
        try {
            const response = await youtubeMusicApi.exchangeCode(code, state)

            if (response.success) {
                setStatus('success')
                setUser({ name: response.user.name })

                const messageData = {
                    type: 'YOUTUBE_LOGIN_SUCCESS',
                    user: response.user,
                    visitorId: response.visitorId,
                    timestamp: Date.now()
                }

                if (window.opener) {
                    try {
                        window.opener.postMessage(messageData, '*')
                    } catch (e) {
                        console.error('postMessage failed', e)
                    }
                }

                localStorage.setItem('youtube_login_result', JSON.stringify(messageData))

                if (isPopup) {
                    setTimeout(() => {
                        window.close()
                    }, 1500)
                }
            } else {
                throw new Error('인증 교환에 실패했습니다.')
            }
        } catch (err: any) {
            setStatus('error')
            setErrorMsg(err.message || '토큰 교환에 실패했습니다.')
        }
    }

    return (
        <div className="min-h-screen bg-hud-bg-primary flex items-center justify-center">
            <div className="bg-hud-bg-card border border-hud-border-secondary rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
                {status === 'processing' && (
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-12 h-12 text-[#FF0000] animate-spin" />
                        <h2 className="text-xl font-bold text-hud-text-primary">YouTube 연결 중...</h2>
                        <p className="text-hud-text-secondary">로그인을 확인하는 중입니다.</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center gap-4">
                        <CheckCircle className="w-12 h-12 text-[#FF0000]" />
                        <h2 className="text-xl font-bold text-[#FF0000]">연결 성공!</h2>
                        {user && (
                            <p className="text-hud-text-primary">환영합니다, {user.name}님!</p>
                        )}
                        <p className="text-hud-text-secondary">이 창은 자동으로 닫힙니다.</p>
                        <button
                            onClick={() => window.close()}
                            className="mt-2 bg-[#FF0000] text-white px-4 py-2 rounded-full hover:bg-[#CC0000] transition-colors"
                        >
                            창 닫기
                        </button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center gap-4">
                        <XCircle className="w-12 h-12 text-hud-accent-error" />
                        <h2 className="text-xl font-bold text-hud-accent-error">연결 실패</h2>
                        <p className="text-hud-text-secondary mb-4">{errorMsg}</p>
                        <button
                            onClick={() => window.close()}
                            className="bg-hud-bg-secondary px-4 py-2 rounded-lg text-hud-text-primary hover:bg-hud-bg-hover"
                        >
                            창 닫기
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default YouTubeCallback
