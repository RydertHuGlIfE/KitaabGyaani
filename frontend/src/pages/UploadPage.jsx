import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'


export default function UploadPage() {
    const [mode, setMode] = useState('single')
    const navigate = useNavigate()

    return (
        <div className="upload-page">
            {/* Floating decorative icons */}
            <div className="floating-shapes">
                {/* Geometric shapes (existing) */}
                <div className="shape shape-1" />
                <div className="shape shape-2" />
                <div className="shape shape-3" />

                {/* Material-style floating icons */}
                {/* Book open */}
                <svg className="float-icon fi-1" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>

                {/* Lightbulb */}
                <svg className="float-icon fi-2" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
                </svg>

                {/* Chat bubble */}
                <svg className="float-icon fi-3" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>

                {/* Document / File text */}
                <svg className="float-icon fi-4" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
                </svg>

                {/* Brain / Mind */}
                <svg className="float-icon fi-5" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a5 5 0 0 1 5 5c0 1.1-.4 2.1-1 2.9.6.8 1 1.8 1 2.9a5 5 0 0 1-5 5 5 5 0 0 1-5-5c0-1.1.4-2.1 1-2.9A4.9 4.9 0 0 1 7 7a5 5 0 0 1 5-5z" /><path d="M12 2v20" />
                </svg>

                {/* Quiz / Help circle */}
                <svg className="float-icon fi-6" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>

                {/* Sparkle / Stars */}
                <svg className="float-icon fi-7" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>

                {/* Pencil / Edit */}
                <svg className="float-icon fi-8" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>

                {/* Search */}
                <svg className="float-icon fi-9" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>

                {/* Bookmark */}
                <svg className="float-icon fi-10" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>

                {/* Graduation cap */}
                <svg className="float-icon fi-11" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" /><path d="M2 7v6" /><path d="M6 9.3V16a6 3 0 0 0 12 0V9.3" />
                </svg>

                {/* Zap / Lightning */}
                <svg className="float-icon fi-12" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
            </div>

            <div className="upload-container">
                {/* Hero */}
                <div className="upload-hero">
                    <div className="hero-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                        Powered by AI
                    </div>
                    <h1 className="upload-title">
                        Study smarter with
                        <span className="gradient-text"> KitaabGyaani</span>
                    </h1>
                    <p className="upload-subtitle">
                        Upload your PDFs and let AI instantly analyze, summarize, quiz you, and create mind maps — all in one place.
                    </p>
                </div>

                {/* Upload Card */}
                <div className="upload-card">
                    <div className="card-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span>Upload Documents</span>
                    </div>

                    {/* Mode Toggle */}
                    <div className="mode-tabs">
                        <div className="mode-tab-bg" style={{ transform: mode === 'single' ? 'translateX(0)' : 'translateX(100%)' }} />
                        <button
                            className={`mode-tab${mode === 'single' ? ' active' : ''}`}
                            onClick={() => setMode('single')}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                            Single PDF
                        </button>
                        <button
                            className={`mode-tab${mode === 'multi' ? ' active' : ''}`}
                            onClick={() => setMode('multi')}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>
                            Multiple PDFs
                        </button>
                    </div>

                    {mode === 'single'
                        ? <SingleUpload navigate={navigate} />
                        : <MultiUpload navigate={navigate} />
                    }
                </div>

                {/* Features Grid */}
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon feature-icon-chat">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                        </div>
                        <h3>AI Chat</h3>
                        <p>Ask any question about your documents and get instant answers</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon feature-icon-summary">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" /></svg>
                        </div>
                        <h3>Summarize</h3>
                        <p>Get comprehensive summaries of your study materials</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon feature-icon-mindmap">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v4" /><path d="M12 19v4" /><path d="M4.22 4.22l2.83 2.83" /><path d="M16.95 16.95l2.83 2.83" /><path d="M1 12h4" /><path d="M19 12h4" /><path d="M4.22 19.78l2.83-2.83" /><path d="M16.95 7.05l2.83-2.83" /></svg>
                        </div>
                        <h3>Mind Map</h3>
                        <p>Visualize key concepts and their connections</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon feature-icon-quiz">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                        </div>
                        <h3>Quiz Mode</h3>
                        <p>Test your knowledge with AI-generated MCQ &amp; theory questions</p>
                    </div>
                </div>



                {/* Mascot */}
                <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 10, animation: 'float 3s ease-in-out infinite' }}>
                    <img src="/icebear.png" alt="KitaabGyaani Mascot" style={{ width: '180px', height: 'auto', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.15))', borderRadius: '8px' }} />
                </div>

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
            if (!res.ok) {
                const text = await res.text()
                throw new Error(`Server error (${res.status}): ${text || res.statusText}`)
            }
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
                className={`drop-zone${dragOver ? ' drag-over' : ''}${file ? ' has-file' : ''}`}
                onClick={() => inputRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
            >
                <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
                <div className="drop-icon-wrap">
                    {file ? (
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="drop-icon-svg success">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                    ) : (
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="drop-icon-svg">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                    )}
                </div>
                <div className="drop-text-main">{file ? file.name : 'Drop your PDF here or click to browse'}</div>
                <div className="drop-text-sub">{file ? `${sizeMB} MB · PDF` : 'Maximum file size: 4 MB'}</div>
            </div>
            {error && (
                <div className="error-state">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                    <span>{error}</span>
                </div>
            )}
            <button type="submit" className="btn btn-primary btn-upload" disabled={!file}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                Start AI Analysis
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
        files.forEach(f => form.append('pdf_files', f))
        const ctrl = new AbortController()
        const tid = setTimeout(() => ctrl.abort(), 180000)
        try {
            const res = await fetch('/upload-multiple-pdfs', { method: 'POST', body: form, signal: ctrl.signal })
            clearTimeout(tid)
            if (!res.ok) {
                const text = await res.text()
                throw new Error(`Server error (${res.status}): ${text || res.statusText}`)
            }
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
                <div className="drop-icon-wrap">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="drop-icon-svg">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    </svg>
                </div>
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
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                            <span className="multi-file-name">{f.name}</span>
                            <span className="multi-file-size">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <div className="error-state">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                    <span>{error}</span>
                </div>
            )}
            <button type="submit" className="btn btn-primary btn-upload" disabled={files.length === 0}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                Analyse All PDFs
            </button>
        </form>
    )
}
