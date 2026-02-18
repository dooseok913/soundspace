import { Settings, Brain, Cpu, Sparkles, Check, Loader2, RefreshCw, Info, Zap, Music, BarChart3, Database, Hash } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { fastapiService, AIModel } from '../../services/api/fastapi'

// AI 모델 정보
const AI_MODELS = [
    {
        id: 'M1',
        name: 'Audio Feature Model',
        description: 'Ridge Regression 기반 오디오 피처 예측 모델',
        details: '오디오 특성(danceability, energy, tempo 등)을 분석하여 사용자 취향을 예측합니다.',
        icon: Music,
        color: 'hud-accent-primary',
        features: ['오디오 피처 분석', '빠른 추론 속도', '실시간 피드백 학습'],
        accuracy: '85%',
        speed: '빠름',
        status: 'active'
    },
    {
        id: 'M2',
        name: 'SVM + Text Embedding',
        description: 'SentenceTransformer + SVM 기반 하이브리드 모델',
        details: '384차원 텍스트 임베딩과 9차원 오디오 피처를 결합한 393D 피처로 정밀한 추천을 제공합니다.',
        icon: Brain,
        color: 'hud-accent-warning',
        features: ['텍스트 임베딩 (384D)', '오디오 역추적', 'Last.fm 태그 활용'],
        accuracy: '99.95%',
        speed: '보통',
        status: 'available'
    },
    {
        id: 'M3',
        name: 'CatBoost Recommender',
        description: 'CatBoost 기반 협업 필터링 추천 모델',
        details: 'PMS 플레이리스트 분석 후 유사한 취향의 트랙을 EMS에서 찾아 추천합니다.',
        icon: Cpu,
        color: 'hud-accent-success',
        features: ['협업 필터링', '장르 기반 추천', '유클리드 거리 계산'],
        accuracy: '92%',
        speed: '빠름',
        status: 'available'
    }
]

interface ModelStatus {
    M1: { healthy: boolean; loaded: boolean; training: boolean }
    M2: { healthy: boolean; loaded: boolean; training: boolean }
    M3: { healthy: boolean; loaded: boolean; training: boolean }
}

// EMS 곡 수 옵션
const EMS_TRACK_OPTIONS = [
    { value: 50, label: '50곡', description: '빠른 추천' },
    { value: 100, label: '100곡', description: '기본값 (권장)' },
    { value: 200, label: '200곡', description: '더 다양한 추천' },
    { value: 300, label: '300곡', description: '폭넓은 탐색' },
    { value: 500, label: '500곡', description: '최대 탐색' }
]

