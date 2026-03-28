import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import MermaidDiagram from '../components/MermaidDiagram'

export default function CollabViewerPage() {
    const [searchParams] = useSearchParams()
    const sessionId = searchParams.get('sessionid') || searchParams.get('sessionId')
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

    // AI Features State
    const [quizActive, setQuizActive] = useState(false)
    const [showYT, setShowYT] = useState(false)
    const [ytInput, setYtInput] = useState('')
    const [showVisualizer, setShowVisualizer] = useState(false)
    const [mermaidCode, setMermaidCode] = useState('')
    const [selectedNode, setSelectedNode] = useState(null)
    const [subtopicContent, setSubtopicContent] = useState('')
    const [loadingVisualize, setLoadingVisualize] = useState(false)
    const [loadingSubtopic, setLoadingSubtopic] = useState(false)
 
    // Whiteboard State
    const [showWhiteboard, setShowWhiteboard] = useState(false)
    const [whiteboardHeight, setWhiteboardHeight] = useState(250)
    const [whiteboardAnnotations, setWhiteboardAnnotations] = useState([])
    const whiteboardCanvasRef = useRef()
    const isResizingRef = useRef(false)
 
    // Annotation tool state
    const [annotationTool, setAnnotationTool] = useState('none') // 'none' | 'highlight' | 'draw' | 'eraser'
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
                setWhiteboardAnnotations(data.whiteboard_annotations || [])
                setConnectedUsers(data.connected_users || 0)


                const existingMsgs = (data.chat_messages || []).flatMap(entry => [
                    { role: 'user', content: `<b>${entry.sender}:</b> ${entry.message}` },
                    { role: 'bot', content: entry.aiResponse }
                ])
                setMessages([
                    { role: 'bot', content: `Welcome to the collaborative session! You're viewing <strong>${data.pdf_filename}</strong>` },
                    ...existingMsgs
                ])

                if (data.quiz) {
                    setQuizActive(true)
                }
                if (data.visualize_state) {
                    setMermaidCode(data.visualize_state)
                    setShowVisualizer(true)
                }
            })
            .catch(() => setSessionError('Failed to load session.'))

        const socket = io({ transports: ['websocket', 'polling'] })
        socketRef.current = socket

        socket.on('connect', () => {
            socket.emit('join_session', { sessionId, username })
        })

        socket.on('session_state', (state) => {
            setAnnotations(state.annotations || [])
            setWhiteboardAnnotations(state.whiteboard_annotations || [])
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

        socket.on('quiz_started', (data) => {
            setQuizActive(true)
            setMessages(prev => [...prev, { role: 'bot', content: data.chat_entry.aiResponse }])
        })

        socket.on('quiz_answered', (data) => {
            setMessages(prev => [...prev, { role: 'bot', content: data.chat_entry.aiResponse }])
            if (!data.quiz_state) setQuizActive(false)
        })

        socket.on('visualize_update', (data) => {
            setMermaidCode(data.mermaidCode)
            setShowVisualizer(true)
            setLoadingVisualize(false)
        })

        socket.on('annotations_cleared', (data) => {
            if (data.filename === currentPdfRef.current) {
                setAnnotations([])
            }
        })
 
        socket.on('whiteboard_update', (data) => {
            console.log('Received whiteboard sync:', data)
            setWhiteboardAnnotations(prev => [...prev, data.annotation])
        })
 
        socket.on('whiteboard_cleared', () => {
            setWhiteboardAnnotations([])
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
            } else if (ann.type === 'eraser' && ann.path?.length > 1) {
                ann.path.forEach(p => {
                    ctx.clearRect(p.x - 10, p.y - 10, 20, 20)
                })
            }
        })
    }, [annotations])
 
    // ─── Whiteboard Redraw logic ──────────────────────────────
    const redrawWhiteboard = useCallback(() => {
        const canvas = whiteboardCanvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
 
        whiteboardAnnotations.forEach(ann => {
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
            } else if (ann.type === 'eraser' && ann.path?.length > 1) {
                ann.path.forEach(p => {
                    ctx.clearRect(p.x - 10, p.y - 10, 20, 20)
                })
            }
        })
    }, [whiteboardAnnotations])
 
    useEffect(() => {
        redrawWhiteboard()
    }, [redrawWhiteboard, showWhiteboard])



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

    useEffect(() => {
        const canvas = whiteboardCanvasRef.current
        if (!canvas) return
        const ro = new ResizeObserver(() => {
            if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
                canvas.width = canvas.offsetWidth
                canvas.height = canvas.offsetHeight
                redrawWhiteboard()
            }
        })
        ro.observe(canvas)
        return () => ro.disconnect()
    }, [showWhiteboard, redrawWhiteboard])


    // --- Optimized Whiteboard Resizing ---
    const [isResizingWB, setIsResizingWB] = useState(false)
    const startResizing = (e) => {
        e.preventDefault()
        setIsResizingWB(true)
        isResizingRef.current = true
        document.addEventListener('mousemove', handleResizing)
        document.addEventListener('mouseup', stopResizing)
    }

    const handleResizing = (e) => {
        if (!isResizingRef.current) return
        const newHeight = window.innerHeight - e.clientY - 40 // adjusted padding
        const clampedHeight = Math.max(100, Math.min(window.innerHeight * 0.7, newHeight))
        document.documentElement.style.setProperty('--whiteboard-height', `${clampedHeight}px`)
    }

    const stopResizing = () => {
        setIsResizingWB(false)
        isResizingRef.current = false
        document.removeEventListener('mousemove', handleResizing)
        document.removeEventListener('mouseup', stopResizing)
    }



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
        } else if (annotationTool === 'eraser') {
            setCurrentPath(prev => {
                const next = [...prev, { x, y }]
                ctx.clearRect(x - 10, y - 10, 20, 20)
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
                } else if (ann.type === 'eraser' && ann.path?.length > 1) {
                    ann.path.forEach(p => {
                        ctx.clearRect(p.x - 10, p.y - 10, 20, 20)
                    })
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
        } else if (annotationTool === 'eraser' && currentPath.length > 1) {
            annotation = { type: 'eraser', path: currentPath, lineWidth: 20 }
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

    // --- Whiteboard Canvas Handlers ---
    const handleWBMouseDown = (e) => {
        if (annotationTool === 'none') return
        const rect = whiteboardCanvasRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        setIsDrawing(true)
        if (annotationTool === 'draw') setCurrentPath([{ x, y }])
    }

    const handleWBMouseMove = (e) => {
        if (!isDrawing || annotationTool === 'none') return
        const canvas = whiteboardCanvasRef.current
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
        } else if (annotationTool === 'eraser') {
            setCurrentPath(prev => {
                const next = [...prev, { x, y }]
                ctx.clearRect(x - 10, y - 10, 20, 20)
                return next
            })
        }
    }

    const handleWBMouseUp = (e) => {
        if (!isDrawing) return
        setIsDrawing(false)
        let annotation = null
        if (annotationTool === 'draw' && currentPath.length > 1) {
            annotation = { type: 'draw', path: currentPath, color: annotationColor, lineWidth: 3 }
        } else if (annotationTool === 'eraser' && currentPath.length > 1) {
            annotation = { type: 'eraser', path: currentPath, lineWidth: 20 }
        }

        if (annotation) {
            setWhiteboardAnnotations(prev => [...prev, annotation])
            console.log('Sending whiteboard sync:', annotation)
            socketRef.current?.emit('new_whiteboard_annotation', { sessionId, annotation })
        }
        setCurrentPath([])
    }


    const handleClearWhiteboard = () => {
        if (!window.confirm("Clear the entire whiteboard for everyone?")) return
        setWhiteboardAnnotations([])
        socketRef.current?.emit('clear_whiteboard', { sessionId })
    }


    const handleClearAnnotations = () => {
        if (!window.confirm("Are you sure you want to clear all annotations for this document? This will clear them for everyone.")) return
        setAnnotations([])
        socketRef.current?.emit('clear_annotations', { sessionId, filename: pdfFilename })
    }


    // ─── Actions ──────────────────────────────────────────────
    const handleSummarize = async () => {
        setLoading(true)
        try {
            await fetch(`/api/session/${sessionId}/summarize`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender: username })
            })
        } catch { setMessages(prev => [...prev, { role: 'bot', content: 'Network Error.' }]) }
        finally { setLoading(false) }
    }

    const handleMindmap = async () => {
        setLoading(true)
        try {
            await fetch(`/api/session/${sessionId}/mindmap`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender: username })
            })
        } catch { setMessages(prev => [...prev, { role: 'bot', content: 'Network Error.' }]) }
        finally { setLoading(false) }
    }

    const handleVisualize = async () => {
        setShowVisualizer(true)
        setLoadingVisualize(true)
        setMermaidCode('')
        setSelectedNode(null)
        setSubtopicContent('')
        try {
            await fetch(`/api/session/${sessionId}/visualize`, { method: 'POST' })
        } catch {}
    }

    const handleNodeClick = async (id, label) => {
        setSelectedNode({ id, label })
        setSubtopicContent('')
        setLoadingSubtopic(true)
        try {
            const res = await fetch('/visualize/subtopic', { 
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subtopic_name: label })
            })
            const data = await res.json()
            setSubtopicContent(data.content || 'Failed to load content.')
        } catch { setSubtopicContent('Error connecting to server.') }
        finally { setLoadingSubtopic(false) }
    }

    const handleStartQuiz = async () => {
        setLoading(true)
        try {
            await fetch(`/api/session/${sessionId}/quiz/start`, { method: 'POST' })
        } catch {} 
        finally { setLoading(false) }
    }

    const handleYTSummarize = async () => {
        if (!ytInput.trim()) return
        setShowYT(false)
        const url = ytInput
        setYtInput('')
        setLoading(true)
        try {
            await fetch(`/api/session/${sessionId}/youtube/summarize`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, sender: username })
            })
        } catch { setMessages(prev => [...prev, { role: 'bot', content: 'Error loading YouTube summary.' }]) }
        finally { setLoading(false) }
    }

    // ─── Send message ─────────────────────────────────────────
    const sendMessage = async (text) => {
        if (!text.trim() || loading) return
        if (!quizActive) { 
            // Only add local user message visual for non-quiz, quiz chat entries are formulated by server wrapper.
            // Actually ViewerPage also adds local user message, let's just send the endpoint.
        }
        setInput('')
        setLoading(true)
        try {
            const endpoint = quizActive ? `/api/session/${sessionId}/quiz/answer` : `/api/session/${sessionId}/chat`
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quizActive ? { answer: text, sender: username } : { message: text, sender: username })
            })
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

    const handleSyncSession = () => {
        setLoading(true)
        socketRef.current?.emit('join_session', { sessionId, username })
        fetch(`/api/session/${sessionId}/info`)
            .then(r => r.json())
            .then(data => {
                if (!data.error) {
                    setAnnotations(data.annotations || [])
                    setConnectedUsers(data.connected_users || 0)
                }
            })
            .finally(() => setLoading(false))
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                        {connectedUsers} online
                    </span>
                </div>
                <div className="collab-banner-right">
                    <button className="collab-copy-btn" onClick={handleSyncSession} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                        Sync State
                    </button>
                    <button className="collab-copy-btn" onClick={handleCopyLink} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {copied ? (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                                Copied!
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>
                                Copy Link
                            </>
                        )}
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
                        {showVisualizer && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowVisualizer(false)}>✕ Close Flowchart</button>
                        )}
                        {/* Annotation Toolbar */}
                        <div className="annotation-toolbar">
                            <button
                                className={`anno-btn${annotationTool === 'none' ? ' active' : ''}`}
                                onClick={() => setAnnotationTool('none')}
                                title="Pointer"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 7.07m0 0l10.93 10.93M10.07 10.07L3 17m0 0h7.07m0 0v-7.07" /></svg>
                            </button>
                            <button
                                className={`anno-btn${annotationTool === 'highlight' ? ' active' : ''}`}
                                onClick={() => setAnnotationTool('highlight')}
                                title="Highlight"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l5.586-5.586a2 2 0 0 1 2.828 0l5.586 5.586M5 12L3 14m0 0l7 7h8l2-2" /><path d="M12 7l-5 5m5-5l5 5" /></svg>
                            </button>
                            <button
                                className={`anno-btn${annotationTool === 'draw' ? ' active' : ''}`}
                                onClick={() => setAnnotationTool('draw')}
                                title="Draw"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17.6v3.4a1 1 0 0 0 1 1h3.4M15.4 3H20a1 1 0 0 1 1 1v4.6M7 7l10 10M3.5 18.5l14.14-14.14a2 2 0 0 1 2.83 0l2.83 2.83a2 2 0 0 1 0 2.83l-14.14 14.14" /></svg>
                            </button>
                            <button
                                className={`anno-btn${annotationTool === 'eraser' ? ' active' : ''}`}
                                onClick={() => setAnnotationTool('eraser')}
                                title="Eraser"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 3H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-6 14l7-7m-7 7H5m14 0l-7-7m7 7v-4" /><circle cx="18" cy="18" r="1.5" /></svg>
                            </button>
                            <input
                                type="color"
                                value={annotationColor}
                                onChange={e => setAnnotationColor(e.target.value)}
                                className="anno-color-picker"
                                title="Annotation Color"
                            />
                            <button
                                className="anno-btn"
                                onClick={handleClearAnnotations}
                                title="Clear All Annotations"
                                style={{ marginLeft: '8px', color: '#ef4444' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></svg>
                            </button>
                            <button
                                className={`anno-btn${showWhiteboard ? ' active' : ''}`}
                                onClick={() => setShowWhiteboard(p => !p)}
                                title="Toggle Whiteboard"
                                style={{ marginLeft: '8px', color: 'var(--teal)' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                            </button>
                        </div>


                    </div>

                    {showVisualizer ? (
                        <div className="visualizer-content" style={{flex: 1, position: 'relative', overflow: 'auto', background: 'var(--surface)'}}>
                            {loadingVisualize ? (
                                <div className="loading-state">
                                    <div className="spinner" />
                                    <div className="loading-text">Generating flowchart with AI...</div>
                                </div>
                            ) : mermaidCode ? (
                                <div className="mermaid-wrapper">
                                    <MermaidDiagram code={mermaidCode} onNodeClick={handleNodeClick} />
                                </div>
                            ) : (
                                <div className="empty-state">No flowchart generated.</div>
                            )}
                        </div>
                    ) : (
                        <div className="pdf-viewport-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                            <div className="pdf-canvas-container" style={{ flex: 1, position: 'relative', minHeight: 0 }}>
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

                            {showWhiteboard && (
                                <>
                                    <div 
                                        className="whiteboard-resizer" 
                                        onMouseDown={startResizing}
                                    />
                                    {isResizingWB && <div className="whiteboard-resizer-overlay" />}
                                    <div className="whiteboard-container">

                                        <div className="whiteboard-header" style={{ padding: '4px 12px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>COLLABORATIVE WHITEBOARD</span>
                                            <button className="btn btn-ghost btn-sm" onClick={handleClearWhiteboard} style={{ padding: '2px 8px', fontSize: '10px' }}>Clear</button>
                                        </div>
                                        <canvas
                                            ref={whiteboardCanvasRef}
                                            className="whiteboard-canvas"
                                            style={{ flex: 1, cursor: annotationTool !== 'none' ? 'crosshair' : 'default' }}
                                            onMouseDown={handleWBMouseDown}
                                            onMouseMove={handleWBMouseMove}
                                            onMouseUp={handleWBMouseUp}
                                            onMouseLeave={handleWBMouseUp}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                </div>

                {/* Chat Panel */}
                <div className="chat-panel">
                    <div className="chat-panel-header">
                        <div className="chat-panel-header-top">
                            <div className="chat-ai-avatar">
                                <img src="/ai-avatar.png" alt="AI Assistant" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            </div>
                            <div>
                                <div className="chat-panel-title">AI Assistant</div>
                                <div className="chat-panel-sub">
                                    Collaborative • {connectedUsers} user{connectedUsers !== 1 ? 's' : ''} connected
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="action-buttons">
                        <button className="action-btn" onClick={handleSummarize} disabled={loading}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" /></svg>
                            {multiFilenames.length > 1 ? 'Summarize All' : 'Summarize'}
                        </button>
                        <button className="action-btn" onClick={handleMindmap} disabled={loading || loadingVisualize}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 1v4" /><path d="M12 19v4" /><path d="M4.22 4.22l2.83 2.83" /><path d="M16.95 16.95l2.83 2.83" /></svg>
                            {multiFilenames.length > 1 ? 'Mind Map (All)' : 'Mind Map'}
                        </button>
                        <button className="action-btn" onClick={handleVisualize} disabled={loading || loadingVisualize}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                            {multiFilenames.length > 1 ? 'Visualize (All)' : 'Visualize'}
                        </button>
                        <button className="action-btn" onClick={handleStartQuiz} disabled={loading}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            {multiFilenames.length > 1 ? 'Quiz All' : 'Quiz'}
                        </button>
                        {/* YT Summarize hidden temporarily
                        <button className="action-btn" onClick={() => setShowYT(p => !p)} disabled={loading}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                            YT Summarize
                        </button>
                        */}
                    </div>

                    {/* Messages */}
                    <div className="chat-messages">
                        {messages.map((m, i) => (
                            <div key={i} className={`message ${m.role}`}>
                                <div className="msg-avatar">
                                    {m.role === 'bot' ? (
                                        <img src="/ai-avatar.png" alt="AI Assistant" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
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
                                    <img src="/ai-avatar.png" alt="AI Assistant" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
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
                        {showYT && (
                            <div className="youtube-search-bar">
                                <input
                                    className="chat-input"
                                    placeholder="Paste YouTube Link for Summary..."
                                    value={ytInput}
                                    onChange={e => setYtInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleYTSummarize()
                                        if (e.key === 'Escape') setShowYT(false)
                                    }}
                                    autoFocus
                                />
                                <button className="send-btn" onClick={handleYTSummarize}>Summarize</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowYT(false)}>✕</button>
                            </div>
                        )}
                        <div className="chat-input-row">
                            <input
                                className="chat-input"
                                placeholder={quizActive ? 'Type A / B / C / D or your answer…' : 'Ask a question (shared with all users)…'}
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

            {selectedNode && (
                <div className="subtopic-modal-overlay" onClick={() => setSelectedNode(null)}>
                    <div className="subtopic-modal" onClick={e => e.stopPropagation()}>
                        <div className="subtopic-modal-header">
                            <h2>{selectedNode.label}</h2>
                            <button className="close-modal-btn" onClick={() => setSelectedNode(null)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="subtopic-modal-body">
                            {loadingSubtopic ? (
                                <div className="loading-state">
                                    <div className="spinner" />
                                    <div className="loading-text">Loading notes from AI...</div>
                                </div>
                            ) : (
                                <div 
                                    className="markdown-content" 
                                    dangerouslySetInnerHTML={{ 
                                        __html: subtopicContent
                                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                            .replace(/#{3,}\s*(.*?)\n/g, '<h3>$1</h3>')
                                            .replace(/#{1,2}\s*(.*?)\n/g, '<h2>$1</h2>')
                                            .replace(/\n\n/g, '<br><br>')
                                            .replace(/\n- /g, '<br>• ') 
                                    }} 
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
