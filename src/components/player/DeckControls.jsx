import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Spinner } from 'react-bootstrap';
import { Text } from '../../styles/StyledComponents';
import { secondaryColor } from '../../utils/DisplaySettings';
import { usePointerSlide1D } from '../../hooks/usePointerSlide1D';
import defaultDeckArtwork from '../../images/logo_small.png';
import AudioDeviceButton from '../../buttons/AudioDeviceButton';
import SettingsButton from '../../buttons/SettingsButton';
import TutorialButton from '../../buttons/TutorialButton';
import StopButton from '../../buttons/StopButton';
import PlayPauseButton from '../../buttons/PlayPauseButton';
import PreviousButton from '../../buttons/PreviousButton';
import NextButton from '../../buttons/NextButton';
import { trackButtonClick } from '../../hooks/simpleTracker';

const noop = () => {};
const falseFn = () => false;

export const DeckControls = ({
    deckId,
    currentSongId = null,
    currentSongArtist = '',
    loadedTrackName = '',
    analyticsSessionName = 'default',
    isPlaying = false,
    currentTime = 0,
    duration = 0,
    hasValidAudioSource = falseFn,
    onPlayPause = noop,
    onStop = noop,
    onPrevious = noop,
    onNext = noop,
    /** (fraction: number) => void — 0…1 along the progress track */
    onProgressSeek = noop,
    hasPrevious = false,
    hasNext = false,
    onLoadTrack = noop,
    iconSize = '2.1rem',
    showPreviousNext = true,
    showStopButton = true,
    /** Utility row below transport (audio device, sound console, tutorial) */
    showAudioDevice = false,
    showSoundConsole = false,
    showTutorial = false,
    onAudioDeviceClick,
    onSoundConsoleClick,
    onTutorialClick,
    tutorialDismissed,
    setTutorialDismissed,
    /** Cover / artwork (URL string), e.g. SoundCloud `artwork_url` */
    artworkUrl,
    /** When false, no cover image is shown above transport controls. */
    showArtwork = true,
    artworkSizePx = 120,
    /** Optional status line (e.g. stream loading) */
    trackStatusMessage,
    trackStatusLoading = false
}) => {
    const [artworkSrc, setArtworkSrc] = useState(() =>
        showArtwork ? artworkUrl || defaultDeckArtwork : null,
    );

    useEffect(() => {
        setArtworkSrc(showArtwork ? artworkUrl || defaultDeckArtwork : null);
    }, [artworkUrl, showArtwork]);

    const handleArtworkError = useCallback(() => {
        setArtworkSrc((prev) => (prev === defaultDeckArtwork ? prev : defaultDeckArtwork));
    }, []);

    const canPlay = hasValidAudioSource();

    const handleProgressSeekFraction = useCallback(
        (fraction) => {
            if (!canPlay) return;
            onProgressSeek(fraction);
        },
        [canPlay, onProgressSeek]
    );

    const { boundsRef: progressBoundsRef, onPointerDown: onProgressPointerDown } = usePointerSlide1D({
        onFractionChange: handleProgressSeekFraction,
        enabled: canPlay
    });

    const trackDeckControlClick = useCallback(
        (controlName, metadataFields = {}) => {
            const elementId = `deck_${deckId}_${controlName}_button`;
            const metadata = {
                deck_id: deckId,
                control: controlName,
                ...metadataFields,
            };
            void trackButtonClick(elementId, window.location.href, {
                session_name: analyticsSessionName,
                metadata,
            });
        },
        [deckId, analyticsSessionName]
    );

    const songMeta = useMemo(
        () => ({
            song_id:
                currentSongId !== null && currentSongId !== undefined && currentSongId !== ''
                    ? String(currentSongId)
                    : '',
            song_name: loadedTrackName || '',
            song_artist: currentSongArtist || '',
        }),
        [currentSongId, loadedTrackName, currentSongArtist]
    );

    const handlePlayPauseClick = useCallback(() => {
        const control = isPlaying ? 'pause' : 'play';
        trackDeckControlClick(control, {
            ...songMeta,
            was_playing: isPlaying,
        });
        onPlayPause();
    }, [isPlaying, onPlayPause, trackDeckControlClick, songMeta]);

    const handleStopClick = useCallback(() => {
        trackDeckControlClick('stop', {
            ...songMeta,
            was_playing: isPlaying,
        });
        onStop();
    }, [isPlaying, onStop, trackDeckControlClick, songMeta]);

    const handlePreviousClick = useCallback(() => {
        trackDeckControlClick('previous', {
            previous_song_name: loadedTrackName || '',
            previous_song_id:
                currentSongId !== null && currentSongId !== undefined && currentSongId !== ''
                    ? String(currentSongId)
                    : '',
            has_previous: hasPrevious,
        });
        onPrevious();
    }, [hasPrevious, onPrevious, trackDeckControlClick, loadedTrackName, currentSongId]);

    const handleNextClick = useCallback(() => {
        trackDeckControlClick('next', {
            previous_song_name: loadedTrackName || '',
            previous_song_id:
                currentSongId !== null && currentSongId !== undefined && currentSongId !== ''
                    ? String(currentSongId)
                    : '',
            has_next: hasNext,
        });
        onNext();
    }, [hasNext, onNext, trackDeckControlClick, loadedTrackName, currentSongId]);

    const handleAudioDeviceClick = useCallback(() => {
        trackDeckControlClick('audio_settings');
        onAudioDeviceClick?.();
    }, [onAudioDeviceClick, trackDeckControlClick]);

    const handleSoundConsoleClick = useCallback(() => {
        trackDeckControlClick('sound_console');
        onSoundConsoleClick?.();
    }, [onSoundConsoleClick, trackDeckControlClick]);

    const handleTutorialClick = useCallback(() => {
        trackDeckControlClick('tutorial', {
            tutorial_visible: !tutorialDismissed
        });
        onTutorialClick?.();
    }, [trackDeckControlClick, tutorialDismissed, onTutorialClick]);

    const formatTime = (time) => {
        if (isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        let droppedTrack = null;

        try {
            const jsonTrack = e.dataTransfer.getData('application/x-soundbloom-track');
            if (jsonTrack) {
                droppedTrack = JSON.parse(jsonTrack);
            } else {
                const legacyJsonTrack = e.dataTransfer.getData('application/json');
                if (legacyJsonTrack) {
                    droppedTrack = JSON.parse(legacyJsonTrack);
                } else if (window.draggedTrack) {
                    droppedTrack = window.draggedTrack;
                } else if (window.draggedFile) {
                    droppedTrack = {
                        id: `local-${Date.now()}`,
                        name: window.draggedFile.name,
                        file: window.draggedFile
                    };
                }
            }
        } catch (error) {
            droppedTrack = null;
        }

        if (droppedTrack) {
            onLoadTrack(deckId, droppedTrack);
        }
    };

    const showUtilityRow =
        (showAudioDevice && onAudioDeviceClick) ||
        (showSoundConsole && onSoundConsoleClick) ||
        (showTutorial && (setTutorialDismissed || onTutorialClick));

    return (
        <div
            className="p-2 rounded"
            style={{
                border: 'none',
                backgroundColor: 'transparent'
            }}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragOverCapture={handleDragOver}
            onDrop={handleDrop}
            onDropCapture={handleDrop}
        >
            {(trackStatusMessage || trackStatusLoading) && (
                <div className="d-flex align-items-center gap-2 flex-wrap" style={{ margin: '0 0 0.25rem' }}>
                    {trackStatusLoading && <Spinner animation="border" size="sm" style={{ color: secondaryColor }} />}
                    {trackStatusMessage && (
                        <Text style={{ margin: 0, fontSize: '0.78rem', opacity: 0.9 }}>
                            {trackStatusMessage}
                        </Text>
                    )}
                </div>
            )}
            {showArtwork && artworkSrc && (
                <div className="text-center" style={{ marginTop: '0.15rem', marginBottom: '0.35rem' }}>
                    <img
                        src={artworkSrc}
                        alt=""
                        draggable={false}
                        onError={handleArtworkError}
                        style={{
                            width: `${artworkSizePx}px`,
                            height: `${artworkSizePx}px`,
                            borderRadius: '8px',
                            objectFit: 'cover',
                            boxShadow: `0 0 15px ${secondaryColor}55`
                        }}
                    />
                </div>
            )}
            {loadedTrackName ? (
                <Text
                    style={{
                        margin: 0,
                        fontSize: '0.78rem',
                        opacity: 0.95,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textAlign: 'center',
                        width: '100%',
                        display: 'block'
                    }}
                >
                    {loadedTrackName}
                </Text>
            ) : null}

            <div
                className="deck-controls-actions"
                style={{
                    overflow: 'visible',
                    padding: '6px 10px 4px',
                    marginLeft: '-4px',
                    marginRight: '-4px',
                }}
            >
                <div
                    className="deck-controls-transport d-flex justify-content-center align-items-center gap-3 flex-wrap"
                    style={{ overflow: 'visible', rowGap: '0.35rem' }}
                >
                    {showPreviousNext && (
                        <PreviousButton
                            onClick={handlePreviousClick}
                            size={iconSize}
                            showTooltip={true}
                            tooltipText="Previous"
                            isEnabled={hasPrevious}
                        />
                    )}
                    <PlayPauseButton
                        onClick={handlePlayPauseClick}
                        isPlaying={isPlaying}
                        size={iconSize}
                        showTooltip={true}
                        isEnabled={canPlay}
                    />
                    {showStopButton && (
                        <StopButton
                            onClick={handleStopClick}
                            size={iconSize}
                            showTooltip={true}
                            tooltipText="Stop"
                            isEnabled={canPlay}
                        />
                    )}
                    {showPreviousNext && (
                        <NextButton
                            onClick={handleNextClick}
                            size={iconSize}
                            showTooltip={true}
                            tooltipText="Next"
                            isEnabled={hasNext}
                        />
                    )}
                </div>

                {showUtilityRow && (
                    <div
                        className="deck-controls-utilities d-flex justify-content-center align-items-center gap-3 flex-wrap mt-2"
                        style={{ overflow: 'visible', rowGap: '0.35rem' }}
                    >
                        {showAudioDevice && onAudioDeviceClick && (
                            <AudioDeviceButton
                                onClick={handleAudioDeviceClick}
                                size={iconSize}
                                showTooltip={true}
                                tooltipText="Audio Device Settings"
                            />
                        )}
                    {showSoundConsole && onSoundConsoleClick && (
                        <SettingsButton
                            showSettings={false}
                            onToggleSettings={handleSoundConsoleClick}
                            size={iconSize}
                            showTooltip={true}
                            tooltipText="Sound console"
                        />
                    )}
                        {showTutorial && (setTutorialDismissed || onTutorialClick) && (
                            <TutorialButton
                                tutorialDismissed={tutorialDismissed}
                                setTutorialDismissed={setTutorialDismissed}
                                onClick={handleTutorialClick}
                                size={iconSize}
                                showTooltip={true}
                                tooltipText="Tutorial"
                            />
                        )}
                    </div>
                )}
            </div>

            <div
                ref={progressBoundsRef}
                role="slider"
                aria-valuemin={0}
                aria-valuemax={duration > 0 ? duration : 0}
                aria-valuenow={currentTime}
                tabIndex={canPlay ? 0 : -1}
                className="progress"
                style={{
                    height: '8px',
                    backgroundColor: '#333',
                    borderRadius: '4px',
                    cursor: canPlay ? 'pointer' : 'default',
                    opacity: canPlay ? 1 : 0.6,
                    touchAction: 'none'
                }}
                onPointerDown={onProgressPointerDown}
            >
                <div
                    className="progress-bar"
                    style={{
                        width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                        backgroundColor: secondaryColor,
                        transition: 'width 0.1s ease',
                        pointerEvents: 'none'
                    }}
                />
            </div>

            <div className="d-flex justify-content-between mt-2">
                <Text style={{ margin: 0, fontSize: '0.85rem' }}>{formatTime(currentTime)}</Text>
                <Text style={{ margin: 0, fontSize: '0.85rem' }}>{formatTime(duration)}</Text>
            </div>
        </div>
    );
};

export default DeckControls;
