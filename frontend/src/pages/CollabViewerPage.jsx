import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'

export default function CollabViewerPage() {
    const [searchParams] = useSearchParams()
    const sessionId = searchParams.get('sessionid')
    const navigate = useNavigate()

    const [pdfFilename, setPdfFilename] = useState('')
    const [multiFilenames, setMultiFilenames] = useState([])
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [connectedUsers, setConnectedUsers] = useState(0)
    const [annotations, setAnnotations] = useState([])
    const [sessionError, setSessionError] = useState('')
    const [copied, setCopied] = useState(false)

    // Annotation tool state
    const [annotationTool, setAnnotationTool] = useState('none') // 'none' | 'highlight' | 'draw'
    const [annotationColor, setAnnotationColor] = useState('#FFB830')
    const [isDrawing, setIsDrawing] = useState(false)
    const [currentPath, setCurrentPath] = useState([])

    const socketRef = useRef(null)
    const messagesEndRef = useRef()
    const canvasRef = useRef()
    const currentPdfRef = useRef(pdfFilename)

    useEffect(() => {
        currentPdfRef.current = pdfFilename
    }, [pdfFilename])

    const username = useRef('User-' + Math.random().toString(36).substring(2, 6)).current

    // ─── Connect to session ────────────────────────────────────
    useEffect(() => {
        if (!sessionId) {
            setSessionError('No session ID provided.')
            return
        }

        fetch(`/api/session/${sessionId}/info`)
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    setSessionError(data.error)
                    return
                }
                setPdfFilename(data.pdf_filename)
                setMultiFilenames(data.multi_pdf_filenames || [])
                setAnnotations(data.annotations || [])
                setConnectedUsers(data.connected_users || 0)

                const existingMsgs = (data.chat_messages || []).flatMap(entry => [
                    { role: 'user', content: `<b>${entry.sender}:</b> ${entry.message}` },
                    { role: 'bot', content: entry.aiResponse }
                ])
                setMessages([
                    { role: 'bot', content: `👋 Welcome to the collaborative session! You're viewing <strong>${data.pdf_filename}</strong>` },
                    ...existingMsgs
                ])
            })
            .catch(() => setSessionError('Failed to load session.'))

        const socket = io({ transports: ['websocket', 'polling'] })
        socketRef.current = socket

        socket.on('connect', () => {
            socket.emit('join_session', { sessionId, username })
        })

        socket.on('session_state', (state) => {
            setAnnotations(state.annotations || [])
            setConnectedUsers(state.connected_users || 0)
        })

        socket.on('user_joined', (data) => {
            setConnectedUsers(data.connected_users || 0)
        })

        socket.on('user_left', (data) => {
            setConnectedUsers(data.connected_users || 0)
        })

        socket.on('chat_update', (entry) => {
            setMessages(prev => [
                ...prev,
                { role: 'user', content: `<b>${entry.sender}:</b> ${entry.message}` },
                { role: 'bot', content: entry.aiResponse }
            ])
        })

        socket.on('annotation_update', (data) => {
            if (data.filename === currentPdfRef.current || !data.filename) {
                setAnnotations(prev => {
                    const valid = Array.isArray(prev) ? prev : []
                    return [...valid, data.annotation || data]
                })
            }
        })

        socket.on('pdf_switched', (data) => {
            setPdfFilename(data.filename)
            setAnnotations(data.annotations || [])
        })

        return () => {
            socket.emit('leave_session', { sessionId, username })
            socket.disconnect()
        }
    }, [sessionId])

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    // ─── Redraw annotations ───────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        annotations.forEach(ann => {
            if (!ann || !ann.type) return
            ctx.strokeStyle = ann.color || '#FFB830'
            ctx.lineWidth = ann.lineWidth || 3
            if (ann.type === 'draw' && ann.path?.length > 1) {
                ctx.beginPath()
                ctx.moveTo(ann.path[0].x, ann.path[0].y)
                ann.path.forEach(p => ctx.lineTo(p.x, p.y))
                ctx.stroke()
            } else if (ann.type === 'highlight') {
                ctx.fillStyle = (ann.color || '#FFB830') + '55'
                ctx.fillRect(ann.x, ann.y, ann.width, ann.height)
            }
        })
    }, [annotations])

    // ─── Canvas resize ───────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ro = new ResizeObserver(() => {
            canvas.width = canvas.offsetWidth
            canvas.height = canvas.offsetHeight
        })
        ro.observe(canvas)
        return () => ro.disconnect()
    }, [])

    // ─── Canvas mouse handlers ────────────────────────────────
    const handleCanvasMouseDown = (e) => {
        if (annotationTool === 'none') return
        const rect = canvasRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        setIsDrawing(true)
        if (annotationTool === 'draw') setCurrentPath([{ x, y }])
        if (annotationTool === 'highlight') {
            canvasRef.current._startX = x
            canvasRef.current._startY = y
        }
    }

    const handleCanvasMouseMove = (e) => {
        if (!isDrawing || annotationTool === 'none') return
        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const ctx = canvas.getContext('2d')

        if (annotationTool === 'draw') {
            setCurrentPath(prev => {
                const next = [...prev, { x, y }]
                ctx.strokeStyle = annotationColor
                ctx.lineWidth = 3
                ctx.lineCap = 'round'
                if (next.length > 1) {
                    ctx.beginPath()
                    ctx.moveTo(next[next.length - 2].x, next[next.length - 2].y)
                    ctx.lineTo(x, y)
                    ctx.stroke()
                }
                return next
            })
        } else if (annotationTool === 'highlight') {
            const sx = canvas._startX
            const sy = canvas._startY
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            annotations.forEach(ann => {
                if (!ann || !ann.type) return
                ctx.strokeStyle = ann.color || '#FFB830'
                ctx.lineWidth = ann.lineWidth || 3
                if (ann.type === 'draw' && ann.path?.length > 1) {
                    ctx.beginPath()
                    ctx.moveTo(ann.path[0].x, ann.path[0].y)
                    ann.path.forEach(p => ctx.lineTo(p.x, p.y))
                    ctx.stroke()
                } else if (ann.type === 'highlight') {
                    ctx.fillStyle = (ann.color || '#FFB830') + '55'
                    ctx.fillRect(ann.x, ann.y, ann.width, ann.height)
                }
            })
            ctx.fillStyle = annotationColor + '55'
            ctx.fillRect(sx, sy, x - sx, y - sy)
        }
    }

    const handleCanvasMouseUp = (e) => {
        if (!isDrawing) return
        setIsDrawing(false)
        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        let annotation = null
        if (annotationTool === 'draw' && currentPath.length > 1) {
            annotation = { type: 'draw', path: currentPath, color: annotationColor, lineWidth: 3 }
        } else if (annotationTool === 'highlight') {
            annotation = {
                type: 'highlight',
                x: canvas._startX, y: canvas._startY,
                width: x - canvas._startX, height: y - canvas._startY,
                color: annotationColor
            }
        }

        if (annotation) {
            setAnnotations(prev => [...(Array.isArray(prev) ? prev : []), annotation])
            socketRef.current?.emit('new_annotation', { sessionId, annotation, filename: currentPdfRef.current })
        }
        setCurrentPath([])
    }

    // ─── Send message ─────────────────────────────────────────
    const sendMessage = async (text) => {
        if (!text.trim() || loading) return
        setInput('')
        setLoading(true)
        try {
            const res = await fetch(`/api/session/${sessionId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, sender: username })
            })
            // Response is broadcast via socket. If socket fails, show locally.
            if (!res.ok) {
                const data = await res.json()
                setMessages(prev => [...prev, { role: 'bot', content: data.error || 'Error getting response.' }])
            }
        } catch {
            setMessages(prev => [...prev, { role: 'bot', content: 'Network error. Please try again.' }])
        } finally {
            setLoading(false)
        }
    }

    // ─── Switch PDF ───────────────────────────────────────────
    const handleSwitchPdf = (fname) => {
        if (fname === pdfFilename) return
        setPdfFilename(fname)
        socketRef.current?.emit('switch_pdf', { sessionId, filename: fname, username })
    }

    // ─── Copy link ────────────────────────────────────────────
    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // ─── Error state ──────────────────────────────────────────
    if (sessionError) {
        return (
            <div className="viewer-page">
                <div className="collab-error">
                    <div className="collab-error-icon">❌</div>
                    <h2>Session Not Found</h2>
                    <p>{sessionError}</p>
                    <button className="btn btn-primary" onClick={() => navigate('/')}>
                        ← Go to Upload Page
                    </button>
                </div>
            </div>
        )
    }

    // ─── Render ───────────────────────────────────────────────
    return (
        <div className="viewer-page">
            {/* Collab Banner */}
            <div className="collab-banner">
                <div className="collab-banner-left">
                    <span className="collab-live-dot" />
                    <span className="collab-label">LIVE COLLAB</span>
                    <span className="collab-session-id">Session: {sessionId}</span>
                </div>
                <div className="collab-banner-center">
                    <span className="collab-users-badge">
                        👥 {connectedUsers} online
                    </span>
                </div>
                <div className="collab-banner-right">
                    <button className="collab-copy-btn" onClick={handleCopyLink}>
                        {copied ? '✅ Copied!' : '📋 Copy Link'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Exit</button>
                </div>
            </div>

            <div className="viewer-layout">
                {/* Sidebar — only show for multi-PDF */}
                {multiFilenames.length > 0 && (
                    <div className="viewer-sidebar">
                        <div className="sidebar-header">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                            Documents
                        </div>
                        <div className="sidebar-list">
                            {multiFilenames.map((fname, idx) => (
                                <div
                                    key={idx}
                                    className={`sidebar-item${pdfFilename === fname ? ' active' : ''}`}
                                    onClick={() => handleSwitchPdf(fname)}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                    <span className="sidebar-item-name">{fname}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* PDF Panel with Annotation Overlay */}
                <div className="pdf-panel">
                    <div className="pdf-panel-header">
                        <div className="pdf-panel-info">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                            <span className="pdf-panel-title">{pdfFilename || 'Loading...'}</span>
                        </div>
                        {/* Annotation Toolbar */}
                        <div className="annotation-toolbar">
                            <button
                                className={`anno-btn${annotationTool === 'none' ? ' active' : ''}`}
                                onClick={() => setAnnotationTool('none')}
                                title="Pointer"
                            >🖱️</button>
                            <button
                                className={`anno-btn${annotationTool === 'highlight' ? ' active' : ''}`}
                                onClick={() => setAnnotationTool('highlight')}
                                title="Highlight"
                            >🟨</button>
                            <button
                                className={`anno-btn${annotationTool === 'draw' ? ' active' : ''}`}
                                onClick={() => setAnnotationTool('draw')}
                                title="Draw"
                            >✏️</button>
                            <input
                                type="color"
                                value={annotationColor}
                                onChange={e => setAnnotationColor(e.target.value)}
                                className="anno-color-picker"
                                title="Annotation Color"
                            />
                        </div>
                    </div>

                    <div className="pdf-canvas-container">
                        {pdfFilename && (
                            <iframe
                                className="pdf-iframe"
                                src={`/api/session/${sessionId}/pdf`}
                                title="PDF Viewer"
                                key={pdfFilename}
                            />
                        )}
                        <canvas
                            ref={canvasRef}
                            className={`annotation-canvas${annotationTool !== 'none' ? ' active' : ''}`}
                            onMouseDown={handleCanvasMouseDown}
                            onMouseMove={handleCanvasMouseMove}
                            onMouseUp={handleCanvasMouseUp}
                            onMouseLeave={handleCanvasMouseUp}
                        />
                    </div>
                </div>

                {/* Chat Panel */}
                <div className="chat-panel">
                    <div className="chat-panel-header">
                        <div className="chat-panel-header-top">
                            <div className="chat-ai-avatar">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                            </div>
                            <div>
                                <div className="chat-panel-title">AI Assistant</div>
                                <div className="chat-panel-sub">
                                    Collaborative • {connectedUsers} user{connectedUsers !== 1 ? 's' : ''} connected
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="chat-messages">
                        {messages.map((m, i) => (
                            <div key={i} className={`message ${m.role}`}>
                                <div className="msg-avatar">
                                    {m.role === 'bot' ? (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                    ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                    )}
                                </div>
                                <div
                                    className="msg-bubble"
                                    dangerouslySetInnerHTML={{ __html: m.content }}
                                />
                            </div>
                        ))}

                        {loading && (
                            <div className="typing-indicator">
                                <div className="msg-avatar">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                </div>
                                <div className="typing-dots">
                                    <span /><span /><span />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="chat-input-area">
                        <div className="chat-input-row">
                            <input
                                className="chat-input"
                                placeholder="Ask a question (shared with all users)…"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        sendMessage(input)
                                    }
                                }}
                                maxLength={500}
                                disabled={loading}
                            />
                            <button
                                className="send-btn"
                                onClick={() => sendMessage(input)}
                                disabled={loading || !input.trim()}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
