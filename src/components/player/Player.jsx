import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Container, Alert, Button } from 'react-bootstrap';
import { Text } from '../../styles/StyledComponents';
import { secondaryColor } from '../../utils/DisplaySettings';
import Deck from './Deck';
import DeckControls from './DeckControls';
import AudioDeviceSelector from './AudioDeviceSelector';
import ManualMapping from './ManualMapping';
import AdaptationOrchestrator, {
    createBuiltinStaticReactionPolicyInstance,
    EQ_PRESETS,
} from './AdaptationOrchestrator';
import AudioDeviceButton from '../../buttons/AudioDeviceButton';
import SettingsButton from '../../buttons/SettingsButton';
import { trackPageView } from '../../hooks/pageViewTracker';
import { trackSimpleEvent } from '../../hooks/simpleTracker';
import logoSmall from '../../images/logo_small.png';
import { useAudioGraphCompiler } from '../../hooks/useAudioGraphCompiler';
import { usePlaybackSessionAnalytics } from './usePlaybackSessionAnalytics';
import { useDeckTransport } from './useDeckTransport';

function resolveDeckArtworkUrl(source) {
    if (!source?.artwork_url || typeof source.artwork_url !== 'string') {
        return null;
    }
    const url = source.artwork_url;
    return url.includes('-large') ? url.replace('-large', '-t300x300') : url;
}

function resolvePlayerSessionName(pageName) {
    if (pageName === 'test-player') return 'TestPlayer_20260504_BPM_energy';
    if (pageName === 'local-player') return 'LocalPlayer';
    if (pageName === 'soundcloud-player') return 'SoundCloudPlayer';
    return pageName || 'Player';
}

