import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import MermaidDiagram from '../components/MermaidDiagram'
import SpaceInvadersGame from '../components/SpaceInvadersGame'
import BineuralBeats from '../components/BineuralBeats'
import '../components/SpaceInvaders.css'

export default function ViewerPage() {
    const [messages, setMessages] = useState([
        { role: 'bot', content: "Hello! I've analysed your PDF. Ask me anything about it." }
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [pdfFilename, setPdfFilename] = useState('')
    const [multiFilenames, setMultiFilenames] = useState([])
    const [quizActive, setQuizActive] = useState(false)
    const [quizMode, setQuizMode] = useState('none')
    const [showQuizSelection, setShowQuizSelection] = useState(false)
    const [mcqGameState, setMcqGameState] = useState(null)
    const [showYT, setShowYT] = useState(false)
    const [ytInput, setYtInput] = useState('')
    const [showBineural, setShowBineural] = useState(false)

    // Visualizer States
    const [showVisualizer, setShowVisualizer] = useState(false)
    const [loadingVisualize, setLoadingVisualize] = useState(false)
    const [mermaidCode, setMermaidCode] = useState('')
    const [selectedNode, setSelectedNode] = useState(null)
    const [subtopicContent, setSubtopicContent] = useState('')
    const [loadingSubtopic, setLoadingSubtopic] = useState(false)
    const messagesEndRef = useRef()
    const inputRef = useRef()
    const navigate = useNavigate()

    useEffect(() => {
        fetch('/get-pdf-info')
            .then(r => r.json())
            .then(d => {
                if (d.filename) {
                    setPdfFilename(d.filename)
                    setMultiFilenames(d.multi_pdf_filenames || [])
                } else navigate('/')
            })
            .catch(() => navigate('/'))
    }, [])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    const addMessage = (role, content) => {
        setMessages(prev => [...prev, { role, content }])
    }

    const sendMessage = async (text) => {
        if (!text.trim() || loading) return
        addMessage('user', text)
        setInput('')
        setLoading(true)

        try {
            if (quizActive || quizMode === 'theory') {
                const res = await fetch('/quiz/answer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ answer: text })
                })
                const data = await res.json()

                if (data.result) {
                    const correct = data.result.is_correct
                    addMessage('bot', correct
                        ? ' Correct!'
                        : ` Incorrect. Right answer: <strong>${data.result.correct_answer}</strong>`)
                }
                if (data.message) addMessage('bot', data.message)
                if (data.feedback) addMessage('bot', `<b>Feedback:</b><br>${data.feedback}`)
                if (data.next_question) {
                    const opts = data.options ? `<br><i>Options: ${data.options.join(', ')}</i>` : ''
                    addMessage('bot', `<b>Next Question:</b> ${data.next_question}${opts}`)
                }
                if (data.all_results) {
                    setQuizActive(false)
                    let html = '<h3>📜 Quiz Summary</h3>'
                    data.all_results.forEach(item => {
                        if (item.is_correct !== undefined) {
                            html += `<div style="margin-bottom:10px;padding-left:10px;border-left:3px solid ${item.is_correct ? '#22c55e' : '#ef4444'}">
                <p><strong>Q:</strong> ${item.question}</p>
                <p>Your answer: ${item.your_answer} &nbsp; Correct: ${item.correct_answer} &nbsp; ${item.is_correct ? '✅' : '❌'}</p>
              </div>`
                        } else if (item.evaluation) {
                            html += `<div style="margin-bottom:10px">
                <p><strong>Theory Q:</strong> ${item.question}</p>
                <p><strong>Evaluation:</strong> ${item.evaluation}</p>
              </div>`
                        }
                    })
                    addMessage('bot', html)
                }
            } else {
                const res = await fetch('/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text })
                })
                const data = await res.json()
                addMessage('bot', data.response || 'Sorry, something went wrong.')
            }
        } catch (e) {
            addMessage('bot', 'Network error. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleSummarize = async () => {
        addMessage('user', 'Summarize this PDF')
        setLoading(true)
        try {
            const res = await fetch('/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
            const data = await res.json()
            addMessage('bot', data.response || data.error || 'Error summarizing.')
        } catch { addMessage('bot', 'Error summarizing.') }
        finally { setLoading(false) }
    }

    const handleMindmap = async () => {
        addMessage('user', 'Create a mind map for this PDF')
        setLoading(true)
        try {
            const res = await fetch('/mindmap', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
            const data = await res.json()
            addMessage('bot', data.response || 'Error creating mind map.')
        } catch { addMessage('bot', 'Error creating mind map.') }
        finally { setLoading(false) }
    }

    const handleVisualize = async () => {
        addMessage('user', 'Visualize this document')
        setShowVisualizer(true)
        setLoadingVisualize(true)
        setMermaidCode('')
        setSelectedNode(null)
        setSubtopicContent('')
        try {
            const res = await fetch('/visualize', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
            const data = await res.json()
            if (data.mermaid_code) {
                setMermaidCode(data.mermaid_code)
                addMessage('bot', 'Here is the interactive flowchart. Click nodes to see details!')
            } else {
                addMessage('bot', data.error || 'Error creating flowchart.')
                setShowVisualizer(false)
            }
        } catch {
            addMessage('bot', 'Error creating flowchart.')
            setShowVisualizer(false)
        } finally {
            setLoadingVisualize(false)
        }
    }

    const handleNodeClick = async (id, label) => {
        setSelectedNode({ id, label })
        setSubtopicContent('')
        setLoadingSubtopic(true)
        try {
            const res = await fetch('/visualize/subtopic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subtopic_name: label })
            })
            const data = await res.json()
            if (data.content) {
                setSubtopicContent(data.content)
            } else {
                setSubtopicContent('Failed to load content. ' + (data.error || ''))
            }
        } catch {
            setSubtopicContent('Error connecting to server.')
        } finally {
            setLoadingSubtopic(false)
        }
    }

    const handleStartQuiz = () => {
        setShowQuizSelection(true)
    }

    const startSelectedQuiz = async (mode) => {
        setShowQuizSelection(false)
        addMessage('user', `Start a ${mode === 'mcq_game' ? 'Space Invaders MCQ' : 'Theory'} Quiz`)
        setLoading(true)
        try {
            const res = await fetch('/quiz/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
            })
            const data = await res.json()
            if (data.question || data.options) {
                if (mode === 'mcq_game') {
                    setQuizMode('mcq_game')
                    setMcqGameState({
                        question: data.question,
                        options: data.options,
                        lives: 4
                    })
                    addMessage('bot', 'Starting Space Invaders! Let the game begin.')
                } else {
                    setQuizMode('theory')
                    setQuizActive(true)
                    addMessage('bot', `<b>First Question:</b> ${data.question}`)
                }
            } else {
                addMessage('bot', data.error || 'Error starting quiz.')
            }
        } catch { addMessage('bot', 'Error starting quiz.') }
        finally { setLoading(false) }
    }

    const handleMcqAnswer = useCallback(async (answerText) => {
        try {
            const res = await fetch('/quiz/answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answer: answerText })
            })
            const data = await res.json()

            if (data.game_over) {
                setTimeout(() => {
                    setMcqGameState(null)
                    setQuizMode('none')
                    addMessage('bot', data.message || 'Game Over')
                }, 1500)
                return { is_correct: data.result?.is_correct }
            } else {
                setTimeout(() => {
                    setMcqGameState({
                        question: data.next_question,
                        options: data.options,
                        lives: data.lives
                    })
                }, 1000)
                return { is_correct: data.result?.is_correct }
            }
        } catch (e) {
            return { is_correct: false }
        }
    }, [addMessage]);

    const handleStartCollab = async () => {
        addMessage('user', 'Start a collaborative session')
        setLoading(true)
        try {
            const res = await fetch('/api/session/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            const data = await res.json()
            if (data.success) {
                navigate(`/session?sessionid=${data.sessionId}`)
            } else {
                addMessage('bot', data.error || 'Failed to create session.')
            }
        } catch { addMessage('bot', 'Error creating collab session.') }
        finally { setLoading(false) }
    }

    const handleYTSearch = async () => {
        if (!ytInput.trim()) return
        addMessage('user', `Search YouTube for: ${ytInput}`)
        setShowYT(false)
        const query = ytInput
        setYtInput('')
        setLoading(true)
        try {
            const res = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `search youtube for: ${query}` })
            })
            const data = await res.json()
            addMessage('bot', data.response || 'YouTube search opened in browser!')
        } catch { addMessage('bot', 'YouTube search opened in browser!') }
        finally { setLoading(false) }
    }

    const handleSwitchPdf = async (filename) => {
        if (filename === pdfFilename || loading) return
        setLoading(true)
        try {
            const res = await fetch('/switch-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            })
            const data = await res.json()
            if (data.success) {
                setPdfFilename(filename)
                addMessage('bot', `Switched to: <strong>${filename}</strong>. I'm ready to answer questions about this document.`)
            } else {
                throw new Error(data.error || 'Switch failed')
            }
        } catch (err) {
            addMessage('bot', `Error switching PDF: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage(input)
        }
    }

    return (
        <div className="viewer-page">
            {showQuizSelection && (
                <div className="subtopic-modal-overlay" onClick={() => setShowQuizSelection(false)}>
                    <div className="subtopic-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', height: 'auto', paddingBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
                            <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-main)' }}>Select Quiz Mode</h2>
                            <button onClick={() => setShowQuizSelection(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="subtopic-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden', padding: '16px 24px 0 24px' }}>
                            <p style={{ margin: '0 0 8px 0', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>(20 Questions)</p>
                            <button className="btn btn-primary" onClick={() => startSelectedQuiz('mcq_game')} style={{ width: '100%', padding: '12px', justifyContent: 'center' }}>
                                Space Invaders (MCQ)
                            </button>
                            <button className="btn btn-secondary" onClick={() => startSelectedQuiz('theory')} style={{ width: '100%', padding: '12px', justifyContent: 'center' }}>
                                Normal Theory
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {quizMode === 'mcq_game' && mcqGameState && (
                <SpaceInvadersGame
                    gameState={mcqGameState}
                    onAnswer={handleMcqAnswer}
                    onClose={() => {
                        setQuizMode('none')
                        setMcqGameState(null)
                        addMessage('bot', 'Quit Space Invaders Game.')
                    }}
                />
            )}
            <div className="viewer-layout">
                {/* Sidebar - only show if multiple PDFs */}
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

                {/* PDF Panel */}
                <div className="pdf-panel">
                    <div className="pdf-panel-header">
                        <div className="pdf-panel-info">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                            <span className="pdf-panel-title">
                                {pdfFilename || 'PDF'}
                            </span>
                        </div>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => navigate('/')}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                            Upload New
                        </button>
                    </div>
                    {showVisualizer ? (
                        <div className="visualizer-panel">
                            <div className="visualizer-header">
                                <h3>Interactive Flowchart</h3>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowVisualizer(false)}>✕ Close</button>
                            </div>
                            <div className="visualizer-content">
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
                        </div>
                    ) : pdfFilename ? (
                        <iframe
                            className="pdf-iframe"
                            src={`/pdf/${pdfFilename}`}
                            title="PDF Viewer"
                            key={pdfFilename}
                        />
                    ) : null}
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
                                    {multiFilenames.length > 1
                                        ? `Analyzing all ${multiFilenames.length} PDFs`
                                        : 'Ask anything about your PDF'}
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
                        <button className="action-btn" onClick={() => setShowYT(p => !p)} disabled={loading}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                            YouTube
                        </button>
                        <button className="action-btn" onClick={() => setShowBineural(p => !p)}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5v14M7 5v14M2 9v6M22 9v6" /></svg>
                            Bineural
                        </button>
                        <button className="action-btn collab-btn" onClick={handleStartCollab} disabled={loading}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                            Start Collab
                        </button>
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

                    {/* Input Area */}
                    <div className="chat-input-area">
                        {showYT && (
                            <div className="youtube-search-bar">
                                <input
                                    className="chat-input"
                                    placeholder="What to search on YouTube?"
                                    value={ytInput}
                                    onChange={e => setYtInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleYTSearch()
                                        if (e.key === 'Escape') setShowYT(false)
                                    }}
                                    autoFocus
                                />
                                <button className="send-btn" onClick={handleYTSearch}>Search</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowYT(false)}>✕</button>
                            </div>
                        )}

                        <div className="chat-input-row">
                            <input
                                ref={inputRef}
                                className="chat-input"
                                placeholder={quizActive ? 'Type A / B / C / D or your answer…' : 'Ask a question about the PDF…'}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
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

            {showBineural && (
                <div className="subtopic-modal-overlay" onClick={() => setShowBineural(false)}>
                    <div onClick={e => e.stopPropagation()}>
                        <BineuralBeats />
                    </div>
                </div>
            )}
        </div>
    )
}
