import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useLocation, Link } from 'react-router-dom'
import PomodoroTimer from './PomodoroTimer'
import { useFocus } from '../context/FocusContext'

export default function Header() {
    const { theme, toggleTheme } = useTheme()
    const { isFocusModeActive, toggleFocusMode } = useFocus()
    const [nightLight, setNightLight] = useState(localStorage.getItem('nightLight') === 'true')
    const location = useLocation()

    useEffect(() => {
        if (nightLight) {
            document.body.classList.add('night-light-active')
        } else {
            document.body.classList.remove('night-light-active')
        }
        localStorage.setItem('nightLight', nightLight)
    }, [nightLight])

    return (
        <header className="header">
            <Link to="/" className="header-logo">
                <div className="logo-icon-wrap">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        <path d="M8 7h8" />
                        <path d="M8 11h6" />
                    </svg>
                </div>
                <div>
                    <div className="logo-name">KitaabGyaani</div>
                    <div className="logo-sub">AI Study Assistant</div>
                </div>
            </Link>

            <nav className="header-nav">
                <Link to="/" className={`nav-link${location.pathname === '/' ? ' active' : ''}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    Home
                </Link>
                {location.pathname === '/viewer' && (
                    <span className="nav-link active">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                        </svg>
                        Viewer
                    </span>
                )}
                <PomodoroTimer />
            </nav>

            <div className="header-actions">
                <button
                    className={`theme-toggle${nightLight ? ' active' : ''}`}
                    onClick={() => setNightLight(!nightLight)}
                    aria-label="Toggle night light"
                    title={`Turn ${nightLight ? 'off' : 'on'} night light`}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
                        <path d="M9 18h6" />
                        <path d="M10 22h4" />
                    </svg>
                </button>

                <button
                    className="theme-toggle"
                    onClick={toggleTheme}
                    aria-label="Toggle theme"
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                    {theme === 'dark' ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" />
                            <line x1="21" y1="12" x2="23" y2="12" />
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                    )}
                </button>

                <button
                    className={`theme-toggle${isFocusModeActive ? ' active' : ''}`}
                    onClick={toggleFocusMode}
                    aria-label="Toggle focus mode"
                    title={`Turn ${isFocusModeActive ? 'off' : 'on'} focus mode`}
                    style={{
                        background: isFocusModeActive ? 'var(--coral)' : 'var(--bg-card-hover)',
                        color: isFocusModeActive ? 'white' : 'var(--text-main)',
                        border: isFocusModeActive ? 'none' : '1px solid var(--border)'
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                </button>

                <div className="header-badge">
                    <span className="status-dot" />
                    AI Online
                </div>
            </div>
        </header>
    )
}
