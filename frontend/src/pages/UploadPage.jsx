import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export default function UploadPage() {
    const [file, setFile] = useState(null)
    const [dragOver, setDragOver] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const inputRef = useRef()
    const navigate = useNavigate()

    const handleFile = (f) => {
        if (!f || f.type !== 'application/pdf') {
            setError('Please select a valid PDF file.')
            return
        }
        if (f.size > 4 * 1024 * 1024) {
            setError('File too large. Maximum size is 40MB.')
            return
        }
        setError('')
        setFile(f)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setDragOver(false)
        const f = e.dataTransfer.files[0]
        handleFile(f)
    }

    const handleChange = (e) => handleFile(e.target.files[0])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!file) return

        setLoading(true)
        setError('')

        const form = new FormData()
        form.append('pdf_file', file)

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 120000)

        try {
            const res = await fetch('/upload-pdf', {
                method: 'POST',
                body: form,
                signal: controller.signal
            })
            clearTimeout(timeout)
            const data = await res.json()
            if (data.success) {
                navigate('/viewer')
            } else {
                throw new Error(data.error || 'Upload failed')
            }
        } catch (err) {
            clearTimeout(timeout)
            setLoading(false)
            setError(
                err.name === 'AbortError'
                    ? 'Upload timed out. Try a smaller file.'
                    : err.message
            )
        }
    }

    const sizeMB = file ? (file.size / (1024 * 1024)).toFixed(2) : null

    return (
        <div className="upload-page">
            <div className="upload-card">
                <h1 className="upload-title">Upload your PDF</h1>
                <p className="upload-subtitle">
                    Drag &amp; drop or click to browse — AI will analyse it instantly
                </p>

                {loading ? (
                    <div className="loading-state">
                        <div className="spinner" />
                        <div className="loading-text">Processing your PDF…</div>
                        {file && (
                            <div className="loading-detail">
                                {file.name} &nbsp;({sizeMB} MB)
                            </div>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {/* Drop Zone */}
                        <div
                            className={`drop-zone${dragOver ? ' drag-over' : ''}`}
                            onClick={() => inputRef.current.click()}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                        >
                            <input
                                ref={inputRef}
                                type="file"
                                accept=".pdf"
                                style={{ display: 'none' }}
                                onChange={handleChange}
                            />
                            <div className="drop-icon">📄</div>
                            <div className="drop-text-main">
                                {file ? file.name : 'Drop your PDF here or click to browse'}
                            </div>
                            <div className="drop-text-sub">
                                {file
                                    ? `${sizeMB} MB · PDF`
                                    : 'Maximum file size: 4 MB'}
                            </div>
                        </div>

                        {error && (
                            <div className="error-state" style={{ marginBottom: 16 }}>
                                <div className="error-icon">⚠️</div>
                                <div className="error-title">Error</div>
                                <div className="error-msg">{error}</div>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '12px' }}
                            disabled={!file}
                        >
                            🚀 &nbsp;Start AI Analysis
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}
