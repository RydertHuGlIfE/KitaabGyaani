import { useState, useEffect, useRef, useCallback } from 'react'
import { startRecording, stopRecording, pauseRecording, resumeRecording } from '../modules/recorder'

export default function ScreenRecorder({ onClose }) {
    const [phase, setPhase] = useState('setup') // setup | recording | preview
    const [useMic, setUseMic] = useState(true)
    const [isPaused, setIsPaused] = useState(false)
    const [elapsed, setElapsed] = useState(0)
    const [blobUrl, setBlobUrl] = useState(null)
    const [blob, setBlob] = useState(null)
    const [error, setError] = useState(null)

    const timerRef = useRef(null)

    const startTimer = () => {
        setElapsed(0)
        timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    }

    const stopTimer = () => {
        clearInterval(timerRef.current)
        timerRef.current = null
    }

    useEffect(() => () => {
        stopTimer()
        if (blobUrl) URL.revokeObjectURL(blobUrl)
    }, [])

    const handleStart = useCallback(async () => {
        setError(null)
        try {
            const result = await startRecording({
                useMic,
                onStop: (recordedBlob) => {
                    const url = URL.createObjectURL(recordedBlob)
                    setBlobUrl(url)
                    setBlob(recordedBlob)
                    stopTimer()
                    setPhase('preview')
                },
                onError: (err) => {
                    stopTimer()
                    setPhase('setup')
                    if (err.name === 'NotAllowedError') {
                        setError('Screen capture permission denied.')
                    } else {
                        setError(`Recording error: ${err.message}`)
                    }
                },
            })

            if (result) {
                setPhase('recording')
                setIsPaused(false)
                startTimer()
            }
        } catch (err) {
            setError('Failed to start recording.')
        }
    }, [useMic])

    const handleStop = useCallback(() => {
        stopRecording()
        stopTimer()
    }, [])

    const handlePause = useCallback(() => {
        if (isPaused) {
            resumeRecording()
            setIsPaused(false)
            timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
        } else {
            pauseRecording()
            setIsPaused(true)
            clearInterval(timerRef.current)
        }
    }, [isPaused])

    const handleCancel = useCallback(() => {
        stopRecording()
        stopTimer()
        setPhase('setup')
        setElapsed(0)
        setIsPaused(false)
    }, [])

    const handleDownload = useCallback(() => {
        if (!blob) return
        const a = document.createElement('a')
        a.href = blobUrl
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        a.download = `KitaabGyaani-Recording-${timestamp}.webm`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    }, [blob, blobUrl])

    const handleReRecord = useCallback(() => {
        if (blobUrl) URL.revokeObjectURL(blobUrl)
        setBlobUrl(null)
        setBlob(null)
        setElapsed(0)
        setPhase('setup')
    }, [blobUrl])

    const formatTime = (secs) => {
        const m = String(Math.floor(secs / 60)).padStart(2, '0')
        const s = String(secs % 60).padStart(2, '0')
        return `${m}:${s}`
    }

    const formatSize = (bytes) => {
        if (!bytes) return ''
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    }

    // ── Recording phase: render a compact floating bar (no overlay) ──
    if (phase === 'recording') {
        return (
            <div className="recorder-floating-bar">
                <span className={`recorder-status-dot ${isPaused ? 'paused' : 'live'}`} />
                <span className="recorder-float-timer">{formatTime(elapsed)}</span>

                <div className="recorder-float-divider" />

                <button className="recorder-float-btn" onClick={handlePause} title={isPaused ? 'Resume' : 'Pause'}>
                    {isPaused ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                    )}
                </button>

                <button className="recorder-float-stop" onClick={handleStop} title="Stop Recording">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                </button>

                <button className="recorder-float-btn recorder-float-cancel" onClick={() => { handleCancel(); onClose(); }} title="Cancel">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
            </div>
        )
    }

    // ── Setup & Preview phases: render as modal ──
    return (
        <div className="subtopic-modal-overlay" onClick={phase === 'setup' ? onClose : undefined}>
            <div className="subtopic-modal screen-recorder-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="screen-recorder-header">
                    <h2>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="4" fill="currentColor" />
                        </svg>
                        Screen Recorder
                    </h2>
                    <button className="close-modal-btn" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="screen-recorder-body">
                    {/* ── Setup Phase ── */}
                    {phase === 'setup' && (
                        <div className="recorder-setup">
                            <div className="recorder-setup-icon">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--coral)" strokeWidth="1.5">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                    <line x1="8" y1="21" x2="16" y2="21" />
                                    <line x1="12" y1="17" x2="12" y2="21" />
                                </svg>
                            </div>

                            <p className="recorder-setup-desc">
                                Record your screen while studying. The recording saves locally to your device.
                            </p>

                            <div className="recorder-toggle-row" onClick={() => setUseMic(v => !v)}>
                                <div className={`recorder-toggle-switch ${useMic ? 'on' : ''}`}>
                                    <div className="recorder-toggle-knob" />
                                </div>
                                <div className="recorder-toggle-info">
                                    <span className="recorder-toggle-title">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                            <line x1="12" y1="19" x2="12" y2="23" />
                                            <line x1="8" y1="23" x2="16" y2="23" />
                                        </svg>
                                        Microphone
                                    </span>
                                    <span className="recorder-toggle-desc">Include your voice narration</span>
                                </div>
                            </div>

                            {error && (
                                <div className="recorder-error">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                                    </svg>
                                    {error}
                                </div>
                            )}

                            <button className="btn btn-primary recorder-start-btn" onClick={handleStart}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                    <circle cx="12" cy="12" r="8" />
                                </svg>
                                Start Recording
                            </button>

                            <p className="recorder-hint">You'll be prompted to choose a screen, window, or tab</p>
                        </div>
                    )}

                    {/* ── Preview Phase ── */}
                    {phase === 'preview' && (
                        <div className="recorder-preview">
                            <div className="recorder-preview-badge">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                Recording Complete
                            </div>

                            <video
                                className="recorder-video-preview"
                                src={blobUrl}
                                controls
                                autoPlay={false}
                            />

                            <div className="recorder-preview-info">
                                <span>Duration: {formatTime(elapsed)}</span>
                                {blob && <span>Size: {formatSize(blob.size)}</span>}
                            </div>

                            <div className="recorder-preview-actions">
                                <button className="btn btn-primary" onClick={handleDownload}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                    Download Recording
                                </button>
                                <button className="btn btn-secondary" onClick={handleReRecord}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                    </svg>
                                    Re-record
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
