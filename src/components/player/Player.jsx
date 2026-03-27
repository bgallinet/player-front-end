import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Container, Alert, Button, Dropdown } from 'react-bootstrap';
import { Text } from '../../utils/StyledComponents';
import { secondaryColor } from '../../utils/DisplaySettings';
import FacialLandmarkUserUI from '../sensing/FacialLandmarkUserUI';
import BodyPoseUserUI from '../sensing/BodyPoseUserUI';
import TutorialMessage from '../TutorialMessage';
import Deck from './Deck';
import DeckControls from './DeckControls';
import AudioDeviceSelector from './AudioDeviceSelector';
import ManualMapping from './ManualMapping';
import ReactionToSoundMapper, { 
    DEFAULT_EQ_MAPPINGS, 
    DEFAULT_VOLUME_MAPPINGS, 
    DEFAULT_RHYTHMIC_ENHANCEMENT_MAPPINGS,
    DEFAULT_REVERB_MAPPINGS,
    DEFAULT_DELAY_MAPPINGS,
    DEFAULT_KEY_SHIFT_MAPPINGS,
    DEFAULT_BPM_SHIFT_MAPPINGS,
    EQ_PRESETS
} from './ReactionToSoundMapper';
import { useTutorial } from '../../contexts/TutorialContext';
import { getDemoUsername, isDemoSession } from '../../hooks/demoUserManager';
import AudioDeviceButton from '../buttons/AudioDeviceButton';
import SettingsButton from '../buttons/SettingsButton';
import TutorialButton from '../buttons/TutorialButton';
import { trackPageView } from '../../hooks/pageViewTracker';

function resolveDeckArtworkUrl(source) {
    if (!source?.artwork_url || typeof source.artwork_url !== 'string') {
        return null;
    }
    const url = source.artwork_url;
    return url.includes('-large') ? url.replace('-large', '-t300x300') : url;
}

