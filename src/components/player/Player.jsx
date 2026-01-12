import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Container, Alert } from 'react-bootstrap';
import { Text, StyledCard } from '../../utils/StyledComponents';
import { secondaryColor } from '../../utils/DisplaySettings';
import FacialLandmarkUserUI from '../sensing/FacialLandmarkUserUI';
import BodyPoseUserUI from '../sensing/BodyPoseUserUI';
import TutorialMessage from '../TutorialMessage';
import SoundConsole from '../audio_processing/SoundConsole';
import AudioControls from './AudioControls';
import AudioDeviceSelector from './AudioDeviceSelector';
import ManualMapping from './ManualMapping';
import ReactionToSoundMapper, { 
    DEFAULT_EQ_MAPPINGS, 
    DEFAULT_VOLUME_MAPPINGS, 
    DEFAULT_RHYTHMIC_ENHANCEMENT_MAPPINGS,
    DEFAULT_REVERB_MAPPINGS,
    DEFAULT_DELAY_MAPPINGS,
    EQ_PRESETS
} from './ReactionToSoundMapper';
import { useTutorial } from '../../contexts/TutorialContext';
import SettingsButton from '../../utils/SettingsButton';
import ExpandReduceButton from '../../utils/ExpandReduceButton';
import { getDemoUsername, isDemoSession } from '../../hooks/demoUserManager';
import { trackPageView } from '../../hooks/pageViewTracker';
import AnalyticsAPI from '../../utils/AnalyticsAPI';
import UserAPI from '../../utils/UserAPI';
import { getSessionNameFromUrl } from '../../hooks/sessionUtils';

