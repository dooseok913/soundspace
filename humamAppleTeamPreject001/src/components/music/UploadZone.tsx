import { Cloud, File } from 'lucide-react'
import { useState } from 'react'

interface UploadZoneProps {
    onFilesSelected?: (files: FileList) => void
    onUrlSubmit?: (url: string) => void
}

const UploadZone = ({ onFilesSelected }: UploadZoneProps) => {
    const [isDragOver, setIsDragOver] = useState(false)

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(true)
    }

    const handleDragLeave = () => {
        setIsDragOver(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
        if (e.dataTransfer.files && onFilesSelected) {
            onFilesSelected(e.dataTransfer.files)
        }
    }

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log('[UploadZone] onChange fired, files:', e.target.files?.length, e.target.files)
        if (e.target.files && onFilesSelected) {
            onFilesSelected(e.target.files)
        } else {
            console.warn('[UploadZone] onFilesSelected missing or no files', { files: e.target.files, onFilesSelected: !!onFilesSelected })
        }
    }

    return (
        <div className="hud-card hud-card-bottom rounded-xl p-8">
            <div
                className={`rounded-xl p-12 text-center cursor-pointer transition-all border-2 border-dashed ${isDragOver
                    ? 'border-hud-accent-warning bg-hud-accent-warning/10 scale-[1.01]'
                    : 'border-hud-border-secondary bg-hud-bg-secondary/50 hover:border-hud-accent-warning/50 hover:bg-hud-bg-hover'
                    }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('fileInput')?.click()}
            >
                <Cloud className={`w-16 h-16 mx-auto mb-6 ${isDragOver ? 'text-hud-accent-warning' : 'text-hud-text-muted'}`} />

                <h3 className="text-xl font-bold text-hud-text-primary mb-2">플레이리스트 파일을 드래그하여 업로드</h3>
                <p className="text-hud-text-muted mb-6">
                    CSV, JSON, M3U, PLS 파일 지원
                </p>

                <div className="flex items-center justify-center gap-4" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => document.getElementById('fileInput')?.click()}
                        className="bg-hud-accent-warning text-hud-bg-primary px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-hud-accent-warning/90 transition-all"
                    >
                        <File className="w-4 h-4" />
                        파일 선택
                    </button>
                </div>

                <input
                    type="file"
                    id="fileInput"
                    className="hidden"
                    accept=".csv,.json,.m3u,.pls"
                    multiple
                    onChange={handleFileInputChange}
                />
            </div>
        </div>
    )
}

export default UploadZone
