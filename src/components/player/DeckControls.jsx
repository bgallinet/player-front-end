import React, { useCallback } from 'react';
import { Spinner } from 'react-bootstrap';
import { Text } from '../../utils/StyledComponents';
import { secondaryColor } from '../../utils/DisplaySettings';
import { usePointerSlide1D } from '../../hooks/usePointerSlide1D';
import AudioDeviceButton from '../buttons/AudioDeviceButton';
import SettingsButton from '../buttons/SettingsButton';
import TutorialButton from '../buttons/TutorialButton';
import StopButton from '../buttons/StopButton';
import PlayPauseButton from '../buttons/PlayPauseButton';
import PreviousButton from '../buttons/PreviousButton';
import NextButton from '../buttons/NextButton';

const noop = () => {};
const falseFn = () => false;

export const DeckControls = ({
    deckId,
    loadedTrackName = '',
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
    /** Utility row below transport (audio device, mappings, tutorial) */
    showAudioDevice = false,
    showEmotionMapping = false,
    showTutorial = false,
    onAudioDeviceClick,
    onEmotionMappingClick,
    tutorialDismissed,
    setTutorialDismissed,
    /** Cover / artwork (URL string), e.g. SoundCloud `artwork_url` */
    artworkUrl,
    artworkSizePx = 120,
    /** Optional status line (e.g. stream loading) */
    trackStatusMessage,
    trackStatusLoading = false
}) => {
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
        (showEmotionMapping && onEmotionMappingClick) ||
        (showTutorial && setTutorialDismissed);

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
            {artworkUrl && (
                <div className="text-center" style={{ marginTop: '0.15rem', marginBottom: '0.35rem' }}>
                    <img
                        src={artworkUrl}
                        alt=""
                        draggable={false}
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
                className="d-flex justify-content-center align-items-center gap-3 mt-2 mb-2 flex-nowrap"
                style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
            >
                {showPreviousNext && (
                    <PreviousButton
                        onClick={onPrevious}
                        size={iconSize}
                        showTooltip={true}
                        tooltipText="Previous"
                        isEnabled={hasPrevious}
                    />
                )}
                <PlayPauseButton
                    onClick={onPlayPause}
                    isPlaying={isPlaying}
                    size={iconSize}
                    showTooltip={true}
                    isEnabled={canPlay}
                />
                <StopButton
                    onClick={onStop}
                    size={iconSize}
                    showTooltip={true}
                    tooltipText="Stop"
                    isEnabled={canPlay}
                />
                {showPreviousNext && (
                    <NextButton
                        onClick={onNext}
                        size={iconSize}
                        showTooltip={true}
                        tooltipText="Next"
                        isEnabled={hasNext}
                    />
                )}
            </div>

            {showUtilityRow && (
                <div
                    className="d-flex justify-content-center align-items-center gap-3 mb-2 flex-nowrap"
                    style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
                >
                    {showAudioDevice && onAudioDeviceClick && (
                        <AudioDeviceButton
                            onClick={onAudioDeviceClick}
                            size={iconSize}
                            showTooltip={true}
                            tooltipText="Audio Device Settings"
                        />
                    )}
                    {showEmotionMapping && onEmotionMappingClick && (
                        <SettingsButton
                            showSettings={false}
                            onToggleSettings={onEmotionMappingClick}
                            size={iconSize}
                            showTooltip={true}
                            tooltipText="Emotion-to-Audio Mappings"
                        />
                    )}
                    {showTutorial && setTutorialDismissed && (
                        <TutorialButton
                            tutorialDismissed={tutorialDismissed}
                            setTutorialDismissed={setTutorialDismissed}
                            size={iconSize}
                            showTooltip={true}
                            tooltipText="Tutorial"
                        />
                    )}
                </div>
            )}

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
