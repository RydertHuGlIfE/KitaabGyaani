import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useFocus } from '../context/FocusContext';

export default function FocusModeOverlay() {
    const { isFocusModeActive, setIsSleeping, sleepingTime, setIsAlarmPlaying } = useFocus();
    const videoRef = useRef(null);
    const [faceLandmarker, setFaceLandmarker] = useState(null);
    const requestRef = useRef();
    const [status, setStatus] = useState('Initializing...');

    // Constants
    const EAR_THRESHOLD = 0.25;
    const CONSECUTIVE_FRAMES = 2;
    const ALARM_THRESHOLD_SECONDS = 300; //5 min utha ja bkl 
    const WARNING_THRESHOLD_SECONDS = 240; // 4 MIN HO GAYE

    const closedFrames = useRef(0);
    const [currentEAR, setCurrentEAR] = useState(0);
    const audioContextRef = useRef(null);
    const oscillatorRef = useRef(null);

    useEffect(() => {
        async function setup() {
            try {
                const filesetResolver = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
                );
                const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numFaces: 1
                });
                setFaceLandmarker(landmarker);
                setStatus('Ready');
            } catch (err) {
                console.error("Failed to load FaceLandmarker:", err);
                setStatus('Error loading detector');
            }
        }
        setup();
    }, []);

    useEffect(() => {
        if (isFocusModeActive && faceLandmarker) {
            startCamera();
        } else {
            stopCamera();
        }
    }, [isFocusModeActive, faceLandmarker]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                requestRef.current = requestAnimationFrame(predictWebcam);
            }
        } catch (err) {
            console.error("Camera access denied:", err);
            setStatus('Camera Access Denied');
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };

    const calculateDistance = (p1, p2) => {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    };

    const calculateEAR = (landmarks, eyeIndices) => {
        const p1 = landmarks[eyeIndices[0]];
        const p2 = landmarks[eyeIndices[1]];
        const p3 = landmarks[eyeIndices[2]];
        const p4 = landmarks[eyeIndices[3]];
        const p5 = landmarks[eyeIndices[4]];
        const p6 = landmarks[eyeIndices[5]];

        const vertical1 = calculateDistance(p2, p6);
        const vertical2 = calculateDistance(p3, p5);
        const horizontal = calculateDistance(p1, p4);

        return (vertical1 + vertical2) / (2.0 * horizontal);
    };

    const predictWebcam = useCallback(async () => {
        if (!faceLandmarker || !videoRef.current || !isFocusModeActive) return;

        // Ensure video is ready and has dimensions to avoid "ROI width/height must be > 0" error
        if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
            requestRef.current = requestAnimationFrame(predictWebcam);
            return;
        }

        try {
            let startTimeMs = performance.now();
            const results = await faceLandmarker.detectForVideo(videoRef.current, startTimeMs);

            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                const landmarks = results.faceLandmarks[0];

                // Indices for left and right eyes
                const leftEyeIndices = [33, 160, 158, 133, 153, 144];
                const rightEyeIndices = [362, 385, 387, 263, 373, 380];

                const leftEAR = calculateEAR(landmarks, leftEyeIndices);
                const rightEAR = calculateEAR(landmarks, rightEyeIndices);
                const avgEAR = (leftEAR + rightEAR) / 2.0;
                setCurrentEAR(avgEAR);

                if (avgEAR < EAR_THRESHOLD) {
                    closedFrames.current += 1;
                    setStatus('Eyes closed...');
                } else {
                    closedFrames.current = 0;
                    setIsSleeping(false);
                    setStatus('Ready');
                }

                if (closedFrames.current > CONSECUTIVE_FRAMES) {
                    setIsSleeping(true);
                }
            } else {
                // No face detected - consider as sleeping/away
                setCurrentEAR(0);
                setIsSleeping(true);
                setStatus('No face detected');
            }

            if (isFocusModeActive) {
                requestRef.current = requestAnimationFrame(predictWebcam);
            }
        } catch (err) {
            console.error("Detection error:", err);
            // Don't kill the loop, just try again next frame
            requestRef.current = requestAnimationFrame(predictWebcam);
        }
    }, [faceLandmarker, isFocusModeActive, setIsSleeping]);

    const startAlarm = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (oscillatorRef.current) return;

        const osc = audioContextRef.current.createOscillator();
        const gain = audioContextRef.current.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, audioContextRef.current.currentTime);

        gain.gain.setValueAtTime(0, audioContextRef.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.5, audioContextRef.current.currentTime + 0.1);

        // Beeping effect
        const interval = 0.5;
        for (let i = 0; i < 100; i++) {
            gain.gain.setValueAtTime(0.5, audioContextRef.current.currentTime + i * interval);
            gain.gain.setValueAtTime(0, audioContextRef.current.currentTime + i * interval + 0.2);
        }

        osc.connect(gain);
        gain.connect(audioContextRef.current.destination);
        osc.start();
        oscillatorRef.current = osc;
    };

    const stopAlarm = () => {
        if (oscillatorRef.current) {
            oscillatorRef.current.stop();
            oscillatorRef.current = null;
        }
    };

    // Handle alarm logic
    useEffect(() => {
        if (sleepingTime >= ALARM_THRESHOLD_SECONDS) {
            setIsAlarmPlaying(true);
            startAlarm();
        } else {
            setIsAlarmPlaying(false);
            stopAlarm();
        }
        return () => stopAlarm();
    }, [sleepingTime, setIsAlarmPlaying]);

    if (!isFocusModeActive) return null;

    return (
        <div className="focus-mode-preview" style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            width: '180px',
            background: 'var(--bg-elevated)',
            border: '2px solid var(--border)',
            borderRadius: '12px',
            overflow: 'hidden',
            zIndex: 1000,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ height: '120px', background: '#000', position: 'relative' }}>
                <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                {sleepingTime > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(255, 0, 0, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.8rem'
                    }}>
                        SLEEPING: {Math.floor(sleepingTime / 60)}:{(sleepingTime % 60).toString().padStart(2, '0')}
                    </div>
                )}
            </div>
            <div style={{ padding: '8px', fontSize: '0.7rem', color: 'var(--text-main)', textAlign: 'center' }}>
                {status} {currentEAR > 0 && `(EAR: ${currentEAR.toFixed(2)})`}
            </div>
            {sleepingTime >= WARNING_THRESHOLD_SECONDS && (
                <div style={{ background: '#f59e0b', color: 'white', padding: '4px', fontSize: '0.65rem', textAlign: 'center' }}>
                    Alarm in {ALARM_THRESHOLD_SECONDS - sleepingTime}s
                </div>
            )}
        </div>
    );
}