/** Prefer React state duration; fall back to element (HLS/live can populate seekable before duration settles). */
function resolveMediaDuration(audioEl, stateDuration) {
    if (Number.isFinite(stateDuration) && stateDuration > 0) {
        return stateDuration;
    }
    if (audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
        return audioEl.duration;
    }
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

const Player = ({
    // Audio source
    selectedFile,
    isDemoTrack = false,
    audioRef: externalAudioRef,
    deckBAudioRef: externalDeckBAudioRef,
    
    // Playlist functionality (for LocalPlayer)
    playlist = [],
    currentTrackIndex = -1,
    onPlaylistChange,
    onTrackSelect,
    onLoadDeckBTrack,
    
    // Music event handlers
    onMusicPlay,
    onMusicPause,
    
    // Additional content to render above audio controls
    children,
    
    // Page tracking
    pageName = 'player',

    /** Shown on deck A when the track has no `artwork_url` (e.g. local/demo hero image) */
    fallbackDeckArtworkSrc,
    /** Deck A transport status (e.g. SoundCloud stream loading) */
    deckATrackStatusMessage,
    deckATrackStatusLoading = false,

    /** When true, pressing Play on deck A bumps a counter so Face landmark UI can start if idle */
    autoStartLandmarkWithMusic = false
}) => {
    // Audio state
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [error, setError] = useState('');
    
    const [secondDeckActive, setSecondDeckActive] = useState(false);
    
    // Audio processing state
    const [volume, setVolume] = useState(0.5);
    const [baseVolume, setBaseVolume] = useState(0.5);
    const [volumeDeckB, setVolumeDeckB] = useState(0.5);
    const [baseVolumeDeckB, setBaseVolumeDeckB] = useState(0.5);
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
    const [keyShiftMappings, setKeyShiftMappings] = useState(DEFAULT_KEY_SHIFT_MAPPINGS);
    const [bpmShiftMappings, setBpmShiftMappings] = useState(DEFAULT_BPM_SHIFT_MAPPINGS);
    const [currentRecommendation, setCurrentRecommendation] = useState(null);
    
    // UI state
    const [showEmotionMappings, setShowEmotionMappings] = useState(false);
    const [showAudioModal, setShowAudioModal] = useState(false);
    const [loadedDeckATrack, setLoadedDeckATrack] = useState(null);
    const [loadedDeckBTrack, setLoadedDeckBTrack] = useState(null);
    const [isPlayingDeckB, setIsPlayingDeckB] = useState(false);
    const [durationDeckB, setDurationDeckB] = useState(0);
    const [currentTimeDeckB, setCurrentTimeDeckB] = useState(0);
    
    // Demo session logic
    const [is_demo_session, setIsDemoSession] = useState(false);
    const [demo_username, setDemoUsername] = useState(() => getDemoUsername());
    
    // Detection mode state: 'landmark' or 'body'
    const [detectionMode, setDetectionMode] = useState('landmark');
    
    // Tutorial functionality
    const { isTutorialMode, toggleTutorialMode } = useTutorial();
    const [playerTutorialDismissed, setPlayerTutorialDismissed] = useState(false);
    const [landmarkAutoStartTick, setLandmarkAutoStartTick] = useState(0);
    const [detectionForceStopTick, setDetectionForceStopTick] = useState(0);

    const internalAudioRef = useRef(null);
    const audioRef = externalAudioRef || internalAudioRef;
    const internalDeckBAudioRef = useRef(null);
    const deckBAudioRef = externalDeckBAudioRef || internalDeckBAudioRef;

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
        return !!(
            audioRef.current &&
            audioRef.current.src &&
            audioRef.current.src !== ''
        );
    }, [audioRef]);

    const hasValidAudioSourceDeckB = useCallback(() => {
        const el = deckBAudioRef.current;
        if (!el) return false;
        const hasSrc = !!(el.src && el.src !== '');
        const hasMeta = el.readyState >= HTMLMediaElement.HAVE_METADATA;
        return hasSrc || hasMeta || !!loadedDeckBTrack;
    }, [deckBAudioRef, loadedDeckBTrack]);

    // Main deck empty (no audio src) and nothing selected yet — load first playlist item
    useEffect(() => {
        if (!onTrackSelect || playlist.length === 0) {
            return;
        }
        if (hasValidAudioSource()) {
            return;
        }
        if (currentTrackIndex >= 0) {
            return;
        }
        onTrackSelect(playlist[0], 0, false);
    }, [playlist, onTrackSelect, hasValidAudioSource, currentTrackIndex]);

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

    const handleKeyShiftMappingChange = (emotionState, semitones) => {
        setKeyShiftMappings(prev => ({
            ...prev,
            [emotionState]: parseInt(semitones, 10)
        }));
    };

    const handleBpmShiftMappingChange = (emotionState, percent) => {
        setBpmShiftMappings(prev => ({
            ...prev,
            [emotionState]: parseInt(percent, 10)
        }));
    };
    
    // Handle reset to default mappings
    const handleResetToDefaults = () => {
        setEqMappings(DEFAULT_EQ_MAPPINGS);
        setVolumeMappings(DEFAULT_VOLUME_MAPPINGS);
        setRhythmicEnhancementMappings(DEFAULT_RHYTHMIC_ENHANCEMENT_MAPPINGS);
        setReverbMappings(DEFAULT_REVERB_MAPPINGS);
        setDelayMappings(DEFAULT_DELAY_MAPPINGS);
        setKeyShiftMappings(DEFAULT_KEY_SHIFT_MAPPINGS);
        setBpmShiftMappings(DEFAULT_BPM_SHIFT_MAPPINGS);
    };

    // Handle volume change
    const handleVolumeChange = useCallback((newVolume) => {
        const volumeValue = parseFloat(newVolume);
        setVolume(volumeValue);
        setBaseVolume(volumeValue);
    }, []);

    const handleVolumeChangeDeckB = useCallback((newVolume) => {
        const volumeValue = parseFloat(newVolume);
        setVolumeDeckB(volumeValue);
        setBaseVolumeDeckB(volumeValue);
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

    // Initialize camera stream on mount so detection is always available
    useEffect(() => {
        let mediaStream = null;

        const initializeCamera = async () => {
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({ 
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

        initializeCamera();

        return () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);


    // Handle play/pause
    const handlePlayPause = async () => {
        if (!audioRef.current) {
            // Audio ref is null
            setError('Audio element not found');
            return;
        }

        if (!hasValidAudioSource()) {
            // No audio source selected/loaded
            setError('Please select an audio track first');
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
                audioRef.current.pause();
                setIsPlaying(false);
                if (onMusicPause) onMusicPause();
            } else {
                await audioRef.current.play();
                setIsPlaying(true);
                if (onMusicPlay) onMusicPlay();
                if (autoStartLandmarkWithMusic && detectionMode === 'landmark') {
                    setLandmarkAutoStartTick((t) => t + 1);
                }
            }
            
        } catch (error) {
            setError(`Failed to play audio: ${error.message}`);
        }
    };

    // Handle stop
    const handleStop = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
            setCurrentTime(0);
            if (onMusicPause) onMusicPause();
            if (stream) {
                setDetectionForceStopTick((t) => t + 1);
            }
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

    const handleProgressSeek = useCallback((fraction) => {
        const audio = audioRef.current;
        if (!audio) return;
        const dur = resolveMediaDuration(audio, duration);
        if (!dur) return;
        const newTime = Math.min(1, Math.max(0, fraction)) * dur;
        audio.currentTime = newTime;
        setCurrentTime(newTime);
    }, [duration]);

    const handlePlayPauseDeckB = async () => {
        if (!deckBAudioRef.current) {
            setError('Second track audio element not found');
            return;
        }

        if (!hasValidAudioSourceDeckB()) {
            setError('Please load a track into the second player first');
            return;
        }

        try {
            if (deckBAudioRef.current.soundConsoleMethods) {
                const success = await deckBAudioRef.current.soundConsoleMethods.initializeAudioContext();
                if (!success) {
                    setError('Second track: audio processing not supported in this browser');
                    return;
                }
                const audioContext = deckBAudioRef.current.audioContextRef?.current;
                if (audioContext && audioContext.state === 'suspended') {
                    try {
                        await audioContext.resume();
                    } catch (resumeError) {
                        // continue
                    }
                }
                if (deckBAudioRef.current.soundConsoleMethods.forceAllEffectsCreation) {
                    setTimeout(() => {
                        deckBAudioRef.current.soundConsoleMethods.forceAllEffectsCreation();
                    }, 200);
                }
            }

            if (isPlayingDeckB) {
                deckBAudioRef.current.pause();
                setIsPlayingDeckB(false);
            } else {
                await deckBAudioRef.current.play();
                setIsPlayingDeckB(true);
            }
        } catch (playbackError) {
            setError(`Second track playback failed: ${playbackError.message}`);
        }
    };

    const handleStopDeckB = () => {
        if (deckBAudioRef.current) {
            deckBAudioRef.current.pause();
            deckBAudioRef.current.currentTime = 0;
            setIsPlayingDeckB(false);
            setCurrentTimeDeckB(0);
        }
    };

    const handleProgressSeekDeckB = useCallback((fraction) => {
        const audio = deckBAudioRef.current;
        if (!audio) return;
        const dur = resolveMediaDuration(audio, durationDeckB);
        if (!dur) return;
        const newTime = Math.min(1, Math.max(0, fraction)) * dur;
        audio.currentTime = newTime;
        setCurrentTimeDeckB(newTime);
    }, [durationDeckB]);

    // Handle detection mode change
    const handleDetectionModeChange = (mode) => {
        setDetectionMode(mode);
    };

    // Handle dropping/loading a track into deck A or B
    const handleLoadTrackToDeck = useCallback(async (deckId, track) => {
        if (!track) {
            return;
        }

        const normalizedDeckTrack = {
            ...track,
            displayName: track.name || track.title || track.file?.name || 'Unknown track',
            loadedAt: Date.now()
        };

        if (deckId === 'A') {
            setLoadedDeckATrack(normalizedDeckTrack);

            if (onTrackSelect) {
                const droppedPlaylistIndex = typeof track.playlistIndex === 'number' ? track.playlistIndex : -1;
                const playlistIndex = droppedPlaylistIndex >= 0
                    ? droppedPlaylistIndex
                    : playlist.findIndex((playlistTrack) =>
                        (playlistTrack.id && track.id && playlistTrack.id === track.id) ||
                        (playlistTrack.name && track.name && playlistTrack.name === track.name)
                    );

                // Load track into active player transport when possible.
                if (playlistIndex >= 0) {
                    onTrackSelect(playlist[playlistIndex], playlistIndex, false);
                } else {
                    onTrackSelect(track, currentTrackIndex, false);
                }
            }
            return;
        }

        if (deckId === 'B') {
            setLoadedDeckBTrack(normalizedDeckTrack);

            if (onLoadDeckBTrack) {
                await onLoadDeckBTrack(track);
                return;
            }

            if (deckBAudioRef.current) {
                // Local fallback loading when no external Deck B loader is provided.
                if (track.file) {
                    const audioUrl = URL.createObjectURL(track.file);
                    deckBAudioRef.current.src = audioUrl;
                    deckBAudioRef.current.load();
                } else if (track.url) {
                    deckBAudioRef.current.src = track.url;
                    deckBAudioRef.current.load();
                } else {
                    setError('Second track could not be loaded');
                }
            }
        }
    }, [onTrackSelect, playlist, currentTrackIndex, onLoadDeckBTrack, deckBAudioRef]);

    // Deck B audio event handlers
    useEffect(() => {
        const audio = deckBAudioRef.current;
        if (!audio) return;

        const handleLoadedMetadata = () => {
            setDurationDeckB(audio.duration || 0);
        };

        const handleTimeUpdate = () => {
            setCurrentTimeDeckB(audio.currentTime || 0);
        };

        const handleEnded = () => {
            setIsPlayingDeckB(false);
            setCurrentTimeDeckB(0);
        };

        const handleErrorDeckB = () => {
            setError('Error loading second track audio');
            setIsPlayingDeckB(false);
        };

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleErrorDeckB);

        return () => {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleErrorDeckB);
        };
    }, [deckBAudioRef]);

    const deck1ArtworkUrl =
        resolveDeckArtworkUrl(loadedDeckATrack) ||
        resolveDeckArtworkUrl(selectedFile) ||
        fallbackDeckArtworkSrc ||
        null;
    const deck2ArtworkUrl = resolveDeckArtworkUrl(loadedDeckBTrack) || null;
    const deck1ArtworkSizePx = secondDeckActive ? 96 : 120;
    const deck2ArtworkSizePx = 96;

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
                {/* Playback controls, detection, and sound console — above library / track UI */}
                <div className="d-flex flex-column mb-4" style={{ width: '100%', overflow: 'visible' }}>
                    <div className="d-flex justify-content-end mb-2 flex-wrap gap-2">
                        {!secondDeckActive && (
                            <Button
                                variant="outline-light"
                                size="sm"
                                type="button"
                                onClick={() => setSecondDeckActive(true)}
                                style={{ fontSize: '0.8rem', borderColor: secondaryColor }}
                            >
                                Second track
                            </Button>
                        )}
                        {secondDeckActive && (
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                type="button"
                                onClick={() => {
                                    setSecondDeckActive(false);
                                    handleStopDeckB();
                                }}
                                style={{ fontSize: '0.8rem' }}
                            >
                                Remove second track
                            </Button>
                        )}
                    </div>

                    {secondDeckActive && (
                        <div className="d-flex justify-content-center mb-3">
                            <Dropdown>
                                <Dropdown.Toggle
                                    variant="outline-light"
                                    size="sm"
                                    style={{
                                        fontSize: '0.65rem',
                                        whiteSpace: 'nowrap',
                                        height: '1.75rem',
                                        minWidth: '4.2rem',
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
                                        onClick={() => handleDetectionModeChange('landmark')}
                                        active={detectionMode === 'landmark'}
                                    >
                                        👤 Face Mode
                                    </Dropdown.Item>
                                    <Dropdown.Item
                                        onClick={() => handleDetectionModeChange('body')}
                                        active={detectionMode === 'body'}
                                    >
                                        🤸 Body Mode
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </div>
                    )}

                    <div className="row g-3">
                        <div className={secondDeckActive ? 'col-12 col-lg-6' : 'col-12'}>
                            <Deck
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
                                consoleZIndex={1045}
                            >
                                <DeckControls
                                    deckId="A"
                                    onLoadTrack={handleLoadTrackToDeck}
                                    loadedTrackName={loadedDeckATrack?.displayName || selectedFile?.name || ''}
                                    isPlaying={isPlaying}
                                    currentTime={currentTime}
                                    duration={duration}
                                    hasValidAudioSource={hasValidAudioSource}
                                    onPlayPause={handlePlayPause}
                                    onStop={handleStop}
                                    onPrevious={handlePrevious}
                                    onNext={handleNext}
                                    onProgressSeek={handleProgressSeek}
                                    hasPrevious={playlist.length > 0 && currentTrackIndex > 0}
                                    hasNext={playlist.length > 0 && currentTrackIndex < playlist.length - 1}
                                    iconSize={secondDeckActive ? '1.68rem' : '2.1rem'}
                                    showPreviousNext={playlist.length > 0}
                                    showDetectionMode={!secondDeckActive}
                                    detectionMode={detectionMode}
                                    onDetectionModeChange={handleDetectionModeChange}
                                    showAudioDevice={!secondDeckActive}
                                    showEmotionMapping={!secondDeckActive}
                                    showTutorial={!secondDeckActive}
                                    onAudioDeviceClick={
                                        secondDeckActive ? undefined : () => setShowAudioModal(true)
                                    }
                                    onEmotionMappingClick={
                                        secondDeckActive ? undefined : () => setShowEmotionMappings(true)
                                    }
                                    tutorialDismissed={playerTutorialDismissed}
                                    setTutorialDismissed={setPlayerTutorialDismissed}
                                    artworkUrl={deck1ArtworkUrl}
                                    artworkSizePx={deck1ArtworkSizePx}
                                    trackStatusMessage={deckATrackStatusMessage}
                                    trackStatusLoading={deckATrackStatusLoading}
                                />
                            </Deck>
                        </div>
                        {secondDeckActive && (
                            <div className="col-12 col-lg-6">
                                <Deck
                                    audioRef={deckBAudioRef}
                                    volume={volumeDeckB}
                                    baseVolume={baseVolumeDeckB}
                                    onVolumeChange={handleVolumeChangeDeckB}
                                    eqMappings={eqMappings}
                                    volumeMappings={volumeMappings}
                                    recommendation={null}
                                    rhythmicEnhancementMappings={rhythmicEnhancementMappings}
                                    reverbMappings={reverbMappings}
                                    noddingAmplitude={noddingAmplitude}
                                    consoleZIndex={1055}
                                >
                                    <DeckControls
                                        deckId="B"
                                        onLoadTrack={handleLoadTrackToDeck}
                                        loadedTrackName={loadedDeckBTrack?.displayName || ''}
                                        isPlaying={isPlayingDeckB}
                                        currentTime={currentTimeDeckB}
                                        duration={durationDeckB}
                                        hasValidAudioSource={hasValidAudioSourceDeckB}
                                        onPlayPause={handlePlayPauseDeckB}
                                        onStop={handleStopDeckB}
                                        onProgressSeek={handleProgressSeekDeckB}
                                        hasPrevious={false}
                                        hasNext={false}
                                        iconSize="1.68rem"
                                        showPreviousNext={false}
                                        artworkUrl={deck2ArtworkUrl}
                                        artworkSizePx={deck2ArtworkSizePx}
                                    />
                                </Deck>
                            </div>
                        )}
                    </div>

                    {secondDeckActive && (
                        <div
                            className="d-flex justify-content-center align-items-center gap-3 mt-3 mb-1 flex-nowrap"
                            style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
                        >
                            <AudioDeviceButton
                                onClick={() => setShowAudioModal(true)}
                                size="1.82rem"
                                showTooltip={true}
                                tooltipText="Audio Device Settings"
                            />
                            <SettingsButton
                                showSettings={false}
                                onToggleSettings={() => setShowEmotionMappings(true)}
                                size="1.82rem"
                                showTooltip={true}
                                tooltipText="Emotion-to-Audio Mappings"
                            />
                            <TutorialButton
                                tutorialDismissed={playerTutorialDismissed}
                                setTutorialDismissed={setPlayerTutorialDismissed}
                                size="1.82rem"
                                showTooltip={true}
                                tooltipText="Tutorial"
                            />
                        </div>
                    )}

                    {/* Detection UI - Conditional rendering based on mode */}
                    {stream && (
                        <div style={{ width: '100%', position: 'relative', zIndex: 1, clear: 'both', marginTop: '0.5rem', marginBottom: '1rem' }}>
                            {detectionMode === 'landmark' && (
                                <FacialLandmarkUserUI
                                    stream={stream}
                                    embeddingTW={false}
                                    is_demo_session={is_demo_session}
                                    demo_username={demo_username}
                                    sessionName={`${pageName}_session`}
                                    sizeMode="large"
                                    autoStartLandmarkTick={
                                        autoStartLandmarkWithMusic ? landmarkAutoStartTick : 0
                                    }
                                    forceStopDetectionTick={detectionForceStopTick}
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
                                    forceStopDetectionTick={detectionForceStopTick}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Error Display */}
                {error && (
                    <Alert variant="danger" className="mb-4">
                        {error}
                    </Alert>
                )}

                {/* Additional content (track selection, playlist, library, etc.) */}
                {children}

                {/* Hidden Audio Element */}
                <audio 
                    ref={audioRef} 
                    preload="metadata"
                    crossOrigin="anonymous"
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

                {/* Hidden Deck B Audio Element */}
                <audio
                    ref={deckBAudioRef}
                    preload="metadata"
                    crossOrigin="anonymous"
                    onLoadedMetadata={() => {
                        if (deckBAudioRef.current) {
                            setDurationDeckB(deckBAudioRef.current.duration || 0);
                        }
                    }}
                    onDurationChange={() => {
                        if (deckBAudioRef.current) {
                            const d = deckBAudioRef.current.duration;
                            if (Number.isFinite(d) && d > 0) {
                                setDurationDeckB(d);
                            }
                        }
                    }}
                    onTimeUpdate={() => {
                        if (deckBAudioRef.current) {
                            setCurrentTimeDeckB(deckBAudioRef.current.currentTime || 0);
                        }
                    }}
                    onEnded={() => {
                        setIsPlayingDeckB(false);
                        setCurrentTimeDeckB(0);
                    }}
                    onPlay={() => {
                        setIsPlayingDeckB(true);
                    }}
                    onPause={() => {
                        setIsPlayingDeckB(false);
                    }}
                    onError={() => {
                        setError('Error loading second track audio file');
                        setIsPlayingDeckB(false);
                    }}
                />
            </div>

            {/* Facial Landmark Detection Section */}
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
                            keyShiftMappings={keyShiftMappings}
                            bpmShiftMappings={bpmShiftMappings}
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
                keyShiftMappings={keyShiftMappings}
                onKeyShiftMappingChange={handleKeyShiftMappingChange}
                bpmShiftMappings={bpmShiftMappings}
                onBpmShiftMappingChange={handleBpmShiftMappingChange}
                showEmotionMappings={showEmotionMappings}
                onToggleEmotionMappings={setShowEmotionMappings}
            />
            
        </Container>
    );
};

export default Player;
