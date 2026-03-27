import React from 'react';
import { useSession } from '../context/SessionContext';
import { MODES } from '../context/SessionConstants';

const BineuralBeats = () => {
  const { 
    phase, 
    activeMode, 
    timeLeft, 
    crashedCount, 
    isPlaying,
    startSession, 
    switchMode 
  } = useSession();

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="binaural-container">
      <div className="binaural-header">
        <h3>Bineural Focus</h3>
        {phase !== 'IDLE' && (
          <div className="status-badge pulse">
            {phase === 'PRE_SESSION' ? 'Priming Brain...' : MODES[activeMode]?.label || activeMode}
          </div>
        )}
      </div>

      <div className="timer-display">
        {phase !== 'IDLE' ? formatTime(timeLeft) : 'Ready to Start'}
      </div>

      <div className="controls">
        {phase === 'IDLE' ? (
          <button className="btn btn-primary btn-lg" onClick={startSession}>
            Initialize Session
          </button>
        ) : (
          <>
            <div className="mode-grid">
              {['READING', 'FOCUS', 'DEEP_WORK', 'MEMORIZE', 'RESET'].map(key => (
                <button
                  key={key}
                  className={`btn mode-btn ${activeMode === key ? 'active' : ''}`}
                  onClick={() => switchMode(key)}
                  disabled={phase === 'PRE_SESSION'}
                >
                  {MODES[key].label}
                </button>
              ))}
            </div>

            <button
              className="btn btn-crashed"
              onClick={() => switchMode('CRASHED')}
              disabled={crashedCount >= 2 || phase === 'CRASHED'}
            >
              {crashedCount >= 2 ? 'Emergency Limit Reached' : 'I Crashed! (40Hz Boost)'}
              {crashedCount < 2 && <span className="usage">({2 - crashedCount} left)</span>}
            </button>
          </>
        )}
      </div>
      <style jsx>{`
        .binaural-container {
          background: var(--surface);
          border: var(--border-width) solid var(--border);
          border-radius: var(--radius-xl);
          padding: 24px;
          box-shadow: var(--shadow-lg);
          max-width: 400px;
          margin: 20px auto;
          text-align: center;
        }
        .binaural-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .status-badge {
          font-size: 12px;
          font-weight: 700;
          color: var(--teal);
          background: var(--teal-light);
          padding: 4px 12px;
          border-radius: 99px;
          border: 1px solid var(--border);
        }
        .timer-display {
          font-size: 48px;
          font-weight: 800;
          color: var(--text);
          margin: 20px 0;
          font-family: monospace;
        }
        .mode-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 15px;
        }
        .mode-btn {
          background: var(--surface-2);
          color: var(--text-secondary);
          font-size: 13px;
        }
        .mode-btn.active {
          background: var(--teal);
          color: white;
          box-shadow: var(--shadow);
        }
        .btn-crashed {
          width: 100%;
          background: var(--coral);
          color: white;
          margin-top: 10px;
          box-shadow: var(--shadow);
        }
        .btn-crashed:disabled {
          background: var(--surface-3);
          color: var(--text-muted);
          box-shadow: none;
          cursor: not-allowed;
        }
        .usage {
          font-size: 11px;
          margin-left: 8px;
          opacity: 0.8;
        }
        .pulse {
          animation: pulse 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default BineuralBeats;
