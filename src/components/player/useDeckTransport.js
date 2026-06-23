import { useCallback, useEffect, useState } from 'react';

function resolveMediaDuration(audioEl, stateDuration) {
    if (Number.isFinite(stateDuration) && stateDuration > 0) return stateDuration;
    if (audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0) return audioEl.duration;
    try {
        if (audioEl?.seekable?.length) {
            const end = audioEl.seekable.end(audioEl.seekable.length - 1);
            if (Number.isFinite(end) && end > 0) return end;
        }
    } catch {
        // ignore
    }
    return 0;
}

export function useDeckTransport({
    audioRef,
    hasValidAudioSource,
    setError,
    missingElementMessage,
    missingSourceMessage,
    unsupportedProcessingMessage,
    playbackFailedPrefix,
    mediaLoadErrorMessage,
    onPlay,
    onPause,
    onStop,
    onEnded,
    autoStartLandmarkWithMusic,
    setLandmarkAutoStartTick,
    playlist = null,
    currentTrackIndex = -1,
    onTrackSelect = null,
    isTrackSwitchingRef = null,
    onTrackEndedNoAutoNext = null,
    selectedFile = null,
}) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    const handlePlayPause = useCallback(async () => {
        if (!audioRef.current) {
            setError(missingElementMessage);
            return;
        }
        if (!hasValidAudioSource()) {
            setError(missingSourceMessage);
            return;
        }

        try {
            if (audioRef.current?.soundConsoleMethods) {
                const success = await audioRef.current.soundConsoleMethods.initializeAudioContext();
                if (!success) {
                    setError(unsupportedProcessingMessage);
                    return;
                }
                const audioContext = audioRef.current.audioContextRef?.current;
                if (audioContext && audioContext.state === 'suspended') {
                    try {
                        await audioContext.resume();
                    } catch {
                        // continue
                    }
                }
                if (audioRef.current.soundConsoleMethods.forceAllEffectsCreation) {
                    setTimeout(() => {
                        audioRef.current.soundConsoleMethods.forceAllEffectsCreation();
                    }, 200);
                }
            }

            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
                onPause?.();
            } else {
                await audioRef.current.play();
                setIsPlaying(true);
                onPlay?.();
                if (autoStartLandmarkWithMusic) {
                    setLandmarkAutoStartTick?.((t) => t + 1);
                }
            }
        } catch (error) {
            const me = audioRef.current?.error;
            const code = me?.code;
            const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;
            const msg = error?.message || String(error);
            const notSuitable = code === MEDIA_ERR_SRC_NOT_SUPPORTED || /not suitable/i.test(msg);
            const corsHint = notSuitable
                ? ' Often caused by 403/404, wrong Content-Type, or missing CORS on the CDN (GET responses need Access-Control-Allow-Origin for Web Audio with crossOrigin).'
                : '';
            setError(`${playbackFailedPrefix}${msg}.${corsHint}`);
        }
    }, [
        audioRef,
        hasValidAudioSource,
        isPlaying,
        setError,
        missingElementMessage,
        missingSourceMessage,
        unsupportedProcessingMessage,
        playbackFailedPrefix,
        onPause,
        onPlay,
        autoStartLandmarkWithMusic,
        setLandmarkAutoStartTick,
    ]);

    const handleStop = useCallback(() => {
        if (!audioRef.current) return;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
        setCurrentTime(0);
        onStop?.();
    }, [audioRef, onStop]);

    const handleNext = useCallback(() => {
        if (!playlist || !onTrackSelect || currentTrackIndex < 0) return;
        const nextIndex = currentTrackIndex + 1;
        if (nextIndex < playlist.length) {
            if (isPlaying && isTrackSwitchingRef) {
                isTrackSwitchingRef.current = true;
            }
            onTrackSelect(playlist[nextIndex], nextIndex, isPlaying);
        }
    }, [playlist, onTrackSelect, currentTrackIndex, isPlaying, isTrackSwitchingRef]);

    const handlePrevious = useCallback(() => {
        if (!playlist || !onTrackSelect || currentTrackIndex < 0) return;
        const prevIndex = currentTrackIndex - 1;
        if (prevIndex >= 0) {
            if (isPlaying && isTrackSwitchingRef) {
                isTrackSwitchingRef.current = true;
            }
            onTrackSelect(playlist[prevIndex], prevIndex, isPlaying);
        }
    }, [playlist, onTrackSelect, currentTrackIndex, isPlaying, isTrackSwitchingRef]);

    const handleProgressSeek = useCallback((fraction) => {
        const audio = audioRef.current;
        if (!audio) return;
        const dur = resolveMediaDuration(audio, duration);
        if (!dur) return;
        const newTime = Math.min(1, Math.max(0, fraction)) * dur;
        audio.currentTime = newTime;
        setCurrentTime(newTime);
    }, [audioRef, duration]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleLoadedMetadata = () => setDuration(audio.duration || 0);
        const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
        const handleEnded = () => {
            const hasPlaylist = Array.isArray(playlist) && playlist.length > 0;
            const hasAutoNext =
                hasPlaylist &&
                currentTrackIndex >= 0 &&
                (currentTrackIndex + 1) < playlist.length;

            if (hasAutoNext && isTrackSwitchingRef) {
                isTrackSwitchingRef.current = true;
            } else {
                onTrackEndedNoAutoNext?.();
            }
            setIsPlaying(false);
            setCurrentTime(0);
            onPause?.();
            onEnded?.();

            if (hasAutoNext && onTrackSelect) {
                const nextIndex = currentTrackIndex + 1;
                setTimeout(() => {
                    onTrackSelect(playlist[nextIndex], nextIndex, true);
                }, 500);
            }
        };
        const handleError = () => {
            setError(mediaLoadErrorMessage);
            setIsPlaying(false);
        };

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);

        return () => {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
        };
    }, [
        audioRef,
        selectedFile,
        playlist,
        currentTrackIndex,
        onTrackSelect,
        isTrackSwitchingRef,
        onTrackEndedNoAutoNext,
        onPause,
        onEnded,
        mediaLoadErrorMessage,
        setError,
    ]);

    return {
        isPlaying,
        duration,
        currentTime,
        setIsPlaying,
        setDuration,
        setCurrentTime,
        handlePlayPause,
        handleStop,
        handleNext,
        handlePrevious,
        handleProgressSeek,
    };
}
