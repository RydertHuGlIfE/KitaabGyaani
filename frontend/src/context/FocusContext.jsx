import React, { createContext, useContext, useState, useEffect } from 'react';

const FocusContext = createContext();

export const FocusProvider = ({ children }) => {
    const [isFocusModeActive, setIsFocusModeActive] = useState(false);
    const [isSleeping, setIsSleeping] = useState(false);
    const [sleepingTime, setSleepingTime] = useState(0); // in seconds
    const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);

    useEffect(() => {
        let interval;
        if (isFocusModeActive && isSleeping) {
            interval = setInterval(() => {
                setSleepingTime(prev => prev + 1);
            }, 1000);
        } else {
            setSleepingTime(0);
            setIsAlarmPlaying(false);
        }
        return () => clearInterval(interval);
    }, [isFocusModeActive, isSleeping]);

    const toggleFocusMode = () => {
        setIsFocusModeActive(!isFocusModeActive);
        if (isFocusModeActive) { // if turning off
            setIsSleeping(false);
            setSleepingTime(0);
        }
    };

    return (
        <FocusContext.Provider value={{
            isFocusModeActive,
            toggleFocusMode,
            isSleeping,
            setIsSleeping,
            sleepingTime,
            isAlarmPlaying,
            setIsAlarmPlaying
        }}>
            {children}
        </FocusContext.Provider>
    );
};

export const useFocus = () => useContext(FocusContext);
