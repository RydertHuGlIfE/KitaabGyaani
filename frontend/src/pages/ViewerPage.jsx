import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ViewerPage() {
    const [messages, setMessages] = useState([
        { role: 'bot', content: "Hello! I've analysed your PDF. Ask me anything about it." }
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [pdfFilename, setPdfFilename] = useState('')
    const [quizActive, setQuizActive] = useState(false)
    const [showYT, setShowYT] = useState(false)
    const [ytInput, setYtInput] = useState('')
    const messagesEndRef = useRef()
    const inputRef = useRef()
    const navigate = useNavigate()

    useEffect(() => {
        fetch('/get-pdf-info')
            .then(r => r.json())
            .then(d => {
                if (d.filename) setPdfFilename(d.filename)
                else navigate('/')
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
            if (quizActive) {
                const res = await fetch('/quiz/answer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ answer: text })
                })
                const data = await res.json()

                if (data.result) {
                    const correct = data.result.is_correct
                    addMessage('bot', correct
                        ? '✅ Correct!'
                        : `❌ Incorrect. Right answer: <strong>${data.result.correct_answer}</strong>`)
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
            addMessage('bot', data.response || 'Error summarizing.')
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

    const handleStartQuiz = async () => {
        addMessage('user', 'Start a quiz')
        setLoading(true)
        try {
            const res = await fetch('/quiz/start', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
            const data = await res.json()
            if (data.question) {
                setQuizActive(true)
                addMessage('bot', `<b>First Question:</b> ${data.question}<br><i>Options: ${data.options.join(', ')}</i>`)
            } else {
                addMessage('bot', data.error || 'Error starting quiz.')
            }
        } catch { addMessage('bot', 'Error starting quiz.') }
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

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage(input)
        }
    }

    return (
        <div className="viewer-page">
            <div className="viewer-layout">
                {/* PDF Panel */}
                <div className="pdf-panel">
                    <div className="pdf-panel-header">
                        <span className="pdf-panel-title">
                            📄 {pdfFilename || 'PDF'}
                        </span>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => navigate('/')}
                        >
                            ← Upload New
                        </button>
                    </div>
                    {pdfFilename && (
                        <iframe
                            className="pdf-iframe"
                            src={`/pdf/${pdfFilename}`}
                            title="PDF Viewer"
                        />
                    )}
                </div>

                {/* Chat Panel */}
                <div className="chat-panel">
                    <div className="chat-panel-header">
                        <div className="chat-panel-title">🤖 AI Assistant</div>
                        <div className="chat-panel-sub">Ask anything about your PDF</div>
                    </div>

                    {/* Action Buttons */}
                    <div className="action-buttons">
                        <button className="action-btn" onClick={handleSummarize} disabled={loading}>
                            📄 Summarize
                        </button>
                        <button className="action-btn" onClick={handleMindmap} disabled={loading}>
                            🧩 Mind Map
                        </button>
                        <button className="action-btn" onClick={handleStartQuiz} disabled={loading}>
                            ❓ Quiz
                        </button>
                        <button className="action-btn" onClick={() => setShowYT(p => !p)} disabled={loading}>
                            🎥 YouTube
                        </button>
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
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
