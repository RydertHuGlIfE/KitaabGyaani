import React, { useState, useEffect } from 'react';
import { useSession } from '../context/SessionContext';
import { MODES } from '../context/SessionConstants';
import { useFocus } from '../context/FocusContext';

export default function PomodoroTimer() {
    const { phase, activeMode, timeLeft: globalTime, isPlaying: globalPlaying, startSession, togglePause } = useSession();
    const { isSleeping } = useFocus();
    
    // Local Pomodoro States (used when Binaural is IDLE)
    const [localMode, setLocalMode] = useState('study'); 
    const [localTimeLeft, setLocalTimeLeft] = useState(60 * 60);
    const [localIsActive, setLocalIsActive] = useState(false);

    useEffect(() => {
        let interval = null;
        if (localIsActive && localTimeLeft > 0 && phase === 'IDLE' && !isSleeping) {
            interval = setInterval(() => {
                setLocalTimeLeft(t => t - 1);
            }, 1000);
        } else if (localTimeLeft === 0 && phase === 'IDLE') {
            if (localMode === 'study') {
                setLocalMode('break');
                setLocalTimeLeft(10 * 60);
            } else {
                setLocalMode('study');
                setLocalTimeLeft(60 * 60);
            }
            setLocalIsActive(false);
        }
        return () => clearInterval(interval);
    }, [localIsActive, localTimeLeft, localMode, phase]);

    const isSessionActive = phase !== 'IDLE';
    const displayTime = isSessionActive ? globalTime : localTimeLeft;
    const displayMode = isSessionActive ? (MODES[activeMode]?.label || MODES[phase]?.label || 'FOCUS') : (localMode === 'study' ? 'STUDY' : 'BREAK');
    const isActive = isSessionActive ? globalPlaying : localIsActive;
    const isActuallyRunning = isActive && !isSleeping;

    const handleToggle = () => {
        if (isSessionActive) togglePause();
        else setLocalIsActive(!localIsActive);
    };

    const handleReset = () => {
        if (isSessionActive) return; // Binaural session reset not implemented yet or handled via modal
        setLocalIsActive(false);
        setLocalMode('study');
        setLocalTimeLeft(60 * 60);
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="pomodoro-timer" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: 'var(--bg-elevated)', 
            padding: '4px 12px', 
            borderRadius: '12px', 
            marginLeft: '15px', 
            border: `2px solid ${isSessionActive ? 'var(--coral)' : 'var(--border)'}`,
            boxShadow: isSessionActive ? '0 0 10px var(--accent-glow)' : 'none',
            transition: 'all 0.3s ease'
        }}>
            <span style={{ 
                fontWeight: 'bold', 
                fontSize: '0.85rem', 
                color: isSessionActive ? 'var(--coral)' : (localMode === 'study' ? '#f87171' : '#4ade80') 
            }}>
                {displayMode.toUpperCase()}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '1rem', width: '45px', textAlign: 'center', margin: '0 4px', color: 'var(--text-main)' }}>
                {formatTime(displayTime)}
            </span>
            <button onClick={handleToggle} style={{ 
                fontSize: '0.75rem', 
                background: isSleeping ? 'var(--coral)' : 'var(--bg-card-hover)', 
                color: isSleeping ? 'white' : 'var(--text-main)', 
                border: '1px solid var(--border)', 
                padding: '4px 8px', 
                borderRadius: '4px', 
                cursor: 'pointer',
                opacity: isSleeping ? 0.8 : 1
            }}>
                {isSleeping ? 'SLEEPING' : (isActive ? 'Pause' : 'Start')}
            </button>
            {!isSessionActive && (
                <button onClick={handleReset} style={{ fontSize: '0.75rem', background: 'var(--bg-card-hover)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                    Reset
                </button>
            )}
        </div>
    );
}
