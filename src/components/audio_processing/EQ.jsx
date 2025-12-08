/**
 * EQ Component - Audio Processing Interface for Equalizer
 * 
 * This component encapsulates equalizer functionality for the music player,
 * providing 6-band EQ with real-time gain control and visual feedback.
 * 
 * FEATURES:
 * - 6-band Equalizer (60Hz, 170Hz, 350Hz, 1kHz, 3.5kHz, 10kHz)
 * - Real-time gain control (-12 to +12 dB per band)
 * - Visual feedback with dB display and slider styling
 * - EQ preset application and management
 * - Makeup gain compensation for loudness
 * - Integration with Web Audio API
 * 
 * TECHNICAL FEATURES:
 * - Web Audio API BiquadFilter nodes
 * - Real-time parameter updates
 * - Visual feedback with percentage display
 * - Preset management system
 * - Makeup gain calculation and application
 * 
 * PROPS INTERFACE:
 * - Audio context and node management
 * - EQ gain state management
 * - Display values for UI feedback
 * - Event handlers for parameter changes
 * - Makeup gain callback for parent component
 * 
 * SEPARATION OF CONCERNS:
 * - This component only handles UI and audio processing for EQ
 * - Emotion interpretation is handled by ReactionToSoundMapper.jsx
 * - External EQ values are applied via applyExternalEQ
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { Form } from 'react-bootstrap';
import { Subtitle, Text } from '../../utils/StyledComponents';
import { secondaryColor } from '../../utils/DisplaySettings';

const EQ = ({
    audioContextRef,
    eqGains,
    onEqGainsChange,
    onMakeupGainChange,
    onApplyExternalEQ,
    onResetEQ,
    recommendation
}) => {
    // Web Audio API refs
    const filtersRef = useRef([]);

    // EQ frequency bands (Hz) and their gain values (-12 to +12 dB)
    const eqBands = [
        { frequency: 60, name: '60Hz', gain: 0 },
        { frequency: 170, name: '170Hz', gain: 0 },
        { frequency: 350, name: '350Hz', gain: 0 },
        { frequency: 1000, name: '1kHz', gain: 0 },
        { frequency: 3500, name: '3.5kHz', gain: 0 },
        { frequency: 10000, name: '10kHz', gain: 0 }
    ];

    // Create EQ filters
    const createEQFilters = useCallback(() => {
        if (!audioContextRef.current) return null;

        const context = audioContextRef.current;
        
        // Create EQ filters
        const filters = eqBands.map((band, index) => {
            const filter = context.createBiquadFilter();
            filter.type = index === 0 ? 'lowshelf' : 
                         index === eqBands.length - 1 ? 'highshelf' : 'peaking';
            filter.frequency.value = band.frequency;
            filter.Q.value = 1;
            filter.gain.value = 0;
            return filter;
        });

        return filters;
    }, [audioContextRef, eqBands]);

    // Initialize EQ filters when audio context is available
    useEffect(() => {
        if (audioContextRef.current && filtersRef.current.length === 0) {
            filtersRef.current = createEQFilters();
        }
    }, [audioContextRef, createEQFilters]);

    // Update EQ gain for a specific band
    const updateEQGain = useCallback((bandIndex, gain) => {
        if (filtersRef.current[bandIndex]) {
            filtersRef.current[bandIndex].gain.value = gain;
        }
        
        // Update parent component with new gains
        const newGains = [...eqGains];
        newGains[bandIndex] = gain;
        onEqGainsChange(newGains);
        
        // Trigger makeup gain calculation
        if (onMakeupGainChange) {
            onMakeupGainChange(newGains);
        }
    }, [eqGains, onEqGainsChange, onMakeupGainChange]);

    // Apply EQ presets
    const applyEQPreset = useCallback((presetName) => {
        const presets = {
            'flat': [0, 0, 0, 0, 0, 0],
            'bass-boost': [8, 6, 3, 0, -2, -3],
            'vocal': [-4, -3, 5, 8, 7, 3],
            'treble-boost': [-3, -2, 0, 3, 6, 8]
        };
        
        const preset = presets[presetName];
        if (preset) {
            preset.forEach((gain, index) => {
                if (filtersRef.current[index]) {
                    filtersRef.current[index].gain.value = gain;
                }
            });
            
            // Update parent component with preset gains
            onEqGainsChange(preset);
            
            // Trigger makeup gain calculation
            if (onMakeupGainChange) {
                onMakeupGainChange(preset);
            }
        }
    }, [onEqGainsChange, onMakeupGainChange]);

    // Apply external EQ values (from ReactionToSoundMapper)
    const applyExternalEQ = useCallback((eqVector) => {
        try {
            
            // Validate input
            if (!Array.isArray(eqVector) || eqVector.length !== 6) {
                return;
            }
            
            // Check if the values are actually different to prevent infinite loops
            const isDifferent = eqVector.some((gain, index) => Math.abs(gain - eqGains[index]) > 0.01);
            if (!isDifferent) {
                return; // No change needed
            }
            
            // Apply to filters
            eqVector.forEach((gain, index) => {
                if (filtersRef.current[index] && typeof gain === 'number' && !isNaN(gain)) {
                    filtersRef.current[index].gain.value = gain;
                }
            });
            
            // Update parent component with external gains
            onEqGainsChange(eqVector);
            
            // Trigger makeup gain calculation
            if (onMakeupGainChange) {
                onMakeupGainChange(eqVector);
            }
            
            
        } catch (error) {
            // Silent error handling
        }
    }, [eqGains, onEqGainsChange, onMakeupGainChange]);

    // Reset EQ to flat response
    const resetEQ = useCallback(() => {
        if (!filtersRef.current || filtersRef.current.length === 0) return;
        
        // Reset to flat response
        filtersRef.current.forEach(filter => {
            if (filter) {
                filter.gain.value = 0;
            }
        });
        
        const flatGains = eqBands.map(() => 0);
        onEqGainsChange(flatGains);
        
        // Trigger makeup gain calculation (should be 0 for flat response)
        if (onMakeupGainChange) {
            onMakeupGainChange(flatGains);
        }
    }, [eqBands, onEqGainsChange, onMakeupGainChange]);

    // Expose methods to parent component
    useEffect(() => {
        if (onApplyExternalEQ) {
            onApplyExternalEQ({
                applyExternalEQ,
                resetEQ,
                applyEQPreset,
                updateEQGain,
                filtersRef
            });
        }
    }, [onApplyExternalEQ]);

    // Handle recommendations from ReactionToSoundMapper
    useEffect(() => {
        if (recommendation) {
            if (recommendation.emotionState && recommendation.eqVector && recommendation.eqPreset !== 'flat') {
                applyExternalEQ(recommendation.eqVector);
            } else {
                resetEQ();
            }
        }
    }, [recommendation]);

    return (
        <div className="mt-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center gap-2">
                    <Subtitle style={{ margin: 0 }}>Equalizer</Subtitle>
                </div>
            </div>

            <div className="eq-container">
                {/* dB Values Row */}
                <div className="d-flex justify-content-between align-items-center mb-2">
                    {eqBands.map((band, index) => (
                        <div key={`db-${band.frequency}`} className="d-flex justify-content-center" style={{ flex: 1 }}>
                            <Text style={{ 
                                fontSize: '0.7rem', 
                                margin: '0',
                                color: eqGains[index] === 0 ? '#999' : secondaryColor,
                                fontWeight: eqGains[index] === 0 ? 'normal' : 'bold',
                                textAlign: 'center',
                                minHeight: '1rem'
                            }}>
                                {eqGains[index] > 0 ? '+' : ''}{eqGains[index].toFixed(1)}dB
                            </Text>
                        </div>
                    ))}
                </div>
                
                {/* Sliders Row */}
                <div className="d-flex justify-content-between align-items-center mb-2" style={{ height: '140px' }}>
                    {eqBands.map((band, index) => (
                        <div key={`slider-${band.frequency}`} className="d-flex justify-content-center align-items-center" style={{ flex: 1, height: '100%', position: 'relative' }}>
                            <div style={{ 
                                width: '30px', 
                                height: '120px', 
                                display: 'flex', 
                                justifyContent: 'center', 
                                alignItems: 'center',
                                position: 'relative'
                            }}>
                                <input
                                    type="range"
                                    min="-12"
                                    max="12"
                                    step="0.5"
                                    value={eqGains[index]}
                                    onChange={(e) => updateEQGain(index, parseFloat(e.target.value))}
                                    className="eq-vertical-slider"
                                    style={{
                                        width: '120px',
                                        height: '30px',
                                        transformOrigin: '50% 50%',
                                        transform: 'rotate(-90deg)',
                                        position: 'absolute',
                                        left: '50%',
                                        top: '50%',
                                        marginLeft: '-60px',
                                        marginTop: '-15px'
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                
                {/* Frequency Labels Row */}
                <div className="d-flex justify-content-between align-items-center">
                    {eqBands.map((band, index) => (
                        <div key={`label-${band.frequency}`} className="d-flex justify-content-center" style={{ flex: 1 }}>
                            <Text style={{ 
                                fontSize: '0.8rem', 
                                margin: '0',
                                textAlign: 'center',
                                fontWeight: 'bold'
                            }}>
                                {band.name}
                            </Text>
                        </div>
                    ))}
                </div>
                
            </div>
        </div>
    );
};

export default EQ;
