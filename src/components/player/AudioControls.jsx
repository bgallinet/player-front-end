import React from 'react';
import { Text } from '../../utils/StyledComponents';
import { secondaryColor } from '../../utils/DisplaySettings';
import { Dropdown } from 'react-bootstrap';
import AudioDeviceButton from '../../utils/AudioDeviceButton';
import SettingsButton from '../../utils/SettingsButton';
import TutorialButton from '../../utils/TutorialButton';
import StopButton from '../../utils/StopButton';
import PlayPauseButton from '../../utils/PlayPauseButton';
import PreviousButton from '../../utils/PreviousButton';
import NextButton from '../../utils/NextButton';

const AudioControls = ({
    // Audio state
    isPlaying,
    currentTime,
    duration,
    hasValidAudioSource,
    
    // Event handlers
    onPlayPause,
    onStop,
    onPrevious,
    onNext,
    onProgressClick,
    onAudioDeviceClick,
    onEmotionMappingClick,
    
    // Detection mode
    detectionMode = 'landmark',
    onDetectionModeChange,
    
    // Tutorial state
    tutorialDismissed,
    setTutorialDismissed,
    
    // Playlist state (for previous/next buttons)
    hasPrevious = false,
    hasNext = false,
    
    // Optional props
    showPreviousNext = true,
    showAudioDevice = true,
    showEmotionMapping = true,
    showTutorial = true,
    className = '',
    style = {}
}) => {
    // Single variable for all icon sizes
    const iconSize = '3rem';
    // Format time for display
    const formatTime = (time) => {
        if (isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };


    return (
        <div className={`mb-4 ${className}`} style={style}>
            {/* Control Buttons */}
            <div className="d-flex justify-content-center align-items-center gap-4 mb-3">
                {/* Previous Button */}
                {showPreviousNext && (
                    <PreviousButton
                        onClick={onPrevious}
                        size={iconSize}
                        showTooltip={true}
                        tooltipText="Previous"
                        isEnabled={hasPrevious}
                    />
                )}
                
                {/* Detection Mode Switcher */}
                {onDetectionModeChange && (
                    <Dropdown>
                        <Dropdown.Toggle 
                            variant="outline-light"
                            size="sm"
                            style={{ 
                                fontSize: '0.8rem', 
                                whiteSpace: 'nowrap', 
                                height: '2.5rem', 
                                minWidth: '6rem',
                                boxShadow: 'none',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                background: 'transparent',
                                color: 'white'
                            }}
                        >
                            {detectionMode === 'landmark' ? '👤 Face' : '🤸 Body'}
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <Dropdown.Item 
                                onClick={() => onDetectionModeChange('landmark')}
                                active={detectionMode === 'landmark'}
                            >
                                👤 Face Mode
                            </Dropdown.Item>
                            <Dropdown.Item 
                                onClick={() => onDetectionModeChange('body')}
                                active={detectionMode === 'body'}
                            >
                                🤸 Body Mode
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                )}
                
                {/* Play/Pause Button */}
                <PlayPauseButton
                    onClick={onPlayPause}
                    isPlaying={isPlaying}
                    size={iconSize}
                    showTooltip={true}
                    isEnabled={hasValidAudioSource()}
                />

                {/* Stop Button */}
                <StopButton
                    onClick={onStop}
                    size={iconSize}
                    showTooltip={true}
                    tooltipText="Stop"
                    isEnabled={hasValidAudioSource()}
                />
                
                {/* Next Button */}
                {showPreviousNext && (
                    <NextButton
                        onClick={onNext}
                        size={iconSize}
                        showTooltip={true}
                        tooltipText="Next"
                        isEnabled={hasNext}
                    />
                )}
                
                {/* Audio Device Button */}
                {showAudioDevice && (
                    <AudioDeviceButton
                        onClick={onAudioDeviceClick}
                        size={iconSize}
                        showTooltip={true}
                        tooltipText="Audio Device Settings"
                    />
                )}
                
                {/* Emotion Mapping Button */}
                {showEmotionMapping && (
                    <SettingsButton
                        showSettings={false}
                        onToggleSettings={() => onEmotionMappingClick()}
                        size={iconSize}
                        showTooltip={true}
                        tooltipText="Emotion-to-Audio Mappings"
                    />
                )}
                
                {/* Tutorial Button */}
                {showTutorial && (
                    <TutorialButton
                        tutorialDismissed={tutorialDismissed}
                        setTutorialDismissed={setTutorialDismissed}
                        size={iconSize}
                        showTooltip={true}
                        tooltipText="Tutorial"
                    />
                )}
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
                <div
                    className="progress"
                    style={{
                        height: '8px',
                        backgroundColor: '#333',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                    onClick={onProgressClick}
                >
                    <div
                        className="progress-bar"
                        style={{
                            width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                            backgroundColor: secondaryColor,
                            transition: 'width 0.1s ease'
                        }}
                    />
                </div>
                
                {/* Time Display */}
                <div className="d-flex justify-content-between mt-2">
                    <Text style={{ margin: 0, fontSize: '0.9rem' }}>
                        {formatTime(currentTime)}
                    </Text>
                    <Text style={{ margin: 0, fontSize: '0.9rem' }}>
                        {formatTime(duration)}
                    </Text>
                </div>
            </div>
        </div>
    );
};

export default AudioControls;
