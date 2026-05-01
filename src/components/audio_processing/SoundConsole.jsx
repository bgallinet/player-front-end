/**
 * SoundConsole Component - Comprehensive Audio Processing Interface
 * 
 * This component encapsulates all audio processing functionality for the music player,
 * providing a complete sound engineering console with the following features:
 * 
 * AUDIO PROCESSING:
 * - Web Audio API integration with AudioContext, MediaElementSource
 * - 6-band Equalizer (60Hz, 170Hz, 350Hz, 1kHz, 3.5kHz, 10kHz) with real-time gain control
 * - Rhythmic Enhancement for punch and clarity (0-100% adjustable)
 * - Enhanced Chorus Effect with triple-voice LFO modulation and delay feedback (0-100% adjustable)
 * - Master Volume Control with makeup gain compensation
 * - Audio graph management with automatic reconnection
 * 
 * EMOTION-BASED AUDIO CONTROL:
 * - Real-time emotion detection integration (nodding, smiling, surprised, neutral)
 * - Emotion-to-audio mapping system for EQ presets and volume multipliers
 * - Amplitude-based scaling for nodding states (0-3 range)
 * - Relative audio adjustments that scale from user-defined base values
 * 
 * USER INTERFACE:
 * - Volume slider with visual feedback and emotion-based updates
 * - Vertical EQ sliders with real-time dB display and preset buttons
 * - Rhythmic enhancement slider with percentage display and visual feedback
 * - Chorus effect slider with percentage display and visual feedback
 * - Emotion mapping settings overlay with comprehensive configuration options
 * - Real-time visual indicators showing active emotion states and applied effects
 * 
 * TECHNICAL FEATURES:
 * - Automatic audio context initialization and management
 * - Error handling for Web Audio API operations
 * - State synchronization between Web Audio API nodes and React state
 * - Display state management for slider visual feedback
 * - Method exposure to parent component for external control
 * 
 * PROPS INTERFACE:
 * - Audio ref management and playback control
 * - Volume state management
 * - Emotion mapping configuration and callbacks
 * - Nodding amplitude data for emotion-based scaling
 * - UI state management for settings overlay
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { guess } from 'web-audio-beat-detector';
import { Button, Form } from 'react-bootstrap';
import { Subtitle, Text } from '../../styles/StyledComponents';
import { secondaryColor, thresholdForVisualizationOfNodding } from '../../utils/DisplaySettings';
import maxSoundIcon from '../../images/maxsoundicon.png';
import minSoundIcon from '../../images/minsoundicon.png';
import EQ from './EQ';
import AudioEffect from './AudioEffect';
import {
    createKeyShiftProcessor,
    processKeyShift,
    clampKeyShiftSemitones,
    KEY_SHIFT_SEMITONE_MIN,
    KEY_SHIFT_SEMITONE_MAX,
    // Aliased so the local `applyBpmShift` callback (soundConsoleMethods) does not shadow this import.
    applyBpmShift as applyPlaybackTempoToMedia,
    clampBpmShiftPercent,
    BPM_SHIFT_PERCENT_MIN,
    BPM_SHIFT_PERCENT_MAX,
} from './audioEffects';

/** Upper bound on decoded audio used for tempo estimation (seconds). */
const TRACK_BPM_ANALYZE_MAX_SECONDS = 45;

