import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { MODES } from './SessionConstants';
import { useFocus } from './FocusContext';

const SessionContext = createContext();

export const SessionProvider = ({ children }) => {
  const { isSleeping } = useFocus();
  const [phase, setPhase] = useState('IDLE');
  const [activeMode, setActiveMode] = useState(null);
  const [prevMode, setPrevMode] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [crashedCount, setCrashedCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Audio Refs
  const audioCtx = useRef(null);
  const leftOsc = useRef(null);
  const rightOsc = useRef(null);
  const masterGain = useRef(null);
  const timerRef = useRef(null);

  const initAudio = () => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      masterGain.current = audioCtx.current.createGain();
      masterGain.current.gain.value = 0.1;
      masterGain.current.connect(audioCtx.current.destination);

      const merger = audioCtx.current.createChannelMerger(2);
      leftOsc.current = audioCtx.current.createOscillator();
      leftOsc.current.frequency.value = 200;
      leftOsc.current.connect(merger, 0, 0);

      rightOsc.current = audioCtx.current.createOscillator();
      rightOsc.current.frequency.value = 208; // Start at 8Hz beat
      rightOsc.current.connect(merger, 0, 1);

      merger.connect(masterGain.current);
      leftOsc.current.start();
      rightOsc.current.start();
    }
  };

  const transitionTo = (freq, duration = 30) => {
    if (!rightOsc.current || !audioCtx.current) return;
    const targetFreq = 200 + freq;
    const now = audioCtx.current.currentTime;
    rightOsc.current.frequency.cancelScheduledValues(now);
    rightOsc.current.frequency.linearRampToValueAtTime(targetFreq, now + duration);
  };

  const startSession = () => {
    initAudio();
    setPhase('PRE_SESSION');
    setActiveMode('PRE_SESSION');
    setTimeLeft(MODES.PRE_SESSION.duration);
    setIsPlaying(true);
    transitionTo(8, 0);
  };

  const switchMode = (modeKey) => {
    if (phase === 'IDLE' || (phase === 'PRE_SESSION' && modeKey !== 'CRASHED')) return;

    if (modeKey === 'CRASHED') {
      if (crashedCount >= 2) return;
      setCrashedCount(prev => prev + 1);
      setPrevMode(activeMode);
      setPhase('CRASHED');
      setActiveMode('CRASHED');
      setTimeLeft(MODES.CRASHED.duration);
      transitionTo(40, 0);
    } else {
      setActiveMode(modeKey);
      setPhase('FREE_FLOW');
      transitionTo(MODES[modeKey].freq, 30);
    }
  };

  const togglePause = () => setIsPlaying(prev => !prev);

  useEffect(() => {
    if (isPlaying && timeLeft > 0 && !isSleeping) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          const next = prev - 1;

          if (phase === 'PRE_SESSION') {
            const total = MODES.PRE_SESSION.duration;
            const elapsed = total - next;
            if (elapsed === Math.floor(total * 0.33)) transitionTo(10, total * 0.03); // Shift at 33% i thnk thisalso works on cheapo headphones as well but eh idk 
            if (elapsed === Math.floor(total * 0.8)) transitionTo(14, total * 0.2);   // Ramp last 20% idk wtf am i doing
          }

          if (next <= 0) {
            clearInterval(timerRef.current);
            if (phase === 'PRE_SESSION') {
              setPhase('FREE_FLOW');
              setActiveMode('READING');
              transitionTo(14, 0);
            } else if (phase === 'CRASHED') {
              switchMode(prevMode);
            }
            return 0;
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, timeLeft, phase]);

  return (
    <SessionContext.Provider value={{
      phase, activeMode, timeLeft, crashedCount, isPlaying,
      startSession, switchMode, togglePause
    }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
