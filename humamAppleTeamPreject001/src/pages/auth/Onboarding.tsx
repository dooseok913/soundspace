import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle, Music, ArrowRight, ShieldCheck, Zap, Brain } from 'lucide-react'
import Button from '../../components/common/Button'
import TidalLoginModal from '../../components/auth/TidalLoginModal'
import { post } from '../../services/api/index'
import { useAuth } from '../../contexts/AuthContext'

const Onboarding = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { user } = useAuth()
    const [servicesToSync, setServicesToSync] = useState<string[]>([])
    const [currentServiceIndex, setCurrentServiceIndex] = useState(0)
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncedServices, setSyncedServices] = useState<string[]>([])
    const [showModal, setShowModal] = useState(false)

    // AI 모델 학습 상태
    const [isTraining, setIsTraining] = useState(false)
    const [trainingProgress, setTrainingProgress] = useState(0)
    const [trainingStatus, setTrainingStatus] = useState('')
    const [trainingComplete, setTrainingComplete] = useState(false)

    useEffect(() => {
        const servicesStr = searchParams.get('services')
        if (servicesStr) {
            setServicesToSync(servicesStr.split(','))
        } else {
            // If no services selected, just go home
            navigate('/')
        }
    }, [searchParams])

    useEffect(() => {
        // Auto-start the first service if something is selected
        if (servicesToSync.length > 0 && currentServiceIndex < servicesToSync.length && !isSyncing && syncedServices.length === 0) {
            handleNextService()
        }
    }, [servicesToSync])

    const handleNextService = () => {
        if (currentServiceIndex < servicesToSync.length) {
            const nextService = servicesToSync[currentServiceIndex]
            if (nextService === 'tidal') {
                setShowModal(true)
            } else {
                // For other services not yet implemented, just skip for now
                setSyncedServices(prev => [...prev, nextService])
                setCurrentServiceIndex(prev => prev + 1)
            }
        } else {
            // All done!
            setTimeout(() => navigate('/'), 2000)
        }
    }

    const handleTidalSuccess = async (response: any) => {
        console.log('[Onboarding] Tidal login success received')
        setShowModal(false)
        setIsSyncing(true)
        try {
            // Call server-side sync for Tidal
            const result = await post('/auth/sync/tidal', { tidalAuthData: response })
            console.log('[Onboarding] Tidal sync complete:', result)
            setSyncedServices(prev => [...prev, 'tidal'])
            setCurrentServiceIndex(prev => prev + 1)
            setIsSyncing(false)

            // Tidal 동기화 완료 후 AI 모델 학습 시작
            await startModelTraining()
        } catch (error: any) {
            console.error('Tidal sync failed:', error)
            alert(`동기화 중 오류가 발생했습니다: ${error.message || 'Unknown error'}`)
            setCurrentServiceIndex(prev => prev + 1)
            setIsSyncing(false)
        }
    }

    const startModelTraining = async () => {
        if (!user) {
            console.error('[Onboarding] User not found for model training')
            return
        }

        // user.id 사용 (Spring Boot 응답 필드명)
        const userId = (user as any).userId || user.id
        console.log('[Onboarding] Starting model training for:', { email: user.email, userId })

        setIsTraining(true)
        setTrainingProgress(0)
        setTrainingStatus('AI 모델 준비 중...')

        let trainingSuccess = false

        try {
            // ==================== 1단계: 플레이리스트 분석 (0-20%) ====================
            setTrainingStatus('플레이리스트 분석 중...')
            for (let i = 0; i <= 20; i += 2) {
                setTrainingProgress(i)
                await new Promise(resolve => setTimeout(resolve, 100))
            }

            // ==================== 2단계: AI 모델 학습 (20-50%) ====================
            setTrainingStatus('AI 모델 학습 중...')
            console.log('[Onboarding] Calling FastAPI init-models...')
            
            // 진행률 시뮬레이션 (학습 중)
            const learningInterval = setInterval(() => {
                setTrainingProgress(prev => {
                    if (prev >= 45) return 45
                    return prev + 1
                })
            }, 200)

            // FastAPI init-models 호출 (학습 + EMS 평가 + GMS 저장까지 한번에)
            const initResponse = await post<any>('/fastapi/init-models', {
                email: user.email,
                userId: userId,
                model: 'M1'
            })

            clearInterval(learningInterval)
            
            console.log('[Onboarding] FastAPI response:', initResponse)
            
            // 학습 성공 조건
            const m1Result = initResponse.models?.M1
            const gmsResult = initResponse.models?.GMS
            const isReallyTrained = initResponse.success && 
                                    initResponse.track_count > 0 && 
                                    m1Result?.status === 'trained'
            
            if (!isReallyTrained && m1Result?.status === 'base_model_copied') {
                // 기본 모델만 복사된 경우 - 재시도
                console.warn('[Onboarding] Only base model copied, retrying...')
                setTrainingStatus('플레이리스트 동기화 대기 중...')
                setTrainingProgress(50)
                
                await new Promise(resolve => setTimeout(resolve, 5000))
                
                const retryResponse = await post<any>('/fastapi/init-models', {
                    email: user.email,
                    userId: userId,
                    model: 'M1'
                })
                
                // 재시도 응답으로 갱신
                Object.assign(initResponse, retryResponse)
            }

            // ==================== 3단계: EMS 곡 평가 (50-80%) ====================
            setTrainingStatus('EMS 곡 평가 중...')
            const gmsTrackCount = gmsResult?.track_count || 0
            console.log(`[Onboarding] GMS tracks: ${gmsTrackCount}`)
            
            for (let i = 50; i <= 80; i += 2) {
                setTrainingProgress(i)
                await new Promise(resolve => setTimeout(resolve, 50))
            }

            // ==================== 4단계: GMS 저장 (80-100%) ====================
            setTrainingStatus('추천 결과 저장 중...')
            for (let i = 80; i <= 95; i += 2) {
                setTrainingProgress(i)
                await new Promise(resolve => setTimeout(resolve, 50))
            }

            // 최종 결과 확인
            const finalM1 = initResponse.models?.M1
            const finalGMS = initResponse.models?.GMS
            const finalSuccess = initResponse.success && (finalM1?.status === 'trained' || finalM1?.status === 'base_model_copied')
            
            if (finalSuccess) {
                setTrainingProgress(100)
                const trackCount = initResponse.track_count || 0
                const gmsCount = finalGMS?.track_count || 0
                
                if (trackCount > 0 && gmsCount > 0) {
                    setTrainingStatus(`완료! ${trackCount}곡 학습, ${gmsCount}곡 추천 생성`)
                } else if (trackCount > 0) {
                    setTrainingStatus(`학습 완료! (${trackCount}곡)`)
                } else {
                    setTrainingStatus('기본 모델로 시작합니다')
                }
                
                setTrainingComplete(true)
                trainingSuccess = true
                
                console.log('[Onboarding] Training complete:', {
                    trackCount,
                    gmsCount,
                    models: initResponse.models
                })
            } else {
                console.warn('[Onboarding] Training failed:', initResponse)
                setTrainingProgress(100)
                setTrainingStatus('학습 실패')
                setTrainingComplete(false)
                trainingSuccess = false
            }
        } catch (error) {
            console.error('[Onboarding] AI 모델 학습 실패:', error)
            setTrainingProgress(100)
            setTrainingStatus('학습 실패 - 다시 시도해주세요')
            setTrainingComplete(false)
            trainingSuccess = false
        }

        // 학습 성공 시에만 메인으로 이동
        if (trainingSuccess) {
            setTimeout(() => {
                setIsTraining(false)
                navigate('/music/home')
            }, 2000)
        } else {
            // 실패 시 버튼 표시하여 재시도 또는 건너뛰기 가능하도록
            setIsTraining(false)
        }
    }

    useEffect(() => {
        // After one service finishes, wait a bit and trigger next
        if (syncedServices.length > 0 && !isSyncing && !showModal) {
            if (currentServiceIndex < servicesToSync.length) {
                const timer = setTimeout(() => handleNextService(), 1000)
                return () => clearTimeout(timer)
            } else {
                // Finished all
                const timer = setTimeout(() => navigate('/music/home'), 2000)
                return () => clearTimeout(timer)
            }
        }
    }, [currentServiceIndex, isSyncing, showModal])

    return (
        <div className="min-h-screen bg-hud-bg-primary hud-grid-bg flex items-center justify-center p-6">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-hud-accent-primary/10 border border-hud-accent-primary/20 text-hud-accent-primary text-sm font-medium mb-4">
                        <Zap size={14} />
                        <span>Smart Onboarding</span>
                    </div>
                    <h1 className="text-4xl font-bold text-hud-text-primary mb-4 text-glow">
                        환영합니다! 거의 다 왔어요.
                    </h1>
                    <p className="text-hud-text-secondary text-lg">
                        선택하신 음악 서비스들을 연결하여 플레이리스트를 동기화합니다.
                    </p>
                </div>

                <div className="grid gap-4">
                    {servicesToSync.map((service, index) => {
                        const isCompleted = syncedServices.includes(service)
                        const isActive = currentServiceIndex === index && !isCompleted

                        return (
                            <div
                                key={service}
                                className={`hud-card p-6 flex items-center justify-between transition-all duration-500 ${isActive ? 'border-hud-accent-primary bg-hud-accent-primary/5 scale-[1.02]' : 'opacity-70'
                                    } ${isCompleted ? 'border-green-500/50 bg-green-500/5' : ''}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-xl ${service === 'tidal' ? 'bg-black text-white' : 'bg-hud-bg-secondary text-hud-text-muted'
                                        }`}>
                                        {service.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-hud-text-primary capitalize">{service}</h3>
                                        <p className="text-sm text-hud-text-secondary">
                                            {isCompleted ? '동기화 완료' : isActive ? '연결 대기 중...' : '대기 중'}
                                        </p>
                                    </div>
                                </div>

                                {isCompleted ? (
                                    <CheckCircle className="text-green-500 w-8 h-8 animate-in zoom-in duration-300" />
                                ) : isActive ? (
                                    <div className="flex items-center gap-2 text-hud-accent-primary">
                                        <Loader2 className="animate-spin" />
                                        <span className="font-medium">Connecting...</span>
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-hud-border-secondary" />
                                )}
                            </div>
                        )
                    })}
                </div>

                {currentServiceIndex >= servicesToSync.length && syncedServices.length > 0 && (
                    <div className="mt-12 text-center animate-in fade-in zoom-in duration-500">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-2">
                                <ShieldCheck size={40} />
                            </div>
                            <h2 className="text-2xl font-bold text-hud-text-primary">모든 준비가 끝났습니다!</h2>
                            <p className="text-hud-text-secondary">대시보드로 이동하여 음악을 즐겨보세요.</p>
                            <Button
                                variant="primary"
                                glow
                                className="mt-4 px-10 py-3"
                                onClick={() => navigate('/music/home')}
                            >
                                시작하기 <ArrowRight size={18} className="ml-2" />
                            </Button>
                        </div>
                    </div>
                )}

                <div className="mt-8 text-center">
                    <button
                        onClick={() => navigate('/music/home')}
                        className="text-hud-text-muted hover:text-hud-text-primary transition-colors text-sm"
                    >
                        나중에 연결하기
                    </button>
                </div>
            </div>

            <TidalLoginModal
                isOpen={showModal && servicesToSync[currentServiceIndex] === 'tidal'}
                onClose={() => setShowModal(false)}
                onSuccess={handleTidalSuccess}
            />

            {/* AI 모델 학습 프로그레스 모달 */}
            {isTraining && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-hud-bg-card border border-hud-border-secondary rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
                        <div className="flex flex-col items-center gap-6">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${trainingComplete ? 'bg-teal-500/20' : 'bg-hud-accent-primary/20'}`}>
                                {trainingComplete ? (
                                    <CheckCircle className="w-10 h-10 text-teal-400" />
                                ) : (
                                    <Brain className="w-10 h-10 text-hud-accent-primary animate-pulse" />
                                )}
                            </div>

                            <div className="text-center">
                                <h2 className="text-xl font-bold text-hud-text-primary mb-2">
                                    {trainingComplete ? '준비 완료!' : 'AI 모델 학습 중'}
                                </h2>
                                <p className="text-hud-text-secondary text-sm">
                                    {trainingStatus}
                                </p>
                            </div>

                            <div className="w-full">
                                <div className="h-2 bg-hud-bg-secondary rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 ease-out ${trainingComplete ? 'bg-teal-400' : 'bg-gradient-to-r from-hud-accent-primary to-hud-accent-info'}`}
                                        style={{ width: `${Math.min(trainingProgress, 100)}%` }}
                                    />
                                </div>
                                <p className="text-center text-xs text-hud-text-muted mt-2">
                                    {Math.round(trainingProgress)}%
                                </p>
                            </div>

                            {!trainingComplete && (
                                <p className="text-xs text-hud-text-muted text-center">
                                    당신의 음악 취향을 분석하고 있습니다.<br />
                                    잠시만 기다려 주세요...
                                </p>
                            )}

                            {trainingComplete && (
                                <p className="text-sm text-teal-400 text-center">
                                    맞춤 추천이 준비되었습니다!
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Onboarding
