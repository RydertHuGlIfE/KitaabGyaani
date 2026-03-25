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
    const [annotationColor, setAnnotationColor] = useState('#fbbf24')
    const [isDrawing, setIsDrawing] = useState(false)
    const [currentPath, setCurrentPath] = useState([])

    const socketRef = useRef(null)
    const messagesEndRef = useRef()
    const canvasRef = useRef()
    const currentPdfRef = useRef(pdfFilename)

    // Keep ref in sync with state
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

        // Fetch session info
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

                // Load existing chat messages
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

        // SocketIO connection
        const socket = io({ transports: ['websocket', 'polling'] })
        socketRef.current = socket

        socket.on('connect', () => {
            socket.emit('join_session', { sessionId, username })
        })

        socket.on('session_state', (state) => {
            setAnnotations(state.annotations || [])
            setConnectedUsers(state.connected_users || 0)
        })

        socket.on('chat_update', (entry) => {
            setMessages(prev => [
                ...prev,
                { role: 'user', content: `<b>${entry.sender}:</b> ${entry.message}` },
                { role: 'bot', content: entry.aiResponse }
            ])
        })

        socket.on('annotation_update', (data) => {
            // Only add annotation if it's for the currently viewed PDF
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
            setMessages(prev => [...prev, {
                role: 'bot',
                content: `<span style="color:#06b6d4;">📄 <b>${data.username}</b> switched the document to <strong>${data.filename}</strong></span>`
            }])
        })

        socket.on('user_joined', (data) => {
            setConnectedUsers(data.connected_users)
            setMessages(prev => [...prev, {
                role: 'bot',
                content: `<span style="color:#a855f7;">👤 ${data.username} joined the session</span>`
            }])
        })

        socket.on('user_left', (data) => {
            setConnectedUsers(data.connected_users)
            setMessages(prev => [...prev, {
                role: 'bot',
                content: `<span style="color:#94a3b8;">👤 ${data.username} left the session</span>`
            }])
        })

        return () => {
            socket.emit('leave_session', { sessionId, username })
            socket.disconnect()
        }
    }, [sessionId])

    // ─── Auto-scroll chat ──────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    // ─── Draw annotations on canvas ────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')

        // Match canvas size to container
        const container = canvas.parentElement
        canvas.width = container.offsetWidth
        canvas.height = container.offsetHeight

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw all annotations
        const validAnnotations = Array.isArray(annotations) ? annotations : []
        validAnnotations.forEach(ann => {
            if (ann.type === 'highlight') {
                ctx.fillStyle = ann.color || 'rgba(251,191,36,0.3)'
                ctx.fillRect(ann.x, ann.y, ann.width, ann.height)
            } else if (ann.type === 'draw' && ann.points?.length > 1) {
                ctx.strokeStyle = ann.color || '#ef4444'
                ctx.lineWidth = 3
                ctx.lineCap = 'round'
                ctx.lineJoin = 'round'
                ctx.beginPath()
                ctx.moveTo(ann.points[0].x, ann.points[0].y)
                ann.points.forEach(p => ctx.lineTo(p.x, p.y))
                ctx.stroke()
            }
        })
    }, [annotations])

    // ─── Helpers ───────────────────────────────────────────────
    const addMessage = (role, content) => {
        setMessages(prev => [...prev, { role, content }])
    }

    const sendMessage = async (text) => {
        if (!text.trim() || loading) return
        addMessage('user', text)
        setInput('')
        setLoading(true)

        try {
            const res = await fetch(`/api/session/${sessionId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, sender: username })
            })
            const data = await res.json()
            if (data.error) {
                addMessage('bot', data.error)
            }
            // Response is broadcast via socket, no need to add locally
            // unless the socket event doesn't fire for the sender
        } catch {
            addMessage('bot', 'Network error. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleCopyLink = async () => {
        const link = window.location.href
        await navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleSwitchPdf = (filename) => {
        if (filename === pdfFilename || loading) return
        
        // Optimistically set the filename and drop current annotations
        setPdfFilename(filename)
        setAnnotations([])
        
        socketRef.current?.emit('switch_pdf', {
            sessionId,
            filename,
            username
        })
    }

    // ─── Canvas mouse handlers for annotations ─────────────────
    const getCanvasPos = (e) => {
        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()
        return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const handleCanvasMouseDown = (e) => {
        if (annotationTool === 'none') return
        setIsDrawing(true)
        const pos = getCanvasPos(e)
        setCurrentPath([pos])
    }

    const handleCanvasMouseMove = (e) => {
        if (!isDrawing || annotationTool === 'none') return
        const pos = getCanvasPos(e)
        setCurrentPath(prev => [...prev, pos])

        // Live preview for drawing
        if (annotationTool === 'draw') {
            const canvas = canvasRef.current
            const ctx = canvas.getContext('2d')
            if (currentPath.length > 0) {
                const last = currentPath[currentPath.length - 1]
                ctx.strokeStyle = annotationColor
                ctx.lineWidth = 3
                ctx.lineCap = 'round'
                ctx.beginPath()
                ctx.moveTo(last.x, last.y)
                ctx.lineTo(pos.x, pos.y)
                ctx.stroke()
            }
        }
    }

    const handleCanvasMouseUp = () => {
        if (!isDrawing || annotationTool === 'none') return
        setIsDrawing(false)

        let annotation = null

        if (annotationTool === 'highlight' && currentPath.length >= 2) {
            const start = currentPath[0]
            const end = currentPath[currentPath.length - 1]
            annotation = {
                type: 'highlight',
                x: Math.min(start.x, end.x),
                y: Math.min(start.y, end.y),
                width: Math.abs(end.x - start.x),
                height: Math.abs(end.y - start.y),
                color: annotationColor.replace(')', ',0.3)').replace('rgb', 'rgba'),
                user: username
            }
        } else if (annotationTool === 'draw' && currentPath.length >= 2) {
            annotation = {
                type: 'draw',
                points: currentPath,
                color: annotationColor,
                user: username
            }
        }

        if (annotation) {
            setAnnotations(prev => [...prev, annotation])
            socketRef.current?.emit('new_annotation', {
                sessionId,
                annotation,
                filename: pdfFilename
            })
        }

        setCurrentPath([])
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

    // ─── Render ──────────────────────────────────────────────
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
                </div>
            </div>

            <div className="viewer-layout">
                {/* Sidebar - only show if multiple PDFs */}
                {multiFilenames.length > 0 && (
                    <div className="viewer-sidebar">
                        <div className="sidebar-header">Documents</div>
                        <div className="sidebar-list">
                            {multiFilenames.map((fname, idx) => (
                                <div
                                    key={idx}
                                    className={`sidebar-item${pdfFilename === fname ? ' active' : ''}`}
                                    onClick={() => handleSwitchPdf(fname)}
                                >
                                    <span className="sidebar-item-icon">📄</span>
                                    <span className="sidebar-item-name">{fname}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* PDF Panel with Annotation Overlay */}
                <div className="pdf-panel">
                    <div className="pdf-panel-header">
                        <span className="pdf-panel-title">
                            📄 {pdfFilename || 'Loading...'}
                        </span>
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
                                key={pdfFilename} // Important to force reload
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
                        <div className="chat-panel-title">🤖 AI Assistant</div>
                        <div className="chat-panel-sub">
                            Collaborative session • {connectedUsers} user{connectedUsers !== 1 ? 's' : ''} connected
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="chat-messages">
                        {messages.map((m, i) => (
                            <div key={i} className={`message ${m.role}`}>
                                <div className="msg-avatar">
                                    {m.role === 'bot' ? '🤖' : '👤'}
                                </div>
                                <div
                                    className="msg-bubble"
                                    dangerouslySetInnerHTML={{ __html: m.content }}
                                />
                            </div>
                        ))}

                        {loading && (
                            <div className="typing-indicator">
                                <div className="msg-avatar">🤖</div>
                                <div className="typing-dots">
                                    <span /><span /><span />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
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
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