const MusicSettings = () => {
    const { user } = useAuth()
    const [selectedModel, setSelectedModel] = useState<string>('M1')
    const [emsTrackLimit, setEmsTrackLimit] = useState<number>(100)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
    const [modelStatus, setModelStatus] = useState<ModelStatus>({
        M1: { healthy: false, loaded: false, training: false },
        M2: { healthy: false, loaded: false, training: false },
        M3: { healthy: false, loaded: false, training: false }
    })
    const [checkingStatus, setCheckingStatus] = useState(false)

    // Show toast helper
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    // Load user's model preference
    useEffect(() => {
        const loadPreference = async () => {
            // First check localStorage
            const localModel = fastapiService.getSelectedModel()
            if (localModel) {
                setSelectedModel(localModel)
            }
            
            const localLimit = localStorage.getItem('ems_track_limit')
            if (localLimit) {
                setEmsTrackLimit(parseInt(localLimit))
            }
            
            // Then try to load from API
            if (!user?.id) return
            try {
                const response = await fetch('/api/user/preferences', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    }
                })
                if (response.ok) {
                    const data = await response.json()
                    if (data.aiModel) {
                        setSelectedModel(data.aiModel)
                        fastapiService.setSelectedModel(data.aiModel as AIModel)
                    }
                    if (data.emsTrackLimit) {
                        setEmsTrackLimit(data.emsTrackLimit)
                        localStorage.setItem('ems_track_limit', data.emsTrackLimit.toString())
                    }
                }
            } catch (error) {
                console.error('Failed to load preferences:', error)
            }
        }
        loadPreference()
    }, [user?.id])

    // Check model health status
    const checkModelStatus = async () => {
        setCheckingStatus(true)
        const newStatus: ModelStatus = {
            M1: { healthy: false, loaded: false, training: false },
            M2: { healthy: false, loaded: false, training: false },
            M3: { healthy: false, loaded: false, training: false }
        }

        try {
            // Check all models via FastAPI /health endpoint (via /api/fastapi/health)
            const healthResponse = await fetch('/api/fastapi/health')
            if (healthResponse.ok) {
                const healthData = await healthResponse.json()
                newStatus.M1 = { healthy: healthData.models?.M1 || false, loaded: healthData.models?.M1 || false, training: false }
                newStatus.M2 = { healthy: healthData.models?.M2 || false, loaded: healthData.models?.M2 || false, training: false }
                newStatus.M3 = { healthy: healthData.models?.M3 || false, loaded: healthData.models?.M3 || false, training: false }
            }
        } catch (e) {
            console.error('Health check failed:', e)
        }

        setModelStatus(newStatus)
        setCheckingStatus(false)
    }

    useEffect(() => {
        checkModelStatus()
    }, [])

    // Save model preference
    const handleSelectModel = async (modelId: string) => {
        setSaving(true)
        
        // Always save to localStorage first
        fastapiService.setSelectedModel(modelId as AIModel)
        setSelectedModel(modelId)
        
        // Try to save to API if logged in
        if (user?.id) {
            try {
                const response = await fetch('/api/user/preferences', {
                    method: 'PATCH',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify({ aiModel: modelId })
                })

                if (response.ok) {
                    showToast(`${modelId} 모델이 선택되었습니다`, 'success')
                } else {
                    showToast(`${modelId} 모델이 선택되었습니다 (로컬 저장)`, 'info')
                }
            } catch (error) {
                showToast(`${modelId} 모델이 선택되었습니다 (로컬 저장)`, 'info')
            }
        } else {
            showToast(`${modelId} 모델이 선택되었습니다`, 'success')
        }
        
        setSaving(false)
    }

    // Save EMS track limit
    const handleEmsTrackLimitChange = async (limit: number) => {
        setEmsTrackLimit(limit)
        localStorage.setItem('ems_track_limit', limit.toString())
        
        if (user?.id) {
            try {
                const response = await fetch('/api/user/preferences', {
                    method: 'PATCH',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify({ emsTrackLimit: limit })
                })

                if (response.ok) {
                    showToast(`EMS 곡 수가 ${limit}곡으로 설정되었습니다`, 'success')
                } else {
                    showToast(`EMS 곡 수가 ${limit}곡으로 설정되었습니다 (로컬 저장)`, 'info')
                }
            } catch (error) {
                showToast(`EMS 곡 수가 ${limit}곡으로 설정되었습니다 (로컬 저장)`, 'info')
            }
        } else {
            showToast(`EMS 곡 수가 ${limit}곡으로 설정되었습니다`, 'success')
        }
    }

    // Get status badge color
    const getStatusColor = (modelId: string) => {
        const status = modelStatus[modelId as keyof ModelStatus]
        if (status?.healthy && !status?.training) return 'bg-hud-accent-success/20 text-hud-accent-success border-hud-accent-success/30'
        if (status?.training) return 'bg-hud-accent-warning/20 text-hud-accent-warning border-hud-accent-warning/30'
        return 'bg-hud-accent-danger/20 text-hud-accent-danger border-hud-accent-danger/30'
    }

    const getStatusText = (modelId: string) => {
        const status = modelStatus[modelId as keyof ModelStatus]
        if (status?.training) return '서비스 준비 중'
        if (status?.healthy) return '사용 가능'
        return '서비스 준비 중'
    }

    return (
        <div className="p-4 md:p-6 pb-32">
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
                    toast.type === 'success' 
                        ? 'bg-hud-accent-success/20 border border-hud-accent-success/30 text-hud-accent-success'
                        : toast.type === 'error'
                        ? 'bg-hud-accent-danger/20 border border-hud-accent-danger/30 text-hud-accent-danger'
                        : 'bg-hud-accent-info/20 border border-hud-accent-info/30 text-hud-accent-info'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <section className="hud-card hud-card-bottom rounded-xl p-8 mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-hud-accent-primary/20 rounded-xl flex items-center justify-center">
                            <Settings className="w-7 h-7 text-hud-accent-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-hud-text-primary">Settings</h1>
                            <p className="text-hud-text-secondary">AI 모델 및 앱 설정</p>
                        </div>
                    </div>
                    <button
                        onClick={checkModelStatus}
                        disabled={checkingStatus}
                        className="px-4 py-2 bg-hud-bg-secondary hover:bg-hud-bg-hover rounded-lg flex items-center gap-2 text-hud-text-secondary transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${checkingStatus ? 'animate-spin' : ''}`} />
                        상태 새로고침
                    </button>
                </div>
            </section>

            {/* AI Model Selection */}
            <section className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                    <Sparkles className="w-6 h-6 text-hud-accent-warning" />
                    <h2 className="text-xl font-bold text-hud-text-primary">AI 추천 모델 선택</h2>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {AI_MODELS.map((model) => {
                        const IconComponent = model.icon
                        const isSelected = selectedModel === model.id
                        const status = modelStatus[model.id as keyof ModelStatus]
                        
                        return (
                            <div
                                key={model.id}
                                className={`hud-card rounded-xl overflow-hidden transition-all cursor-pointer ${
                                    isSelected 
                                        ? `ring-2 ring-${model.color} shadow-lg shadow-${model.color}/20` 
                                        : 'hover:bg-hud-bg-hover'
                                }`}
                                onClick={() => handleSelectModel(model.id)}
                            >
                                {/* Model Header */}
                                <div className={`p-6 border-b border-hud-border-secondary ${
                                    isSelected ? `bg-${model.color}/10` : ''
                                }`}>
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                            isSelected 
                                                ? `bg-${model.color}/30` 
                                                : 'bg-hud-bg-secondary'
                                        }`}>
                                            <IconComponent className={`w-6 h-6 ${
                                                isSelected 
                                                    ? `text-${model.color}` 
                                                    : 'text-hud-text-muted'
                                            }`} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* Status Badge */}
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(model.id)}`}>
                                                {getStatusText(model.id)}
                                            </span>
                                            {/* Selected Badge */}
                                            {isSelected && (
                                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-hud-accent-primary/20 text-hud-accent-primary border border-hud-accent-primary/30 flex items-center gap-1">
                                                    <Check className="w-3 h-3" />
                                                    선택됨
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <h3 className={`text-lg font-bold mb-1 ${
                                        isSelected ? 'text-hud-text-primary' : 'text-hud-text-secondary'
                                    }`}>
                                        {model.id}: {model.name}
                                    </h3>
                                    <p className="text-sm text-hud-text-muted">
                                        {model.description}
                                    </p>
                                </div>
                                
                                {/* Model Details */}
                                <div className="p-6">
                                    <p className="text-sm text-hud-text-secondary mb-4">
                                        {model.details}
                                    </p>
                                    
                                    {/* Features */}
                                    <div className="space-y-2 mb-4">
                                        {model.features.map((feature, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-sm">
                                                <Check className="w-4 h-4 text-hud-accent-success" />
                                                <span className="text-hud-text-secondary">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/* Stats */}
                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-hud-border-secondary">
                                        <div className="text-center">
                                            <div className="flex items-center justify-center gap-1 text-hud-text-muted text-xs mb-1">
                                                <BarChart3 className="w-3 h-3" />
                                                정확도
                                            </div>
                                            <div className="text-lg font-bold text-hud-accent-success">
                                                {model.accuracy}
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="flex items-center justify-center gap-1 text-hud-text-muted text-xs mb-1">
                                                <Zap className="w-3 h-3" />
                                                속도
                                            </div>
                                            <div className="text-lg font-bold text-hud-accent-primary">
                                                {model.speed}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Select Button */}
                                <div className="px-6 pb-6">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleSelectModel(model.id)
                                        }}
                                        disabled={saving || !status?.healthy || status?.training}
                                        className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                                            isSelected
                                                ? 'bg-hud-accent-primary text-hud-bg-primary'
                                                : status?.healthy && !status?.training
                                                ? 'bg-hud-bg-secondary hover:bg-hud-bg-hover text-hud-text-primary'
                                                : 'bg-hud-bg-secondary text-hud-text-muted cursor-not-allowed'
                                        }`}
                                    >
                                        {saving ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : isSelected ? (
                                            <>
                                                <Check className="w-4 h-4" />
                                                현재 사용 중
                                            </>
                                        ) : status?.training || !status?.healthy ? (
                                            '서비스 준비 중'
                                        ) : (
                                            '이 모델 사용하기'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>

            {/* EMS Track Limit Section */}
            <section className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                    <Database className="w-6 h-6 text-hud-accent-primary" />
                    <h2 className="text-xl font-bold text-hud-text-primary">EMS 분석 곡 수</h2>
                </div>
                
                <div className="hud-card rounded-xl p-6">
                    <p className="text-hud-text-secondary mb-6">
                        AI 추천 생성 시 EMS(External Music Space)에서 분석할 곡 수를 설정합니다. 
                        곡 수가 많을수록 다양한 추천을 받을 수 있지만, 처리 시간이 길어집니다.
                    </p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {EMS_TRACK_OPTIONS.map((option) => {
                            const isSelected = emsTrackLimit === option.value
                            
                            return (
                                <button
                                    key={option.value}
                                    onClick={() => handleEmsTrackLimitChange(option.value)}
                                    className={`p-4 rounded-xl border-2 transition-all ${
                                        isSelected
                                            ? 'border-hud-accent-primary bg-hud-accent-primary/10'
                                            : 'border-hud-border-secondary hover:border-hud-border-primary hover:bg-hud-bg-hover'
                                    }`}
                                >
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <Hash className={`w-4 h-4 ${isSelected ? 'text-hud-accent-primary' : 'text-hud-text-muted'}`} />
                                        <span className={`text-xl font-bold ${isSelected ? 'text-hud-accent-primary' : 'text-hud-text-primary'}`}>
                                            {option.label}
                                        </span>
                                    </div>
                                    <p className={`text-xs ${isSelected ? 'text-hud-accent-primary' : 'text-hud-text-muted'}`}>
                                        {option.description}
                                    </p>
                                    {isSelected && (
                                        <div className="mt-2 flex justify-center">
                                            <Check className="w-4 h-4 text-hud-accent-primary" />
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                    
                    <div className="mt-4 p-3 bg-hud-bg-secondary/50 rounded-lg">
                        <p className="text-sm text-hud-text-muted">
                            <strong className="text-hud-text-secondary">현재 설정:</strong> EMS에서 
                            <span className="text-hud-accent-primary font-bold mx-1">{emsTrackLimit}곡</span>
                            을 분석하여 추천을 생성합니다.
                        </p>
                    </div>
                </div>
            </section>

            {/* Info Section */}
            <section className="hud-card rounded-xl p-6">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-hud-accent-info/20 flex items-center justify-center flex-shrink-0">
                        <Info className="w-5 h-5 text-hud-accent-info" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-hud-text-primary mb-2">AI 모델 안내</h3>
                        <ul className="space-y-2 text-sm text-hud-text-secondary">
                            <li>
                                <strong className="text-hud-accent-primary">M1</strong>: 기본 모델로, 빠른 속도와 실시간 피드백 학습이 특징입니다. 
                                트랙 삭제 시 즉시 모델이 재학습됩니다.
                            </li>
                            <li>
                                <strong className="text-hud-accent-warning">M2</strong>: 최고 정확도의 하이브리드 모델입니다. 
                                텍스트 임베딩과 오디오 피처를 결합하여 정밀한 추천을 제공합니다.
                            </li>
                            <li>
                                <strong className="text-hud-accent-success">M3</strong>: CatBoost 기반 협업 필터링 모델입니다. 
                                PMS 데이터가 충분할 때 가장 좋은 성능을 발휘합니다.
                            </li>
                        </ul>
                    </div>
                </div>
            </section>
        </div>
    )
}

export default MusicSettings
