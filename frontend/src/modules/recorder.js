// ─── recorder.js — Screen recording module (adapted from Cliply) ─────────────

let mediaRecorder = null;
let screenStream = null;
let micStream = null;
let stopTimeout = null;

// Persistent state for recovery
let recordedChunks = [];
let recordedMimeType = '';
let onStopCallback = null;

function getSupportedMimeType(hasAudio) {
    const types = hasAudio ? [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
    ] : [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
    ];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

/**
 * Start recording the screen, optionally with microphone audio.
 * @param {{ useMic: boolean, onStop: (blob: Blob, mimeType: string) => void, onError: (err: Error) => void }} opts
 */
export async function startRecording({ useMic, onStop, onError }) {
    // Reset state
    recordedChunks = [];
    recordedMimeType = '';
    onStopCallback = onStop;

    try {
        // Request screen capture (video only — no system audio needed)
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 60, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
        });

        const audioTracks = [];

        // Optionally add microphone
        if (useMic) {
            try {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                audioTracks.push(...micStream.getAudioTracks());
            } catch (err) {
                console.warn('[Recorder] mic access denied or failed', err);
            }
        }

        let finalStream;
        if (audioTracks.length > 0) {
            // Mix audio tracks via AudioContext
            const ctx = new AudioContext();
            const dest = ctx.createMediaStreamDestination();
            window._recorderAudioContext = ctx;

            audioTracks.forEach((track) => {
                const source = ctx.createMediaStreamSource(new MediaStream([track]));
                const gainNode = ctx.createGain();
                gainNode.gain.value = 1.0;
                source.connect(gainNode);
                gainNode.connect(dest);
            });

            if (ctx.state === 'suspended') await ctx.resume();

            // Comfort noise to keep encoder alive
            const oscillator = ctx.createOscillator();
            const comfortGain = ctx.createGain();
            comfortGain.gain.value = 0.001;
            oscillator.connect(comfortGain);
            comfortGain.connect(dest);
            oscillator.start();

            finalStream = new MediaStream([
                ...screenStream.getVideoTracks(),
                ...dest.stream.getAudioTracks(),
            ]);
        } else {
            finalStream = new MediaStream([...screenStream.getVideoTracks()]);
        }

        const hasAudio = finalStream.getAudioTracks().length > 0;
        recordedMimeType = getSupportedMimeType(hasAudio);

        mediaRecorder = new MediaRecorder(finalStream, {
            mimeType: recordedMimeType,
            videoBitsPerSecond: 3_000_000,
        });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data?.size > 0) recordedChunks.push(e.data);
        };

        mediaRecorder.onstop = () => finishRecording();

        mediaRecorder.onerror = (e) => {
            console.error('[Recorder] MediaRecorder error:', e);
            onError(e.error || new Error('MediaRecorder unknown error'));
        };

        // Handle user clicking "Stop sharing" in the browser chrome
        screenStream.getVideoTracks()[0].onended = () => {
            if (mediaRecorder?.state !== 'inactive') stopRecording();
        };

        mediaRecorder.start(1000);
        return { mimeType: recordedMimeType };
    } catch (err) {
        console.error('[Recorder] Critical error in startRecording:', err);
        onError(err);
        return null;
    }
}

export function stopRecording() {
    if (stopTimeout) clearTimeout(stopTimeout);

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
            mediaRecorder.stop();
            stopTimeout = setTimeout(() => {
                console.warn('[Recorder] onstop timed out. Forcing finishRecording.');
                finishRecording();
            }, 1000);
        } catch (err) {
            console.error('[Recorder] Failed to call mediaRecorder.stop():', err);
            finishRecording();
        }
    } else {
        finishRecording();
    }
}

function finishRecording() {
    if (stopTimeout) {
        clearTimeout(stopTimeout);
        stopTimeout = null;
    }

    _stopStreams();

    if (recordedChunks.length > 0 && onStopCallback) {
        const blob = new Blob(recordedChunks, { type: recordedMimeType });
        onStopCallback(blob, recordedMimeType);
        onStopCallback = null;
    }
}

export function pauseRecording() {
    if (mediaRecorder?.state === 'recording') mediaRecorder.pause();
}

export function resumeRecording() {
    if (mediaRecorder?.state === 'paused') mediaRecorder.resume();
}

export function getRecorderState() {
    return mediaRecorder?.state || 'inactive';
}

function _stopStreams() {
    [screenStream, micStream].forEach((s) => s?.getTracks()?.forEach((t) => t.stop()));
    if (window._recorderAudioContext) {
        window._recorderAudioContext.close().catch(() => { });
        window._recorderAudioContext = null;
    }
    screenStream = null;
    micStream = null;
    mediaRecorder = null;
}