const Player = ({
    // Audio source
    selectedFile,
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

    /** Shown on deck A when the track has no `artwork_url` (e.g. local hero image) */
    fallbackDeckArtworkSrc,
    /** Deck A transport status (e.g. SoundCloud stream loading) */
    deckATrackStatusMessage,
    deckATrackStatusLoading = false,

    /** When true, pressing Play bumps a counter so Face landmark / detection can start if idle */
    autoStartLandmarkWithMusic = true,
    /** Show/hide the "Second track" deck toggle controls. */
    enableSecondDeck = true,
    /** Show/hide previous/next transport controls on deck A. */
    enableTrackNavigation = true,
    /** Show/hide stop transport controls. */
    enableStopButton = true,
    /** Optional initial reaction policy instance for page-specific defaults. */
    initialReactionPolicyInstance = null,
    /** Optional context tutorial button for deck A. */
    showTutorialButton = false,
    onTutorialButtonClick = null,
}) => {
    // Audio state
    const [error, setError] = useState('');
    
    const [secondDeckActive, setSecondDeckActive] = useState(false);
    
    // Audio processing state
    const [volume, setVolume] = useState(0.5);
    const [baseVolume, setBaseVolume] = useState(0.5);
    const [volumeDeckB, setVolumeDeckB] = useState(0.5);
    const [baseVolumeDeckB, setBaseVolumeDeckB] = useState(0.5);
    const [stream, setStream] = useState(null);

    const initialReactionPolicyInstanceRef = useRef(
        initialReactionPolicyInstance || createBuiltinStaticReactionPolicyInstance(),
    );
    const [reactionPolicyInstance, setReactionPolicyInstance] = useState(
        () => initialReactionPolicyInstanceRef.current,
    );
    useEffect(() => {
        if (!initialReactionPolicyInstance || typeof initialReactionPolicyInstance !== 'object') return;
        initialReactionPolicyInstanceRef.current = initialReactionPolicyInstance;
        setReactionPolicyInstance(initialReactionPolicyInstance);
    }, [initialReactionPolicyInstance]);

    const {
        eqMappings,
        volumeMappings,
        rhythmicEnhancementMappings,
        reverbMappings,
        delayMappings,
        keyShiftMappings,
        bpmShiftMappings,
    } = reactionPolicyInstance;

    const [currentRecommendation, setCurrentRecommendation] = useState(null);
    
    // UI state
    const [showEmotionMappings, setShowEmotionMappings] = useState(false);
    const [showAudioModal, setShowAudioModal] = useState(false);
    const [loadedDeckATrack, setLoadedDeckATrack] = useState(null);
    const [loadedDeckBTrack, setLoadedDeckBTrack] = useState(null);
    
    const [landmarkAutoStartTick, setLandmarkAutoStartTick] = useState(0);
    const [detectionForceStopTick, setDetectionForceStopTick] = useState(0);
    const [deckASoundConsoleOpen, setDeckASoundConsoleOpen] = useState(false);
    const [deckBSoundConsoleOpen, setDeckBSoundConsoleOpen] = useState(false);
    const isTrackSwitchingRef = useRef(false);
    const previousThumbDeltaRef = useRef(0);
    const previousBpmShiftPercentRef = useRef(0);

    const internalAudioRef = useRef(null);
    const audioRef = externalAudioRef || internalAudioRef;
    const internalDeckBAudioRef = useRef(null);
    const deckBAudioRef = externalDeckBAudioRef || internalDeckBAudioRef;

    const reactionPolicyBundleRef = useRef({});
    reactionPolicyBundleRef.current = reactionPolicyInstance;

    const applyRecommendationToConsole = useAudioGraphCompiler(audioRef);
    const playerSessionName = resolvePlayerSessionName(pageName);
    // Track page view on component mount (guard against StrictMode double-invocation)
    const hasTrackedPageView = useRef(false);
    useEffect(() => {
        if (!hasTrackedPageView.current) {
            hasTrackedPageView.current = true;
            trackPageView({
                pageName: pageName,
                additionalData: {
                    session_name: playerSessionName,
                    has_camera: !!stream,
                    has_selected_file: !!selectedFile,
                }
            });
        }
    }, []);

    // Debug mapping changes - only log when they actually change
    useEffect(() => {
    }, [reactionPolicyInstance]);

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
        
        setReactionPolicyInstance((prev) => ({
            ...prev,
            eqMappings: {
                ...prev.eqMappings,
                [emotionState]: eqVector,
            },
        }));
    };
    
    // Handle volume mapping change
    const handleVolumeMappingChange = (emotionState, volumeMultiplier) => {
        setReactionPolicyInstance((prev) => ({
            ...prev,
            volumeMappings: {
                ...prev.volumeMappings,
                [emotionState]: parseFloat(volumeMultiplier),
            },
        }));
    };
    
    
    // Handle rhythmic enhancement mapping change
    const handleRhythmicEnhancementMappingChange = (emotionState, rhythmicEnhancement) => {
        setReactionPolicyInstance((prev) => ({
            ...prev,
            rhythmicEnhancementMappings: {
                ...prev.rhythmicEnhancementMappings,
                [emotionState]: parseFloat(rhythmicEnhancement),
            },
        }));
    };

    // Handle reverb mapping change
    const handleReverbMappingChange = (emotionState, reverbAmount) => {
        setReactionPolicyInstance((prev) => ({
            ...prev,
            reverbMappings: {
                ...prev.reverbMappings,
                [emotionState]: parseFloat(reverbAmount),
            },
        }));
    };

    // Handle delay mapping change
    const handleDelayMappingChange = (emotionState, delayAmount) => {
        setReactionPolicyInstance((prev) => ({
            ...prev,
            delayMappings: {
                ...prev.delayMappings,
                [emotionState]: parseFloat(delayAmount),
            },
        }));
    };

    const handleKeyShiftMappingChange = (emotionState, semitones) => {
        setReactionPolicyInstance((prev) => ({
            ...prev,
            keyShiftMappings: {
                ...prev.keyShiftMappings,
                [emotionState]: parseInt(semitones, 10),
            },
        }));
    };

    const handleBpmShiftMappingChange = (emotionState, percent) => {
        setReactionPolicyInstance((prev) => ({
            ...prev,
            bpmShiftMappings: {
                ...prev.bpmShiftMappings,
                [emotionState]: parseInt(percent, 10),
            },
        }));
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

    const resolveActiveTrackName = useCallback(() => {
        return (
            loadedDeckATrack?.displayName ||
            selectedFile?.name ||
            selectedFile?.title ||
            selectedFile?.fileName ||
            'unknown_track'
        );
    }, [loadedDeckATrack, selectedFile]);

    const resolveActiveSongId = useCallback(() => {
        const candidates = [
            loadedDeckATrack?.songId,
            loadedDeckATrack?.id,
            selectedFile?.songId,
            selectedFile?.track_id,
            selectedFile?.trackId,
            selectedFile?.id,
        ];
        for (const candidate of candidates) {
            if (candidate === null || candidate === undefined) continue;
            if (typeof candidate === 'number' && Number.isFinite(candidate)) {
                return candidate;
            }
            const asText = String(candidate);
            const numericFromSuffix = asText.match(/(\d+)$/);
            if (numericFromSuffix) {
                return Number(numericFromSuffix[1]);
            }
            const parsed = Number(asText);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
        return null;
    }, [loadedDeckATrack, selectedFile]);

    const resolveActiveTrackBaseBpm = useCallback(() => {
        const candidates = [
            loadedDeckATrack?.bpm,
            selectedFile?.bpm,
            selectedFile?.BPM,
            selectedFile?.track_bpm,
        ];
        for (const candidate of candidates) {
            const n = Number(candidate);
            if (Number.isFinite(n) && n > 0) {
                return n;
            }
        }
        const fallbackBpm = Number(window.localStorage.getItem('calibration_original_bpm'));
        return Number.isFinite(fallbackBpm) && fallbackBpm > 0 ? fallbackBpm : null;
    }, [loadedDeckATrack, selectedFile]);

    const handleReactionCompileOutput = useCallback(
        (output) => {
            const recommendation = output?.recommendation || null;
            const nextThumbDelta = Number(recommendation?.persistentThumbBpmDeltaBpm) || 0;
            const prevThumbDelta = Number(previousThumbDeltaRef.current) || 0;
            const thumbDeltaChange = nextThumbDelta - prevThumbDelta;
            const commandType =
                thumbDeltaChange > 0 ? 'thumbs_up' : thumbDeltaChange < 0 ? 'thumbs_down' : null;

            if (commandType) {
                const baseBpm = resolveActiveTrackBaseBpm();
                const songId = resolveActiveSongId();
                const previousBpmShiftPercent = Number(previousBpmShiftPercentRef.current) || 0;
                const nextBpmShiftPercent = Number(recommendation?.bpmShiftPercent) || 0;
                const oldBpm =
                    Number.isFinite(baseBpm) && baseBpm > 0
                        ? baseBpm * (1 + previousBpmShiftPercent / 100)
                        : null;
                const newBpm =
                    Number.isFinite(baseBpm) && baseBpm > 0
                        ? baseBpm * (1 + nextBpmShiftPercent / 100)
                        : null;

                void trackSimpleEvent({
                    interaction_type: commandType,
                    element_id: 'thumb_command',
                    session_name: playerSessionName,
                    page_url: window.location.href,
                    timestamp: Date.now(),
                    command_type: commandType,
                    context: {
                        song_id: songId,
                        old_bpm: Number.isFinite(oldBpm) ? Number(oldBpm.toFixed(3)) : null,
                        new_bpm: Number.isFinite(newBpm) ? Number(newBpm.toFixed(3)) : null,
                    },
                });
            }

            previousThumbDeltaRef.current = nextThumbDelta;
            previousBpmShiftPercentRef.current = Number(recommendation?.bpmShiftPercent) || 0;
            setCurrentRecommendation(recommendation);
            applyRecommendationToConsole(output);
        },
        [applyRecommendationToConsole, playerSessionName, resolveActiveSongId, resolveActiveTrackBaseBpm],
    );

    const noddingAmplitudeForDeckUi = Number(currentRecommendation?.noddingAmplitude) || 0;

    const { startPlaybackSession, endPlaybackSession } = usePlaybackSessionAnalytics({
        pageName,
        sessionName: playerSessionName,
        resolveTrackName: resolveActiveTrackName,
    });
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


    const deckATransport = useDeckTransport({
        audioRef,
        hasValidAudioSource,
        setError,
        missingElementMessage: 'Audio element not found',
        missingSourceMessage: 'Please select an audio track first',
        unsupportedProcessingMessage: 'Audio processing not supported in this browser',
        playbackFailedPrefix: 'Failed to play audio: ',
        mediaLoadErrorMessage: 'Error loading audio file. Please try another file.',
        onPlay: () => {
            startPlaybackSession();
            onMusicPlay?.();
        },
        onPause: () => {
            onMusicPause?.();
        },
        onStop: () => {
            void endPlaybackSession('stop_button');
            if (stream) {
                setDetectionForceStopTick((t) => t + 1);
            }
        },
        onTrackEndedNoAutoNext: () => {
            void endPlaybackSession('track_ended');
        },
        autoStartLandmarkWithMusic,
        setLandmarkAutoStartTick,
        selectedFile,
        playlist,
        currentTrackIndex,
        onTrackSelect,
        isTrackSwitchingRef,
    });
    const deckBTransport = useDeckTransport({
        audioRef: deckBAudioRef,
        hasValidAudioSource: hasValidAudioSourceDeckB,
        setError,
        missingElementMessage: 'Second track audio element not found',
        missingSourceMessage: 'Please load a track into the second player first',
        unsupportedProcessingMessage: 'Second track: audio processing not supported in this browser',
        playbackFailedPrefix: 'Second track playback failed: ',
        mediaLoadErrorMessage: 'Error loading second track audio',
        autoStartLandmarkWithMusic,
        setLandmarkAutoStartTick,
        selectedFile: loadedDeckBTrack,
    });

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
                const deckB = deckBAudioRef.current;
                deckB.pause();
                if (track.file) {
                    const audioUrl = URL.createObjectURL(track.file);
                    deckB.crossOrigin = null;
                    deckB.src = audioUrl;
                    deckB.load();
                } else if (track.url) {
                    deckB.crossOrigin = 'anonymous';
                    deckB.src = track.url;
                    deckB.load();
                } else {
                    setError('Second track could not be loaded');
                }
            }
        }
    }, [onTrackSelect, playlist, currentTrackIndex, onLoadDeckBTrack, deckBAudioRef]);

    const deck1ArtworkUrl =
        resolveDeckArtworkUrl(loadedDeckATrack) ||
        resolveDeckArtworkUrl(selectedFile) ||
        fallbackDeckArtworkSrc ||
        logoSmall;
    const deck2ArtworkUrl = resolveDeckArtworkUrl(loadedDeckBTrack) || logoSmall;
    const deck1ArtworkSizePx = secondDeckActive ? 96 : 120;
    const deck2ArtworkSizePx = 96;

    return (
        <Container fluid className="mt-4 px-3">
            <div className="bg-dark rounded p-4" style={{ backgroundColor: '#1a1a1a' }}>
                {/* Playback controls, detection, and sound console — above library / track UI */}
                <div className="d-flex flex-column mb-4" style={{ width: '100%', overflow: 'visible' }}>
                    {enableSecondDeck && (
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
                                        deckBTransport.handleStop();
                                    }}
                                    style={{ fontSize: '0.8rem' }}
                                >
                                    Remove second track
                                </Button>
                            )}
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
                                noddingAmplitude={noddingAmplitudeForDeckUi}
                                consoleZIndex={1045}
                                onOpenMappings={() => setShowEmotionMappings(true)}
                                soundConsoleOpen={deckASoundConsoleOpen}
                                onSoundConsoleOpenChange={setDeckASoundConsoleOpen}
                            >
                                <DeckControls
                                    deckId="A"
                                    currentSongId={resolveActiveSongId()}
                                    onLoadTrack={handleLoadTrackToDeck}
                                    loadedTrackName={loadedDeckATrack?.displayName || selectedFile?.name || ''}
                                    isPlaying={deckATransport.isPlaying}
                                    currentTime={deckATransport.currentTime}
                                    duration={deckATransport.duration}
                                    hasValidAudioSource={hasValidAudioSource}
                                    onPlayPause={deckATransport.handlePlayPause}
                                    onStop={deckATransport.handleStop}
                                    onPrevious={deckATransport.handlePrevious}
                                    onNext={deckATransport.handleNext}
                                    onProgressSeek={deckATransport.handleProgressSeek}
                                    hasPrevious={playlist.length > 0 && currentTrackIndex > 0}
                                    hasNext={playlist.length > 0 && currentTrackIndex < playlist.length - 1}
                                    iconSize={secondDeckActive ? '1.68rem' : '2.1rem'}
                                    showPreviousNext={enableTrackNavigation}
                                    showStopButton={enableStopButton}
                                    showAudioDevice={!secondDeckActive}
                                    showSoundConsole={!secondDeckActive}
                                    showTutorial={showTutorialButton && !secondDeckActive}
                                    onAudioDeviceClick={
                                        secondDeckActive ? undefined : () => setShowAudioModal(true)
                                    }
                                    onSoundConsoleClick={
                                        secondDeckActive ? undefined : () => setDeckASoundConsoleOpen(true)
                                    }
                                    tutorialDismissed={true}
                                    setTutorialDismissed={() => {}}
                                    onTutorialClick={onTutorialButtonClick}
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
                                    noddingAmplitude={noddingAmplitudeForDeckUi}
                                    consoleZIndex={1055}
                                    onOpenMappings={() => setShowEmotionMappings(true)}
                                    soundConsoleOpen={deckBSoundConsoleOpen}
                                    onSoundConsoleOpenChange={setDeckBSoundConsoleOpen}
                                >
                                    <DeckControls
                                        deckId="B"
                                        currentSongId={null}
                                        onLoadTrack={handleLoadTrackToDeck}
                                        loadedTrackName={loadedDeckBTrack?.displayName || ''}
                                    isPlaying={deckBTransport.isPlaying}
                                    currentTime={deckBTransport.currentTime}
                                    duration={deckBTransport.duration}
                                        hasValidAudioSource={hasValidAudioSourceDeckB}
                                    onPlayPause={deckBTransport.handlePlayPause}
                                    onStop={deckBTransport.handleStop}
                                    onProgressSeek={deckBTransport.handleProgressSeek}
                                        hasPrevious={false}
                                        hasNext={false}
                                        iconSize="1.68rem"
                                        showPreviousNext={false}
                                        showStopButton={enableStopButton}
                                        artworkUrl={deck2ArtworkUrl}
                                        artworkSizePx={deck2ArtworkSizePx}
                                    />
                                </Deck>
                            </div>
                        )}
                    </div>

                    {secondDeckActive && (
                        <div
                            className="deck-controls-actions--solo d-flex justify-content-center align-items-center gap-3 mt-3 mb-1 flex-wrap"
                            style={{ overflow: 'visible', rowGap: '0.35rem' }}
                        >
                            <AudioDeviceButton
                                onClick={() => setShowAudioModal(true)}
                                size="1.82rem"
                                showTooltip={true}
                                tooltipText="Audio Device Settings"
                            />
                            <SettingsButton
                                showSettings={false}
                                onToggleSettings={() => setDeckASoundConsoleOpen(true)}
                                size="1.82rem"
                                showTooltip={true}
                                tooltipText="Sound console"
                            />
                        </div>
                    )}

                    {/* Detection UI — face, pose, and hands in one pipeline */}
                    {stream && (
                        <div style={{ width: '100%', position: 'relative', zIndex: 1, clear: 'both', marginTop: '0.5rem', marginBottom: '1rem' }}>
                            <AdaptationOrchestrator
                                policyBundleRef={reactionPolicyBundleRef}
                                stream={stream}
                                sensingSessionName={`${pageName}_session`}
                                sensingSizeMode="large"
                                autoStartLandmarkTick={autoStartLandmarkWithMusic ? landmarkAutoStartTick : 0}
                                forceStopDetectionTick={detectionForceStopTick}
                                enabled={!!stream}
                                nodTrackBpmAudioRef={audioRef}
                                onReactionOutput={handleReactionCompileOutput}
                            />
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
                            deckATransport.setDuration(audioRef.current.duration);
                        }
                    }}
                    onTimeUpdate={() => {
                        if (audioRef.current) {
                            deckATransport.setCurrentTime(audioRef.current.currentTime);
                        }
                    }}
                    onEnded={() => {
                        deckATransport.setIsPlaying(false);
                        deckATransport.setCurrentTime(0);
                    }}
                    onPlay={() => {
                        isTrackSwitchingRef.current = false;
                        startPlaybackSession();
                        deckATransport.setIsPlaying(true);
                        if (onMusicPlay) onMusicPlay();
                    }}
                    onPause={() => {
                        if (!isTrackSwitchingRef.current) {
                            void endPlaybackSession('pause');
                        }
                        deckATransport.setIsPlaying(false);
                        if (onMusicPause) onMusicPause();
                    }}
                    onError={(e) => {
                        // Audio error
                        setError('Error loading audio file');
                        deckATransport.setIsPlaying(false);
                    }}
                />

                {/* Hidden Deck B Audio Element */}
                <audio
                    ref={deckBAudioRef}
                    preload="metadata"
                    crossOrigin="anonymous"
                    onLoadedMetadata={() => {
                        if (deckBAudioRef.current) {
                            deckBTransport.setDuration(deckBAudioRef.current.duration || 0);
                        }
                    }}
                    onDurationChange={() => {
                        if (deckBAudioRef.current) {
                            const d = deckBAudioRef.current.duration;
                            if (Number.isFinite(d) && d > 0) {
                                deckBTransport.setDuration(d);
                            }
                        }
                    }}
                    onTimeUpdate={() => {
                        if (deckBAudioRef.current) {
                            deckBTransport.setCurrentTime(deckBAudioRef.current.currentTime || 0);
                        }
                    }}
                    onEnded={() => {
                        deckBTransport.setIsPlaying(false);
                        deckBTransport.setCurrentTime(0);
                    }}
                    onPlay={() => {
                        deckBTransport.setIsPlaying(true);
                    }}
                    onPause={() => {
                        deckBTransport.setIsPlaying(false);
                    }}
                    onError={() => {
                        setError('Error loading second track audio file');
                        deckBTransport.setIsPlaying(false);
                    }}
                />
            </div>

            {/* Facial Landmark Detection Section */}
            <>
                {stream ? null : (
                    <div className="text-center py-4">
                        <Text>Please allow camera access to enable face, body, and hand sensing.</Text>
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
