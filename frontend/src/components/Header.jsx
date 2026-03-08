export default function Header() {
    return (
        <header className="header">
            <div className="header-logo">
                <span className="logo-icon">📖</span>
                <div>
                    <div className="logo-name">KitaabGyaani</div>
                    <div className="logo-sub">AI Study Assistant</div>
                </div>
            </div>

            <div className="header-badge">
                <span className="status-dot" />
                AI Online
            </div>
        </header>
    )
}
