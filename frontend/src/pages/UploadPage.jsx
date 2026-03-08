import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export default function UploadPage() {
    const [mode, setMode] = useState('single')   // 'single' | 'multi'
    const navigate = useNavigate()

    return (
        <div className="upload-page">
            <div className="upload-card">
                <h1 className="upload-title">Upload your PDF</h1>
                <p className="upload-subtitle">
                    Drag &amp; drop or click to browse — AI will analyse it instantly
                </p>

                {/* Mode Toggle */}
                <div className="mode-tabs">
                    <button
                        className={`mode-tab${mode === 'single' ? ' active' : ''}`}
                        onClick={() => setMode('single')}
                    >
                        Single PDF
                    </button>
                    <button
                        className={`mode-tab${mode === 'multi' ? ' active' : ''}`}
                        onClick={() => setMode('multi')}
                    >
                        Multiple PDFs
                    </button>
                </div>

                {mode === 'single'
                    ? <SingleUpload navigate={navigate} />
                    : <MultiUpload navigate={navigate} />
                }
            </div>
        </div>
    )
}

/* ── Single PDF ──────────────────────────────────────────────── */
function SingleUpload({ navigate }) {
    const [file, setFile] = useState(null)
    const [dragOver, setDragOver] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const inputRef = useRef()

    const handleFile = (f) => {
        if (!f || f.type !== 'application/pdf') { setError('Please select a valid PDF file.'); return }
        if (f.size > 4 * 1024 * 1024) { setError('File too large. Maximum size is 4MB.'); return }
        setError(''); setFile(f)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!file) return
        setLoading(true); setError('')
        const form = new FormData()
        form.append('pdf_file', file)
        const ctrl = new AbortController()
        const tid = setTimeout(() => ctrl.abort(), 120000)
        try {
            const res = await fetch('/upload-pdf', { method: 'POST', body: form, signal: ctrl.signal })
            clearTimeout(tid)
            const data = await res.json()
            if (data.success) navigate('/viewer')
            else throw new Error(data.error || 'Upload failed')
        } catch (err) {
            clearTimeout(tid)
            setLoading(false)
            setError(err.name === 'AbortError' ? 'Upload timed out. Try a smaller file.' : err.message)
        }
    }

    const sizeMB = file ? (file.size / (1024 * 1024)).toFixed(2) : null

    if (loading) return (
        <div className="loading-state">
            <div className="spinner" />
            <div className="loading-text">Processing your PDF…</div>
            {file && <div className="loading-detail">{file.name}&nbsp;({sizeMB} MB)</div>}
        </div>
    )

    return (
        <form onSubmit={handleSubmit}>
            <div
                className={`drop-zone${dragOver ? ' drag-over' : ''}`}
                onClick={() => inputRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
            >
                <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
                <div className="drop-icon">📄</div>
                <div className="drop-text-main">{file ? file.name : 'Drop your PDF here or click to browse'}</div>
                <div className="drop-text-sub">{file ? `${sizeMB} MB · PDF` : 'Maximum file size: 4 MB'}</div>
            </div>
            {error && (
                <div className="error-state" style={{ marginBottom: 16 }}>
                    <div className="error-icon">⚠️</div>
                    <div className="error-title">Error</div>
                    <div className="error-msg">{error}</div>
                </div>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={!file}>
                🚀&nbsp;Start AI Analysis
            </button>
        </form>
    )
}

/* ── Multiple PDFs ───────────────────────────────────────────── */
function MultiUpload({ navigate }) {
    const [files, setFiles] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const inputRef = useRef()

    const handleFiles = (fileList) => {
        const arr = Array.from(fileList).filter(f => f.type === 'application/pdf')
        if (arr.length === 0) { setError('Please select valid PDF files.'); return }
        if (arr.length > 5) { setError('Maximum 5 PDFs allowed at once.'); return }
        const oversized = arr.filter(f => f.size > 4 * 1024 * 1024)
        if (oversized.length) { setError(`File(s) exceed 4MB: ${oversized.map(f => f.name).join(', ')}`); return }
        setError(''); setFiles(arr)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (files.length === 0) return
        setLoading(true); setError('')
        const form = new FormData()
        files.forEach(f => form.append('pdf_files[]', f))
        const ctrl = new AbortController()
        const tid = setTimeout(() => ctrl.abort(), 180000)
        try {
            const res = await fetch('/upload-multiple-pdfs', { method: 'POST', body: form, signal: ctrl.signal })
            clearTimeout(tid)
            const data = await res.json()
            if (data.success) navigate('/viewer')
            else throw new Error(data.error || 'Upload failed')
        } catch (err) {
            clearTimeout(tid)
            setLoading(false)
            setError(err.name === 'AbortError' ? 'Upload timed out. Try fewer or smaller files.' : err.message)
        }
    }

    if (loading) return (
        <div className="loading-state">
            <div className="spinner" />
            <div className="loading-text">Processing {files.length} PDF(s) with AI…</div>
            <div className="loading-detail">{files.map(f => f.name).join(', ')}</div>
        </div>
    )

    return (
        <form onSubmit={handleSubmit}>
            <div
                className="drop-zone"
                onClick={() => inputRef.current.click()}
                style={{ cursor: 'pointer' }}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    style={{ display: 'none' }}
                    onChange={e => handleFiles(e.target.files)}
                />
                <div className="drop-icon">📚</div>
                <div className="drop-text-main">
                    {files.length > 0 ? `${files.length} PDF${files.length > 1 ? 's' : ''} selected` : 'Click to select up to 5 PDFs'}
                </div>
                <div className="drop-text-sub">
                    {files.length > 0
                        ? files.map(f => f.name).join(' · ')
                        : 'Hold Ctrl / ⌘ to select multiple · Max 4 MB each'}
                </div>
            </div>

            {/* File list */}
            {files.length > 0 && (
                <div className="multi-file-list">
                    {files.map((f, i) => (
                        <div key={i} className="multi-file-item">
                            <span className="multi-file-icon">📄</span>
                            <span className="multi-file-name">{f.name}</span>
                            <span className="multi-file-size">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <div className="error-state" style={{ marginBottom: 16 }}>
                    <div className="error-icon">⚠️</div>
                    <div className="error-title">Error</div>
                    <div className="error-msg">{error}</div>
                </div>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: 16 }} disabled={files.length === 0}>
                🚀&nbsp;Analyse All PDFs
            </button>
        </form>
    )
}