const SoundConsole = ({
    audioRef,
    volume,
    baseVolume,
    onVolumeChange,
    eqMappings,
    volumeMappings,
    rhythmicEnhancementMappings,
    reverbMappings,
    noddingAmplitude
}) => {
    // Web Audio API refs
    const audioContextRef = useRef(null);
    const sourceNodeRef = useRef(null);
    const gainNodeRef = useRef(null);
    const pitchShiftNodeRef = useRef(null);
    const keyShiftSemitonesRef = useRef(0);
    const bpmShiftPercentRef = useRef(0);

    // EQ state
    const [eqGains, setEqGains] = useState([0, 0, 0, 0, 0, 0]);
    const [displayVolume, setDisplayVolume] = useState(0.5); // Volume slider display value
    const [rhythmicEnhancement, setRhythmicEnhancement] = useState(0);
    const [displayRhythmicEnhancement, setDisplayRhythmicEnhancement] = useState(0);
    
    const [reverbAmount, setReverbAmount] = useState(0);
    const [delayAmount, setDelayAmount] = useState(0);
    const [keyShiftSemitones, setKeyShiftSemitones] = useState(0);
    const [bpmShiftPercent, setBpmShiftPercent] = useState(0);
    const [currentRecommendation, setCurrentRecommendation] = useState(null);
    const [trackBpm, setTrackBpm] = useState(null);
    const [trackBpmPending, setTrackBpmPending] = useState(false);
    



    // Track last reconnection time to prevent excessive reconnections
    const lastReconnectionTime = useRef(0);
    const RECONNECTION_THROTTLE_MS = 1000; // Minimum 1 second between reconnections
    const lastThrottleLogTime = useRef(0);
    const THROTTLE_LOG_INTERVAL_MS = 5000; // Only log throttling message every 5 seconds

    // Reconnect audio graph - include key shift, EQ, delay, reverb and rhythmic enhancer in chain
    const reconnectAudioGraph = useCallback(() => {
        const now = Date.now();
        if (now - lastReconnectionTime.current < RECONNECTION_THROTTLE_MS) {
            return;
        }
        
        if (!audioContextRef.current || !sourceNodeRef.current || !gainNodeRef.current) {
            return;
        }
        
        lastReconnectionTime.current = now;
        
        try {
            
            // Disconnect all existing connections
            sourceNodeRef.current.disconnect();
            gainNodeRef.current.disconnect();
            
            // Reconnect the chain: Source -> PitchShift -> EQ Filters -> Delay -> Reverb -> Rhythmic Enhancer -> Gain -> Destination
            let currentNode = sourceNodeRef.current;

            // Connect pitch shift node if available
            if (pitchShiftNodeRef.current) {
                currentNode.connect(pitchShiftNodeRef.current);
                currentNode = pitchShiftNodeRef.current;
            }
            
            // Connect EQ filters if they exist
            if (audioRef.current && audioRef.current.eqMethods && audioRef.current.eqMethods.filtersRef && audioRef.current.eqMethods.filtersRef.current) {
                const eqFilters = audioRef.current.eqMethods.filtersRef.current;
                if (eqFilters && eqFilters.length > 0) {
                    eqFilters.forEach((filter, index) => {
                        if (filter) {
                            currentNode.connect(filter);
                            currentNode = filter;
                        }
                    });
                } 
            }
            
            // Connect delay if it exists and is properly initialized
            if (audioRef.current && audioRef.current.delayMethods && audioRef.current.delayMethods.delayRef && audioRef.current.delayMethods.delayRef.current) {
                const delay = audioRef.current.delayMethods.delayRef.current;
                
                if (delay && delay.input && delay.output && delay.delayNode) {
                    try {
                        currentNode.connect(delay.input);
                        currentNode = delay.output;
                    } catch (delayError) {
                        // If delay connection fails, continue without it
                    }
                }
            }
            
            // Connect reverb if it exists and is properly initialized
            if (audioRef.current && audioRef.current.reverbMethods && audioRef.current.reverbMethods.reverbRef && audioRef.current.reverbMethods.reverbRef.current) {
                const reverb = audioRef.current.reverbMethods.reverbRef.current;
                
                if (reverb && reverb.input && reverb.output) {
                    try {
                        currentNode.connect(reverb.input);
                        currentNode = reverb.output;
                    } catch (reverbError) {
                        // Reverb connection failed, continuing without reverb
                    }
                }
            }
            
            // Connect rhythmic enhancer if it exists and is available
            if (audioRef.current && audioRef.current.rhythmicEnhancementMethods && audioRef.current.rhythmicEnhancementMethods.rhythmicEnhancerRef && audioRef.current.rhythmicEnhancementMethods.rhythmicEnhancerRef.current) {
                const rhythmicEnhancer = audioRef.current.rhythmicEnhancementMethods.rhythmicEnhancerRef.current;
                if (rhythmicEnhancer && rhythmicEnhancer.highPassFilter) {
                    try {
                        currentNode.connect(rhythmicEnhancer.highPassFilter);
                        currentNode = rhythmicEnhancer.gainNode;
                    } catch (rhythmError) {
                        // Rhythmic enhancement connection failed, continuing without it
                    }
                }
            }
            
            currentNode.connect(gainNodeRef.current);
            gainNodeRef.current.connect(audioContextRef.current.destination);
        } catch (error) {
            // Try to reconnect with a basic chain if the full chain fails
            try {
                sourceNodeRef.current.connect(gainNodeRef.current);
                gainNodeRef.current.connect(audioContextRef.current.destination);
            } catch (fallbackError) {
                // Fallback audio connection also failed
            }
        } finally {
            applyPlaybackTempoToMedia(audioRef.current, bpmShiftPercentRef.current);
        }
    }, []); // Remove dependencies to prevent unnecessary reconnections

    // Manual reconnection function for when effects actually change
    const reconnectAudioGraphManual = useCallback(() => {
        reconnectAudioGraph();
    }, [reconnectAudioGraph]);

    // Force creation of all audio effects when audio context becomes active
    const forceAllEffectsCreation = useCallback(() => {
        // Force creation of rhythmic enhancement
        if (audioRef.current?.rhythmicEnhancementMethods?.forceEffectCreation) {
            audioRef.current.rhythmicEnhancementMethods.forceEffectCreation();
        }
        
        // Force creation of reverb
        if (audioRef.current?.reverbMethods?.forceEffectCreation) {
            audioRef.current.reverbMethods.forceEffectCreation();
        }
        
        // Force creation of delay
        if (audioRef.current?.delayMethods?.forceEffectCreation) {
            audioRef.current.delayMethods.forceEffectCreation();
        }
        
        // Reconnect audio graph after effects are created
        setTimeout(() => {
            reconnectAudioGraphManual();
        }, 100);
    }, [reconnectAudioGraphManual]);

    // Ensure volume is properly set on component mount
    useEffect(() => {
        if (audioRef.current && typeof audioRef.current.volume !== 'undefined') {
            audioRef.current.volume = volume;
        }
    }, []); // Only run once on mount

    // Initialize Web Audio API
    const initializeAudioContext = useCallback(() => {
        if (!audioContextRef.current && audioRef.current) {
            try {
                // Check if Web Audio API is supported
                if (!window.AudioContext && !window.webkitAudioContext) {
                    return false;
                }
                
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
                
                // Resume suspended audio context (required on mobile and secure contexts)
                if (audioContextRef.current.state === 'suspended') {
                    return audioContextRef.current.resume().then(() => {
                        setupAudioNodes();
                        // Force creation of all audio effects now that context is running
                        forceAllEffectsCreation();
                        return true;
                    }).catch(error => {
                        return false;
                    });
                } else {
                    setupAudioNodes();
                    // Force creation of all audio effects now that context is running
                    forceAllEffectsCreation();
                    return true;
                }
                
            } catch (error) {
                return false;
            }
        }
        return true;
        
        function setupAudioNodes() {
            try {
                // Create source node from audio element
                sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
                
                // Create gain node for master volume
                gainNodeRef.current = audioContextRef.current.createGain();
                gainNodeRef.current.gain.value = volume; // Set initial volume

                pitchShiftNodeRef.current = createKeyShiftProcessor(audioContextRef.current);
                processKeyShift(pitchShiftNodeRef.current, keyShiftSemitonesRef.current);
                applyPlaybackTempoToMedia(audioRef.current, bpmShiftPercentRef.current);
                
                // Initial audio graph connection (delayed to ensure EQ component is ready)
                setTimeout(() => {
                    reconnectAudioGraphManual();
                }, 100);
                
                // Additional reconnection attempts to ensure effects are properly connected
                setTimeout(() => {
                    reconnectAudioGraphManual();
                }, 500);
                
                setTimeout(() => {
                    reconnectAudioGraphManual();
                }, 1000);
                
                return true;
            } catch (error) {
                return false;
            }
        }
    }, [volume, reconnectAudioGraph, forceAllEffectsCreation]);

    // Calculate makeup gain to maintain constant loudness
    const calculateMakeupGain = useCallback((gains) => {
        // Calculate the RMS (Root Mean Square) of the gains to estimate loudness change
        // This is a simplified approach - more complex methods exist for psychoacoustic loudness
        const sumSquares = gains.reduce((sum, gain) => sum + (gain * gain), 0);
        const rms = Math.sqrt(sumSquares / gains.length);
        
        // Apply a compensation factor (negative of RMS to counteract the change)
        // Scale it down to avoid over-compensation
        const makeupGain = -rms * 0.3; // 0.3 is a scaling factor for subtle compensation
        
        return Math.max(-6, Math.min(6, makeupGain)); // Clamp between -6 and +6 dB
    }, []);


    // Apply makeup gain to maintain loudness
    const applyMakeupGain = useCallback((gains) => {
        const makeupGain = calculateMakeupGain(gains);
        
        if (gainNodeRef.current) {
            // Combine the user volume with makeup gain
            const totalGain = volume * Math.pow(10, makeupGain / 20); // Convert dB to linear
            gainNodeRef.current.gain.value = totalGain;
        }
        
        return makeupGain;
    }, [volume, calculateMakeupGain]);

    // Handle EQ gains change from EQ component
    const handleEqGainsChange = useCallback((newGains) => {
        setEqGains(newGains);
            
            // Apply makeup gain to maintain constant loudness
            applyMakeupGain(newGains);
    }, [applyMakeupGain]);
            
    // Handle makeup gain change from EQ component
    const handleMakeupGainChange = useCallback((gains) => {
        applyMakeupGain(gains);
    }, [applyMakeupGain]);

    // Compression removed

    // Chorus removed

    // Handle reverb amount change from Reverb component
    const handleReverbAmountChange = useCallback((newAmount) => {
        setReverbAmount(newAmount);
    }, []);

    // Handle delay amount change from Delay component
    const handleDelayAmountChange = useCallback((newAmount) => {
        setDelayAmount(newAmount);
    }, []);

    const handleKeyShiftChange = useCallback((newSemitoneValue) => {
        const clampedSemitones = clampKeyShiftSemitones(newSemitoneValue);
        if (clampedSemitones === null) return;
        keyShiftSemitonesRef.current = clampedSemitones;
        setKeyShiftSemitones(clampedSemitones);
        processKeyShift(pitchShiftNodeRef.current, clampedSemitones);
    }, []);

    const handleBpmShiftChange = useCallback((newBpmShiftPercent) => {
        const clampedBpmPercent = clampBpmShiftPercent(newBpmShiftPercent);
        if (clampedBpmPercent === null) return;
        bpmShiftPercentRef.current = clampedBpmPercent;
        setBpmShiftPercent(clampedBpmPercent);
        applyPlaybackTempoToMedia(audioRef.current, clampedBpmPercent);
    }, [audioRef]);

    // HLS / buffer swaps and some browsers reset playbackRate; keep element in sync.
    useEffect(() => {
        const el = audioRef.current;
        if (!el) return undefined;
        const sync = () => applyPlaybackTempoToMedia(el, bpmShiftPercentRef.current);
        el.addEventListener('loadeddata', sync);
        el.addEventListener('canplay', sync);
        el.addEventListener('play', sync);
        sync();
        return () => {
            el.removeEventListener('loadeddata', sync);
            el.removeEventListener('canplay', sync);
            el.removeEventListener('play', sync);
        };
    }, [audioRef]);

    // Apply external EQ values (no emotion interpretation - just apply the provided EQ vector)
    const applyExternalEQ = useCallback((eqVector) => {
        try {
            // Ensure audio context is initialized
            if (!audioContextRef.current && audioRef.current) {
                const success = initializeAudioContext();
                if (!success) {
                    // Silent warning
                    return;
                }
            }
            
            
            // Validate input
            if (!Array.isArray(eqVector) || eqVector.length !== 6) {
                return;
            }
            
            
            // Apply external EQ via EQ component
            if (audioRef.current && audioRef.current.eqMethods) {
                audioRef.current.eqMethods.applyExternalEQ(eqVector);
            } else {
                // Silent warning
            }
            
        } catch (error) {
            // Silent error handling
        }
    }, []);
    
    // Apply emotion-based volume with nodding amplitude scaling
    const applyEmotionVolume = useCallback((emotionState, amplitude = 0, volumeTracksNoddingAmplitude = false) => {
        try {
            
            // Ensure audio context is initialized
            if (!audioContextRef.current && audioRef.current) {
                const success = initializeAudioContext();
                if (!success) {
                    // Silent warning
                    return;
                }
            }
            
            // Validate inputs
            if (!emotionState || typeof emotionState !== 'string' || emotionState.length === 0) {
                return;
            }
            
            // Check for invalid characters that might cause issues
            if (emotionState.includes('\0') || emotionState.includes('\uFFFD')) {
                return;
            }
            
            // Check if volumeMappings exists and is an object (not an array)
            if (!volumeMappings || typeof volumeMappings !== 'object' || Array.isArray(volumeMappings)) {
                return;
            }
            
            // Safely access volumeMappings with additional validation
            let volumeMultiplier;
            try {
                volumeMultiplier = volumeMappings[emotionState];
            } catch (accessError) {
                // Silent error handling
                return;
            }
            
            if (!volumeMultiplier || typeof volumeMultiplier !== 'number') {
                return;
            }
            
            // Validate volume
            if (typeof volume !== 'number' || isNaN(volume) || !isFinite(volume)) {
                return;
            }
            
            // Validate amplitude
            const validAmplitude = typeof amplitude === 'number' && !isNaN(amplitude) && isFinite(amplitude) ? amplitude : 0;
            
            let finalVolume = baseVolume * volumeMultiplier;
            
            // For nodding-linked profiles, scale volume by amplitude (0-thresholdForVisualizationOfNodding range)
            if (volumeTracksNoddingAmplitude && validAmplitude > 0) {
                const cappedAmplitude = Math.min(validAmplitude, thresholdForVisualizationOfNodding * 2); // Cap at 2x threshold
                const scaleFactor = cappedAmplitude / (thresholdForVisualizationOfNodding * 2); // Scale 0-1
                
                // Interpolate between base volume and emotion volume based on amplitude
                const baseVol = volume;
                const emotionVolume = volume * volumeMultiplier;
                finalVolume = baseVol + (emotionVolume - baseVol) * scaleFactor;
            }
            
            // Clamp volume between 0 and 1.45 (145% max)
            finalVolume = Math.max(0, Math.min(1.45, finalVolume));
            
            // Round to avoid floating point precision issues
            finalVolume = Math.round(finalVolume * 1000) / 1000;
            
            
            // Apply directly to Web Audio API gain node (same approach as EQ - NO STATE CHANGES)
            if (gainNodeRef.current) {
                const previousValue = gainNodeRef.current.gain.value;
                gainNodeRef.current.gain.value = finalVolume;
            }
            
            // Update display volume to show the actual volume for visual feedback
            // The slider should visually move to show the emotion-based volume change
            setDisplayVolume(finalVolume);
            
            // Calculate the relative change percentage for text display
            const relativeChangePercent = ((finalVolume - baseVolume) / baseVolume) * 100;
            
        } catch (error) {
            // Silent error handling
        }
    }, [volumeMappings, volume, baseVolume, onVolumeChange]);
    


    // Reset audio elements to base values (for when emotions change) - VOLUME ONLY
    const resetToBaseValues = useCallback(() => {
        const callId = Math.random().toString(36).substr(2, 9);
        // Reset to base values
        
        try {
            // Reset volume to base value (direct Web Audio API approach - NO STATE CHANGES)
            if (gainNodeRef.current) {
                gainNodeRef.current.gain.value = baseVolume;
            }
            
            // Reset display volume to base volume for visual feedback
            setDisplayVolume(baseVolume);
            
            // Compression removed
            
            // DON'T reset rhythmic enhancement display - let individual components handle their own state
            // Reset display rhythmic enhancement
            // setDisplayRhythmicEnhancement(0);
            // setRhythmicEnhancement(0);
            
            // Reset reverb to 0 via Reverb component
            if (audioRef.current && audioRef.current.reverbMethods) {
                audioRef.current.reverbMethods.resetReverb();
            }
            
            // Reset delay to 0 via Delay component
            if (audioRef.current && audioRef.current.delayMethods && audioRef.current.delayMethods.resetDelay) {
                audioRef.current.delayMethods.resetDelay();
            }
            
            // Reset display amounts for visual feedback
            setReverbAmount(0);
            setDelayAmount(0);
            
            // Reconnect audio graph
            reconnectAudioGraph();
            
        } catch (error) {
            // Silent error handling
        }
    }, [baseVolume, reconnectAudioGraph, audioRef]);

    // Reset EQ to flat response
    const resetEQ = useCallback(() => {
        // Reset EQ via EQ component
        if (audioRef.current && audioRef.current.eqMethods) {
            audioRef.current.eqMethods.resetEQ();
        }
    }, [audioRef]);

    // Handle volume change
    const handleVolumeChange = useCallback((newVolume) => {
        const volumeValue = parseFloat(newVolume);
        onVolumeChange(volumeValue);
        
        // Update display volume state
        setDisplayVolume(volumeValue);
        
        // Update Web Audio API gain node
        if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = volumeValue;
        }
        
        // Reapply makeup gain with new volume
        applyMakeupGain(eqGains);
        
        // Also update HTML audio element volume as fallback
        if (audioRef.current) {
            audioRef.current.volume = volumeValue;
        }
    }, [onVolumeChange, applyMakeupGain, eqGains]);



    // Handle rhythmic enhancement change
    const handleRhythmicEnhancementChange = useCallback((newEnhancement) => {
        const callId = Math.random().toString(36).substr(2, 9);
        const enhancementValue = parseFloat(newEnhancement);
        // Handle rhythmic enhancement change
        
        setRhythmicEnhancement(enhancementValue);
        setDisplayRhythmicEnhancement(enhancementValue);
        
        // Both states updated
        
        // Reconnect audio graph to ensure rhythmic enhancer is properly connected
        reconnectAudioGraph();
    }, [reconnectAudioGraph]);

    // Handle rhythmic enhancement display change
    const handleDisplayRhythmicEnhancementChange = useCallback((newDisplayValue) => {
        const callId = Math.random().toString(36).substr(2, 9);
        // Handle display rhythmic enhancement change
        
        // Use functional update to ensure we get the latest state
        setDisplayRhythmicEnhancement(prevValue => {
            if (prevValue !== newDisplayValue) {
                return newDisplayValue;
            } else {
                return prevValue;
            }
        });
        
        // Reconnect audio graph to ensure rhythmic enhancer is properly connected
        reconnectAudioGraph();
    }, [reconnectAudioGraph]);

    // DEBUG: Monitor displayRhythmicEnhancement state changes
    useEffect(() => {
        // Display rhythmic enhancement state changed
    }, [displayRhythmicEnhancement]);

    // DEBUG: Monitor currentRecommendation state changes
    useEffect(() => {
        // Current recommendation state changed
    }, [currentRecommendation]);

    // Handle rhythmic enhancement transient change callback
    const handleTransientEnhancementChange = useCallback((transientMethods) => {
        // Store the transient enhancement methods for external access
        if (audioRef.current) {
            audioRef.current.rhythmicEnhancementMethods = transientMethods;
        }
    }, [audioRef]);

    // Initialize audio context when audio ref is available
    useEffect(() => {
        if (audioRef.current && !audioContextRef.current) {
            initializeAudioContext();
        }
    }, [audioRef.current, initializeAudioContext]);

    const trackBpmGenRef = useRef(0);
    const lastSuccessfulBpmUrlRef = useRef('');
    const bpmPendingForUrlRef = useRef(null);

    // Estimate track BPM when a new media URL loads (decode + web-audio-beat-detector).
    useEffect(() => {
        let cancelled = false;
        let rafId = 0;
        let el = null;

        const syncDetectedTrackBpm = (value) => {
            const node = audioRef.current;
            if (node) node.detectedTrackBpm = value;
        };

        const runForUrl = (url) => {
            if (!url) {
                lastSuccessfulBpmUrlRef.current = '';
                bpmPendingForUrlRef.current = null;
                syncDetectedTrackBpm(null);
                setTrackBpm(null);
                setTrackBpmPending(false);
                return;
            }
            if (url === lastSuccessfulBpmUrlRef.current) return;
            if (bpmPendingForUrlRef.current === url) return;

            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) {
                syncDetectedTrackBpm(null);
                setTrackBpm(null);
                setTrackBpmPending(false);
                return;
            }

            const gen = ++trackBpmGenRef.current;
            bpmPendingForUrlRef.current = url;
            syncDetectedTrackBpm(null);
            setTrackBpm(null);
            setTrackBpmPending(true);

            (async () => {
                const decodeCtx = new Ctor();
                try {
                    const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache' });
                    if (!res.ok) throw new Error('bpm fetch');
                    const raw = await res.arrayBuffer();
                    const buffer = await decodeCtx.decodeAudioData(raw.slice(0));
                    if (gen !== trackBpmGenRef.current) return;
                    const dur = Math.min(TRACK_BPM_ANALYZE_MAX_SECONDS, buffer.duration || 0);
                    if (dur < 1) throw new Error('buffer too short');
                    const { bpm } = await guess(buffer, 0, dur);
                    if (gen !== trackBpmGenRef.current) return;
                    const rounded = Number.isFinite(bpm) ? Math.round(bpm) : null;
                    setTrackBpm(rounded);
                    if (rounded != null) {
                        lastSuccessfulBpmUrlRef.current = url;
                        syncDetectedTrackBpm(rounded);
                    } else {
                        syncDetectedTrackBpm(null);
                    }
                } catch {
                    if (gen === trackBpmGenRef.current) {
                        syncDetectedTrackBpm(null);
                        setTrackBpm(null);
                    }
                } finally {
                    decodeCtx.close().catch(() => {});
                    if (gen === trackBpmGenRef.current) {
                        bpmPendingForUrlRef.current = null;
                        setTrackBpmPending(false);
                    }
                }
            })();
        };

        const onLoadedData = () => {
            const node = audioRef.current;
            if (!node || cancelled) return;
            runForUrl(node.currentSrc || node.src || '');
        };

        const onEmptied = () => {
            lastSuccessfulBpmUrlRef.current = '';
            bpmPendingForUrlRef.current = null;
            trackBpmGenRef.current += 1;
            syncDetectedTrackBpm(null);
            setTrackBpm(null);
            setTrackBpmPending(false);
        };

        const attach = () => {
            if (cancelled) return;
            const node = audioRef.current;
            if (!node) {
                rafId = requestAnimationFrame(attach);
                return;
            }
            el = node;
            el.addEventListener('loadeddata', onLoadedData);
            el.addEventListener('emptied', onEmptied);
            if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                onLoadedData();
            }
        };

        attach();

        return () => {
            cancelled = true;
            if (rafId) cancelAnimationFrame(rafId);
            trackBpmGenRef.current += 1;
            if (el) {
                el.removeEventListener('loadeddata', onLoadedData);
                el.removeEventListener('emptied', onEmptied);
            }
        };
    }, [audioRef]);


    // Apply complete recommendation from ReactionToSoundMapper - delegate to individual components
    const applyRecommendation = useCallback((recommendation) => {
        
        // Store current recommendation in state so components can react to changes
        setCurrentRecommendation(recommendation);
        
        // Also store on audioRef for backward compatibility
        if (audioRef.current) {
            audioRef.current.currentRecommendation = recommendation;
        }
        
        // Each component will handle its own part of the recommendation
        // No need for centralized logic here - let components be responsible for their own behavior
    }, []);

    // Apply external key shift (for future external controls/mappings)
    const applyKeyShift = useCallback((semitones) => {
        handleKeyShiftChange(semitones);
    }, [handleKeyShiftChange]);

    const applyBpmShift = useCallback((bpmPercent) => {
        handleBpmShiftChange(bpmPercent);
    }, [handleBpmShiftChange]);

    // Handle volume recommendations
    useEffect(() => {
        if (currentRecommendation) {
            // Apply volume based on recommendation
            if (currentRecommendation.emotionState && currentRecommendation.volumeMultiplier && currentRecommendation.volumeMultiplier !== 1.0) {
                applyEmotionVolume(
                    currentRecommendation.emotionState,
                    currentRecommendation.noddingAmplitude,
                    Boolean(currentRecommendation.volumeTracksNoddingAmplitude),
                );
            } else {
                resetToBaseValues();
            }
        } else {
            // Reset to base values when recommendation is null (e.g., hands no longer raised)
            resetToBaseValues();
        }
    }, [currentRecommendation, applyEmotionVolume, resetToBaseValues]);

    // Key / BPM from reaction mapper (manual mapping per emotion)
    useEffect(() => {
        if (!currentRecommendation) {
            handleKeyShiftChange(0);
            handleBpmShiftChange(0);
            return;
        }
        const semitones = Number(currentRecommendation.keyShiftSemitones);
        const bpmPct = Number(currentRecommendation.bpmShiftPercent);
        handleKeyShiftChange(Number.isFinite(semitones) ? semitones : 0);
        handleBpmShiftChange(Number.isFinite(bpmPct) ? bpmPct : 0);
    }, [currentRecommendation, handleKeyShiftChange, handleBpmShiftChange]);

    // Expose methods to parent component
    useEffect(() => {
        if (audioRef.current) {
            // Store methods on audio element for parent access
            audioRef.current.soundConsoleMethods = {
                initializeAudioContext,
                applyExternalEQ,
                applyEmotionVolume,
                applyKeyShift,
                applyBpmShift,
                resetEQ,
                resetToBaseValues,
                reconnectAudioGraph: reconnectAudioGraphManual,
                applyRecommendation,
                forceAllEffectsCreation
            };
            
            // Expose audioContextRef for mobile resume functionality
            audioRef.current.audioContextRef = audioContextRef;
        }
    }, [initializeAudioContext, applyExternalEQ, applyEmotionVolume, applyKeyShift, applyBpmShift, resetEQ, resetToBaseValues, reconnectAudioGraphManual, applyRecommendation, forceAllEffectsCreation]);


    return (
        <div>
            {/* Volume Control */}
            <div className="mb-4">
                <div className="d-flex align-items-center gap-2" style={{ minWidth: '200px' }}>
                    <img 
                        src={minSoundIcon} 
                        alt="Min Volume" 
                        style={{ 
                            width: '1.2rem', 
                            height: '1.2rem',
                            objectFit: 'contain'
                        }} 
                    />
                    <Form.Range
                        key={`volume-${displayVolume}`}
                        min="0"
                        max="1"
                        step="0.01"
                        value={displayVolume}
                        onChange={(e) => handleVolumeChange(e.target.value)}
                        style={{
                            flex: 1,
                            background: `linear-gradient(to right, ${secondaryColor} 0%, ${secondaryColor} ${displayVolume * 100}%, #333 ${displayVolume * 100}%, #333 100%)`
                        }}
                    />
                    <img 
                        src={maxSoundIcon} 
                        alt="Max Volume" 
                        style={{ 
                            width: '1.2rem', 
                            height: '1.2rem',
                            objectFit: 'contain'
                        }} 
                    />
                </div>
            </div>

            {/* EQ Component */}
            <EQ
                audioContextRef={audioContextRef}
                eqGains={eqGains}
                onEqGainsChange={handleEqGainsChange}
                onMakeupGainChange={handleMakeupGainChange}
                onApplyExternalEQ={(eqMethods) => {
                    if (audioRef.current) {
                        audioRef.current.eqMethods = eqMethods;
                        // Reconnect audio graph now that EQ methods are available
                        setTimeout(() => {
                            reconnectAudioGraphManual();
                        }, 50);
                    }
                }}
                onResetEQ={resetEQ}
                recommendation={currentRecommendation}
            />

            {/* Key Shift (Pitch) Control */}
            <div className="mt-4 mb-4">
                <div className="d-flex align-items-center justify-content-between mb-2">
                    <Subtitle style={{ margin: 0 }}>Key Shift</Subtitle>
                    <div className="d-flex gap-2 align-items-center">
                        <Text style={{ margin: 0, fontSize: '0.9rem', color: secondaryColor, fontWeight: 'bold' }}>
                            {keyShiftSemitones === 0 ? 'Original' : `${keyShiftSemitones > 0 ? '+' : ''}${keyShiftSemitones} st`}
                        </Text>
                    </div>
                </div>
                <div className="d-flex align-items-center gap-3">
                    <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>-12</span>
                    <Form.Range
                        min="-12"
                        max="12"
                        step="1"
                        value={keyShiftSemitones}
                        onChange={(e) => handleKeyShiftChange(e.target.value)}
                        style={{
                            flex: 1,
                            background: `linear-gradient(to right, #333 0%, #333 ${((keyShiftSemitones + 12) / 24) * 100}%, ${secondaryColor} ${((keyShiftSemitones + 12) / 24) * 100}%, ${secondaryColor} 100%)`
                        }}
                    />
                    <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>+12</span>
                </div>
            </div>

            {/* BPM / Tempo Control */}
            <div className="mt-4 mb-4">
                <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                    <Subtitle style={{ margin: 0 }}>BPM Shift</Subtitle>
                    <div className="d-flex flex-column align-items-end gap-0">
                        <Text style={{ margin: 0, fontSize: '0.9rem', color: secondaryColor, fontWeight: 'bold' }}>
                            {bpmShiftPercent === 0 ? 'Original' : `${bpmShiftPercent > 0 ? '+' : ''}${bpmShiftPercent}%`}
                        </Text>
                        <Text style={{ margin: 0, fontSize: '0.78rem', color: '#aaa' }}>
                            Track tempo:{' '}
                            {trackBpmPending ? 'Analyzing…' : trackBpm != null ? `${trackBpm} BPM` : '—'}
                        </Text>
                    </div>
                </div>
                <div className="d-flex align-items-center gap-3">
                    <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{BPM_SHIFT_PERCENT_MIN}%</span>
                    <Form.Range
                        min={BPM_SHIFT_PERCENT_MIN}
                        max={BPM_SHIFT_PERCENT_MAX}
                        step="1"
                        value={bpmShiftPercent}
                        onChange={(e) => handleBpmShiftChange(e.target.value)}
                        onInput={(e) => handleBpmShiftChange(e.target.value)}
                        style={{
                            flex: 1,
                            background: `linear-gradient(to right, #333 0%, #333 ${((bpmShiftPercent - BPM_SHIFT_PERCENT_MIN) / (BPM_SHIFT_PERCENT_MAX - BPM_SHIFT_PERCENT_MIN)) * 100}%, ${secondaryColor} ${((bpmShiftPercent - BPM_SHIFT_PERCENT_MIN) / (BPM_SHIFT_PERCENT_MAX - BPM_SHIFT_PERCENT_MIN)) * 100}%, ${secondaryColor} 100%)`
                        }}
                    />
                    <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>+{BPM_SHIFT_PERCENT_MAX}%</span>
                </div>
            </div>

            {/* Compression removed */}

            {/* Rhythmic Enhancement Component */}
            <AudioEffect
                effectType="rhythmicEnhancement"
                audioContextRef={audioContextRef}
                value={rhythmicEnhancement}
                displayValue={displayRhythmicEnhancement}
                onValueChange={handleRhythmicEnhancementChange}
                onDisplayValueChange={handleDisplayRhythmicEnhancementChange}
                onExternalEffectChange={handleTransientEnhancementChange}
                recommendation={currentRecommendation}
            />

            {/* Chorus removed */}

            {/* Delay Component */}
            <AudioEffect
                effectType="delay"
                audioContextRef={audioContextRef}
                value={delayAmount}
                displayValue={delayAmount}
                onValueChange={handleDelayAmountChange}
                onDisplayValueChange={handleDelayAmountChange}
                onExternalEffectChange={(delayMethods) => {
                    if (audioRef.current) {
                        audioRef.current.delayMethods = delayMethods;
                        // Reconnect audio graph now that delay methods are available
                        setTimeout(() => {
                            reconnectAudioGraphManual();
                        }, 100);
                    }
                }}
                recommendation={currentRecommendation}
            />

            {/* Reverb Component */}
            <AudioEffect
                effectType="reverb"
                audioContextRef={audioContextRef}
                value={reverbAmount}
                displayValue={reverbAmount}
                onValueChange={handleReverbAmountChange}
                onDisplayValueChange={handleReverbAmountChange}
                onExternalEffectChange={(reverbMethods) => {
                    if (audioRef.current) {
                        audioRef.current.reverbMethods = reverbMethods;
                        // Reconnect audio graph now that reverb methods are available
                        setTimeout(() => {
                            reconnectAudioGraphManual();
                        }, 50);
                    }
                }}
                recommendation={currentRecommendation}
            />

        </div>
    );
};

export default SoundConsole;