const Player = ({
    // Audio source
    selectedFile,
    isDemoTrack = false,
    audioRef: externalAudioRef,
    
    // Playlist functionality (for LocalPlayer)
    playlist = [],
    currentTrackIndex = -1,
    onPlaylistChange,
    onTrackSelect,
    
    // Music event handlers
    onMusicPlay,
    onMusicPause,
    
    // Additional content to render above audio controls
    children,
    
    // Page tracking
    pageName = 'player'
}) => {
    // Audio state
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [error, setError] = useState('');
    
    // Audio controls visibility state
    const [showAudioControls, setShowAudioControls] = useState(true);
    
    // Audio processing state
    const [volume, setVolume] = useState(0.5);
    const [baseVolume, setBaseVolume] = useState(0.5);
    const [stream, setStream] = useState(null);
    const [noddingAmplitude, setNoddingAmplitude] = useState(0);
    const [handsRaised, setHandsRaised] = useState(false);
    
    // Emotion data array for ReactionToSoundMapper
    const [emotionDataArray, setEmotionDataArray] = useState([]);
    
    // Emotion mappings - use defaults from ReactionToSoundMapper
    const [eqMappings, setEqMappings] = useState(DEFAULT_EQ_MAPPINGS);
    const [volumeMappings, setVolumeMappings] = useState(DEFAULT_VOLUME_MAPPINGS);
    const [rhythmicEnhancementMappings, setRhythmicEnhancementMappings] = useState(DEFAULT_RHYTHMIC_ENHANCEMENT_MAPPINGS);
    const [reverbMappings, setReverbMappings] = useState(DEFAULT_REVERB_MAPPINGS);
    const [delayMappings, setDelayMappings] = useState(DEFAULT_DELAY_MAPPINGS);
    const [currentRecommendation, setCurrentRecommendation] = useState(null);
    
    // UI state
    const [showEmotionMappings, setShowEmotionMappings] = useState(false);
    const [showAudioModal, setShowAudioModal] = useState(false);
    
    // Demo session logic
    const [is_demo_session, setIsDemoSession] = useState(false);
    const [demo_username, setDemoUsername] = useState(() => getDemoUsername());
    
    // Detection mode state: 'landmark' or 'body'
    const [detectionMode, setDetectionMode] = useState('landmark');
    
    // Tutorial functionality
    const { isTutorialMode, toggleTutorialMode } = useTutorial();
    const [playerTutorialDismissed, setPlayerTutorialDismissed] = useState(false);
    
    const internalAudioRef = useRef(null);
    const audioRef = externalAudioRef || internalAudioRef;

    // Track page view on component mount (guard against StrictMode double-invocation)
    const hasTrackedPageView = useRef(false);
    useEffect(() => {
        if (!hasTrackedPageView.current) {
            hasTrackedPageView.current = true;
            trackPageView({
                pageName: pageName,
                additionalData: {
                    has_camera: !!stream,
                    is_demo_session: is_demo_session,
                    has_selected_file: !!selectedFile,
                    is_demo_track: isDemoTrack
                }
            });
        }
    }, []);

    // Debug mapping changes - only log when they actually change
    useEffect(() => {
    }, [eqMappings, volumeMappings, reverbMappings]);

    // Check if we have a valid audio source
    const hasValidAudioSource = useCallback(() => {
        return selectedFile && 
               audioRef.current && 
               audioRef.current.src && 
               audioRef.current.src !== '';
    }, [selectedFile]);

    // Handle EQ mapping change
    const handleEqMappingChange = (emotionState, presetName) => {
        
        // Convert keyword to vector
        const eqVector = EQ_PRESETS[presetName] || EQ_PRESETS.flat;
        
        setEqMappings(prev => {
            const newMappings = {
                ...prev,
                [emotionState]: eqVector
            };
            return newMappings;
        });
    };
    
    // Handle volume mapping change
    const handleVolumeMappingChange = (emotionState, volumeMultiplier) => {
        setVolumeMappings(prev => {
            const newMappings = {
                ...prev,
                [emotionState]: parseFloat(volumeMultiplier)
            };
            return newMappings;
        });
    };
    
    
    // Handle rhythmic enhancement mapping change
    const handleRhythmicEnhancementMappingChange = (emotionState, rhythmicEnhancement) => {
        setRhythmicEnhancementMappings(prev => {
            const newMappings = {
                ...prev,
                [emotionState]: parseFloat(rhythmicEnhancement)
            };
            return newMappings;
        });
    };

    // Handle reverb mapping change
    const handleReverbMappingChange = (emotionState, reverbAmount) => {
        setReverbMappings(prev => {
            const newMappings = {
                ...prev,
                [emotionState]: parseFloat(reverbAmount)
            };
            return newMappings;
        });
    };

    // Handle delay mapping change
    const handleDelayMappingChange = (emotionState, delayAmount) => {
        setDelayMappings(prev => {
            const newMappings = {
                ...prev,
                [emotionState]: parseFloat(delayAmount)
            };
            return newMappings;
        });
    };
    
    // Handle reset to default mappings
    const handleResetToDefaults = () => {
        setEqMappings(DEFAULT_EQ_MAPPINGS);
        setVolumeMappings(DEFAULT_VOLUME_MAPPINGS);
        setRhythmicEnhancementMappings(DEFAULT_RHYTHMIC_ENHANCEMENT_MAPPINGS);
        setReverbMappings(DEFAULT_REVERB_MAPPINGS);
        setDelayMappings(DEFAULT_DELAY_MAPPINGS);
    };

    // Handle volume change
    const handleVolumeChange = useCallback((newVolume) => {
        const volumeValue = parseFloat(newVolume);
        setVolume(volumeValue);
        setBaseVolume(volumeValue);
    }, []);


    // Collect facial landmark data from localStorage
    useEffect(() => {
        const collectFacialLandmarkData = () => {
            try {
                let storedFaceData = null;
                let storedFaceVisible = null;
                
                try {
                    storedFaceData = localStorage.getItem('face_position_data_arrays');
                    storedFaceVisible = localStorage.getItem('face_visible');
                } catch (storageError) {
                    // Silent error handling
                    return;
                }
                
                if (storedFaceData && storedFaceVisible === 'true') {
                    try {
                        const parsedArrays = JSON.parse(storedFaceData);
                        
                        const latestAmplitude = parsedArrays.noddingAmplitude || 0;
                        const latestFrequency = parsedArrays.noddingFrequency || 0;
                        
                        setNoddingAmplitude(latestAmplitude);
                        
                        const dataPoints = parsedArrays.timestamps.map((timestamp, index) => ({
                            timestamp: timestamp,
                            smiling: parsedArrays.smilingArray ? parsedArrays.smilingArray[index] : 0,
                            jawOpen: parsedArrays.jawOpenArray ? parsedArrays.jawOpenArray[index] : 0,
                            frequency: parsedArrays.frequencyArray ? parsedArrays.frequencyArray[index] : latestFrequency,
                            amplitude: parsedArrays.amplitudeArray ? parsedArrays.amplitudeArray[index] : latestAmplitude,
                            xPosition: parsedArrays.centerXPositions[index],
                            yPosition: parsedArrays.centerYPositions[index],
                            width: parsedArrays.widthPositions[index],
                            height: parsedArrays.heightPositions[index]
                        }));
                        
                        setEmotionDataArray(dataPoints);
                        
                    } catch (parseError) {
                        // Silent error handling
                    }
                } else {
                    setEmotionDataArray([]);
                    setNoddingAmplitude(0);
                }
                
                // Collect hand raising data from localStorage
                try {
                    const leftHandRaised = localStorage.getItem('left_hand_raised') === 'true';
                    const rightHandRaised = localStorage.getItem('right_hand_raised') === 'true';
                    setHandsRaised(leftHandRaised || rightHandRaised);
                } catch (error) {
                    setHandsRaised(false);
                }
                
            } catch (error) {
                // Silent error handling
            }
        };
        
        collectFacialLandmarkData();
        // Read more frequently to catch data before it's cleared
        const interval = setInterval(collectFacialLandmarkData, 200);
        
        return () => {
            clearInterval(interval);
        };
    }, []);
    
    // Handle recommendations from ReactionToSoundMapper - simplified approach
    const handleRecommendationChange = useCallback((recommendation) => {
        // Handle recommendation change
        
        // Store the recommendation in state so it can be passed to SoundConsole
        setCurrentRecommendation(recommendation);
        
        // Also pass the recommendation to SoundConsole for processing
        if (audioRef.current && audioRef.current.soundConsoleMethods && audioRef.current.soundConsoleMethods.applyRecommendation) {
            audioRef.current.soundConsoleMethods.applyRecommendation(recommendation);
        }
    }, []);

    // Set demo session mode
    useEffect(() => {
        if (isDemoTrack) {
            setIsDemoSession(true);
        } else {
            const storedToken = localStorage.getItem('idToken');
            setIsDemoSession(!storedToken);
        }
    }, [isDemoTrack]);

    // Initialize camera stream
    useEffect(() => {
        const initializeCamera = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: 'user',
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    } 
                });
                setStream(mediaStream);
                // Camera stream initialized
            } catch (error) {
                // Camera access denied or not available
                setStream(null);
            }
        };

        if (selectedFile) {
            initializeCamera();
        }

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [selectedFile]);


    // Handle play/pause
    const handlePlayPause = async () => {
        if (!audioRef.current) {
            // Audio ref is null
            setError('Audio element not found');
            return;
        }

        if (!selectedFile) {
            // No file selected
            setError('Please select an audio file first');
            return;
        }

        try {
            // Initialize audio context with user interaction
            if (audioRef.current && audioRef.current.soundConsoleMethods) {
                const success = await audioRef.current.soundConsoleMethods.initializeAudioContext();
                if (!success) {
                    setError('Audio processing not supported in this browser');
                    return;
                }
                
                const audioContext = audioRef.current.audioContextRef?.current;
                if (audioContext && audioContext.state === 'suspended') {
                    // Resume suspended audio context (required for secure contexts)
                    try {
                        await audioContext.resume();
                    } catch (resumeError) {
                        // Continue anyway, might still work
                    }
                }
                
                // Ensure all effects are created after audio context is active
                if (audioRef.current.soundConsoleMethods.forceAllEffectsCreation) {
                    setTimeout(() => {
                        audioRef.current.soundConsoleMethods.forceAllEffectsCreation();
                    }, 200);
                }
            }
            
            if (isPlaying) {
                // Analytics: track pause
                try {
                    const isDemo = isDemoSession();
                    const pauseData = {
                        request_type: 'analytics',
                        interaction_type: 'user_interaction',
                        element_id: 'pause_music',
                        page_url: window.location.href,
                        session_name: getSessionNameFromUrl() || `${pageName}_session`
                    };
                    
                    if (isDemo) {
                        pauseData.user_name = getDemoUsername();
                        AnalyticsAPI(JSON.stringify(pauseData)); // fire-and-forget
                    } else {
                        UserAPI(JSON.stringify(pauseData)); // fire-and-forget
                    }
                } catch (error) {
                    // Analytics API error
                }
                
                audioRef.current.pause();
                setIsPlaying(false);
                if (onMusicPause) onMusicPause();
            } else {
                // Analytics: track play
                try {
                    const isDemo = isDemoSession();
                    const playData = {
                        request_type: 'analytics',
                        interaction_type: 'user_interaction',
                        element_id: 'play_music',
                        page_url: window.location.href,
                        session_name: getSessionNameFromUrl() || `${pageName}_session`
                    };
                    
                    if (isDemo) {
                        playData.user_name = getDemoUsername();
                        AnalyticsAPI(JSON.stringify(playData)); // fire-and-forget
                    } else {
                        UserAPI(JSON.stringify(playData)); // fire-and-forget
                    }
                } catch (error) {
                    // Analytics API error
                }
                
                await audioRef.current.play();
                setIsPlaying(true);
                if (onMusicPlay) onMusicPlay();
            }
            
        } catch (error) {
            setError(`Failed to play audio: ${error.message}`);
        }
    };

    // Handle stop
    const handleStop = () => {
        // Analytics: track stop
        try {
            const isDemo = isDemoSession();
            const stopData = {
                request_type: 'analytics',
                interaction_type: 'user_interaction',
                element_id: 'stop_music',
                page_url: window.location.href,
                session_name: getSessionNameFromUrl() || `${pageName}_session`
            };
            
            if (isDemo) {
                stopData.user_name = getDemoUsername();
                AnalyticsAPI(JSON.stringify(stopData)); // fire-and-forget
            } else {
                UserAPI(JSON.stringify(stopData)); // fire-and-forget
            }
        } catch (error) {
            // Analytics API error
        }
        
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
            setCurrentTime(0);
            if (onMusicPause) onMusicPause();
        }
    };

    // Handle next track
    const handleNext = () => {
        if (playlist.length > 0 && currentTrackIndex >= 0) {
            const nextIndex = currentTrackIndex + 1;
            if (nextIndex < playlist.length) {
                onTrackSelect(playlist[nextIndex], nextIndex, isPlaying);
            }
        }
    };

    // Handle previous track
    const handlePrevious = () => {
        if (playlist.length > 0 && currentTrackIndex >= 0) {
            const prevIndex = currentTrackIndex - 1;
            if (prevIndex >= 0) {
                onTrackSelect(playlist[prevIndex], prevIndex, isPlaying);
            }
        }
    };

    // Audio event handlers
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
        };

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
            if (onMusicPause) onMusicPause();
            
            // Auto-play next track if in playlist mode
            if (playlist.length > 0 && currentTrackIndex >= 0) {
                const nextIndex = currentTrackIndex + 1;
                if (nextIndex < playlist.length) {
                    setTimeout(() => {
                        onTrackSelect(playlist[nextIndex], nextIndex, true);
                    }, 500);
                }
            }
        };

        const handleError = () => {
            setError('Error loading audio file. Please try another file.');
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
    }, [selectedFile, playlist, currentTrackIndex, onTrackSelect]);

    // Handle progress bar click
    const handleProgressClick = (event) => {
        if (audioRef.current && duration > 0) {
            const progressBar = event.currentTarget;
            const clickX = event.nativeEvent.offsetX;
            const width = progressBar.offsetWidth;
            const newTime = (clickX / width) * duration;
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    // Handle detection mode change
    const handleDetectionModeChange = (mode) => {
        setDetectionMode(mode);
    };

    return (
        <Container fluid className="mt-4 px-3">
            {/* Tutorial Message */}
            {isTutorialMode && !playerTutorialDismissed && (
                <TutorialMessage 
                    messages={[
                        "Welcome to the Soundbloom player ! Use your webcam to detect your facial expressions, head nodding, hand raising, and adjust the audio in real-time.",
                        "Get music started, allow to capture face movements capture, and play with audio effects.",
                        "You can customize audio mappings to create your own personal audio experience."
                    ]}
                    position="top-center"
                    onClose={() => setPlayerTutorialDismissed(true)}
                />
            )}

            <div className="bg-dark rounded p-4" style={{ backgroundColor: '#1a1a1a' }}>
                {/* Error Display */}
                {error && (
                    <Alert variant="danger" className="mb-4">
                        {error}
                    </Alert>
                )}

                {/* Audio Controls */}
                {selectedFile && (
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                        <AudioControls
                            isPlaying={isPlaying}
                            currentTime={currentTime}
                            duration={duration}
                            hasValidAudioSource={hasValidAudioSource}
                            onPlayPause={handlePlayPause}
                            onStop={handleStop}
                            onPrevious={handlePrevious}
                            onNext={handleNext}
                            onProgressClick={handleProgressClick}
                            onAudioDeviceClick={() => setShowAudioModal(true)}
                            onEmotionMappingClick={() => setShowEmotionMappings(true)}
                            detectionMode={detectionMode}
                            onDetectionModeChange={handleDetectionModeChange}
                            tutorialDismissed={playerTutorialDismissed}
                            setTutorialDismissed={setPlayerTutorialDismissed}
                            hasPrevious={playlist.length > 0 && currentTrackIndex > 0}
                            hasNext={playlist.length > 0 && currentTrackIndex < playlist.length - 1}
                            showPreviousNext={playlist.length > 0}
                            showAudioDevice={true}
                            showEmotionMapping={true}
                            showTutorial={true}
                            style={{ marginBottom: '0' }}
                        />

                        {/* Detection UI - Conditional rendering based on mode */}
                        {stream && (
                            <>
                                {detectionMode === 'landmark' && (
                                    <FacialLandmarkUserUI 
                                        stream={stream}
                                        embeddingTW={false}
                                        is_demo_session={is_demo_session}
                                        demo_username={demo_username}
                                        sessionName={`${pageName}_session`}
                                        sizeMode="large"
                                    />
                                )}
                                {detectionMode === 'body' && (
                                    <BodyPoseUserUI 
                                        stream={stream}
                                        embeddingTW={false}
                                        is_demo_session={is_demo_session}
                                        demo_username={demo_username}
                                        sessionName={`${pageName}_session`}
                                        sizeMode="large"
                                    />
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Additional content (track selection, playlist, etc.) */}
                {children}

                {/* SoundConsole Component - At the bottom */}
                {selectedFile && (
                    <StyledCard className="mb-4">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <Text style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>
                                Sound Console
                            </Text>
                            <div className="d-flex gap-2 align-items-center">
                                <ExpandReduceButton
                                    isExpanded={showAudioControls}
                                    onToggle={() => setShowAudioControls(!showAudioControls)}
                                />
                            </div>
                        </div>
                        
                        {showAudioControls && (
                            <SoundConsole
                                audioRef={audioRef}
                                volume={volume}
                                baseVolume={baseVolume}
                                onVolumeChange={handleVolumeChange}
                                eqMappings={eqMappings}
                                volumeMappings={volumeMappings}
                                recommendation={currentRecommendation}
                                rhythmicEnhancementMappings={rhythmicEnhancementMappings}
                                reverbMappings={reverbMappings}
                                noddingAmplitude={noddingAmplitude}
                            />
                        )}
                    </StyledCard>
                )}

                {/* Hidden Audio Element */}
                <audio 
                    ref={audioRef} 
                    preload="metadata"
                    onLoadedMetadata={() => {
                        if (audioRef.current) {
                            setDuration(audioRef.current.duration);
                        }
                    }}
                    onTimeUpdate={() => {
                        if (audioRef.current) {
                            setCurrentTime(audioRef.current.currentTime);
                        }
                    }}
                    onEnded={() => {
                        setIsPlaying(false);
                        setCurrentTime(0);
                    }}
                    onPlay={() => {
                        setIsPlaying(true);
                        if (onMusicPlay) onMusicPlay();
                    }}
                    onPause={() => {
                        setIsPlaying(false);
                        if (onMusicPause) onMusicPause();
                    }}
                    onError={(e) => {
                        // Audio error
                        setError('Error loading audio file');
                        setIsPlaying(false);
                    }}
                />
            </div>

            {/* Facial Landmark Detection Section */}
            {selectedFile && (
                <>
                    {stream ? (
                        <>
                            <ReactionToSoundMapper
                                emotionDataArray={emotionDataArray}
                                noddingAmplitude={noddingAmplitude}
                                handsRaised={handsRaised}
                                eqMappings={eqMappings}
                                volumeMappings={volumeMappings}
                                rhythmicEnhancementMappings={rhythmicEnhancementMappings}
                                reverbMappings={reverbMappings}
                                delayMappings={delayMappings}
                                onRecommendationChange={(recommendation) => {
                                    // ReactionToSoundMapper calling onRecommendationChange
                                    handleRecommendationChange(recommendation);
                                }}
                            />
                            
                        </>
                    ) : (
                        <div className="text-center py-4">
                            <Text>Please allow camera access to enable facial landmark detection features.</Text>
                        </div>
                    )}
                </>
            )}

            {/* Audio Device Selection Modal */}
            <AudioDeviceSelector 
                show={showAudioModal} 
                onHide={() => setShowAudioModal(false)}
            />
            
            {/* Manual Mapping Component */}
            <ManualMapping
                eqMappings={eqMappings}
                onEmotionMappingChange={handleEqMappingChange}
                volumeMappings={volumeMappings}
                onVolumeMappingChange={handleVolumeMappingChange}
                rhythmicEnhancementMappings={rhythmicEnhancementMappings}
                onRhythmicEnhancementMappingChange={handleRhythmicEnhancementMappingChange}
                reverbMappings={reverbMappings}
                onReverbMappingChange={handleReverbMappingChange}
                delayMappings={delayMappings}
                onDelayMappingChange={handleDelayMappingChange}
                showEmotionMappings={showEmotionMappings}
                onToggleEmotionMappings={setShowEmotionMappings}
            />
            
        </Container>
    );
};

export default Player;
