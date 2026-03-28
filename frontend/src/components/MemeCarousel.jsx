import { useState, useEffect } from 'react';

export default function MemeCarousel() {
    const [memes, setMemes] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAIMemes = async () => {
            try {
                // Now only need to call our backend; it handles construction
                const aiRes = await fetch('/memes/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ }) // No templates needed anymore
                });
                const aiData = await aiRes.json();
                
                if (aiData.memes) {
                    setMemes(aiData.memes);
                }
                setLoading(false);
            } catch (err) {
                console.error("Meme fetch error:", err);
                setLoading(false);
            }
        };

        fetchAIMemes();
    }, []);

    const nextMeme = () => {
        setCurrentIndex((prev) => (prev + 1) % memes.length);
    };

    const prevMeme = () => {
        setCurrentIndex((prev) => (prev - 1 + memes.length) % memes.length);
    };

    if (loading) return <div className="meme-loading">Loading fun...</div>;
    if (memes.length === 0) return null;

    const currentMeme = memes[currentIndex];

    return (
        <div className="meme-carousel-wrap">
            <div className="meme-card">
                <div className="meme-header">
                    <span>Quick Study Break</span>
                    <div className="meme-controls">
                        <button onClick={prevMeme} className="meme-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 18l-6-6 6-6" />
                            </svg>
                        </button>
                        <span className="meme-count">{currentIndex + 1} / {memes.length}</span>
                        <button onClick={nextMeme} className="meme-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 18l6-6-6-6" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="meme-image-container">
                    <img
                        key={currentIndex}
                        src={currentMeme.url}
                        alt={currentMeme.name}
                        className="meme-img"
                        loading="lazy"
                    />
                </div>

                <div className="meme-footer">
                    <p className="meme-title">{currentMeme.name}</p>
                </div>
            </div>
        </div>
    );
}
