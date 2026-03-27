import React, { useState, useEffect } from 'react';

export default function PomodoroTimer() {
    const [mode, setMode] = useState('study'); // 'study' or 'break'
    const [timeLeft, setTimeLeft] = useState(60 * 60); // 60 minutes
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        let interval = null;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(t => t - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            if (mode === 'study') {
                setMode('break');
                setTimeLeft(10 * 60);
            } else {
                setMode('study');
                setTimeLeft(60 * 60);
            }
            setIsActive(false);
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft, mode]);

    const toggleTimer = () => setIsActive(!isActive);
    const resetTimer = () => {
        setIsActive(false);
        setMode('study');
        setTimeLeft(60 * 60);
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="pomodoro-timer" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-elevated)', padding: '4px 12px', borderRadius: '12px', marginLeft: '15px', border: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: mode === 'study' ? '#f87171' : '#4ade80' }}>
                {mode === 'study' ? 'STUDY' : 'BREAK'}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '1rem', width: '45px', textAlign: 'center', margin: '0 4px', color: 'var(--text-main)' }}>
                {formatTime(timeLeft)}
            </span>
            <button onClick={toggleTimer} style={{ fontSize: '0.75rem', background: 'var(--bg-card-hover)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                {isActive ? 'Pause' : 'Start'}
            </button>
            <button onClick={resetTimer} style={{ fontSize: '0.75rem', background: 'var(--bg-card-hover)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                Reset
            </button>
        </div>
    );
}
