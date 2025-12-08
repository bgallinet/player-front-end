/**
 * AudioEffect Component - Unified Audio Processing Interface
 * 
 * This component handles different types of audio effects (rhythmic enhancement, reverb, etc.)
 * with a unified interface and effect-specific processing logic.
 * 
 * FEATURES:
 * - Unified interface for different audio effects
 * - Effect-specific audio processing logic
 * - Real-time parameter adjustment (0-100%)
 * - Visual feedback with percentage display
 * - Integration with Web Audio API
 * - Recommendation handling from ReactionToSoundMapper
 * 
 * PROPS INTERFACE:
 * - effectType: string - Type of effect ('rhythmicEnhancement', 'reverb', etc.)
 * - audioContextRef: AudioContext reference
 * - value: number - Current effect value
 * - displayValue: number - Display value for UI feedback
 * - onValueChange: function - Handler for value changes
 * - onDisplayValueChange: function - Handler for display value changes
 * - onExternalEffectChange: function - Handler for external effect changes
 * - recommendation: object - Recommendation from ReactionToSoundMapper
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { Form } from 'react-bootstrap';
import { Subtitle, Text } from '../../utils/StyledComponents';
import { secondaryColor } from '../../utils/DisplaySettings';
import { AUDIO_EFFECTS } from './audioEffects';

const AudioEffect = ({
    effectType,
    audioContextRef,
    value,
    displayValue,
    onValueChange,
    onDisplayValueChange,
    onExternalEffectChange,
    recommendation
}) => {
    // Web Audio API refs
    const effectRef = useRef(null);

    // Get effect configuration
    const effectConfig = AUDIO_EFFECTS[effectType];

    // Create effect processor using the registry
    const createEffectProcessor = useCallback((type) => {
        if (!audioContextRef.current || !effectConfig) return null;
        return effectConfig.createProcessor(audioContextRef.current);
    }, [audioContextRef, effectConfig]);

    // Effect-specific processing functions
    const startEffectProcessing = useCallback((effectValue) => {
        if (!effectRef.current || !effectConfig) return;
        effectConfig.process(effectRef.current, effectValue);
    }, [effectConfig]);

    // Initialize effect processor when audio context is available AND user has interacted
    useEffect(() => {
        // Only create effects if audio context is running (user has interacted)
        if (audioContextRef.current && !effectRef.current && audioContextRef.current.state === 'running') {
            try {
                effectRef.current = createEffectProcessor(effectType);
            } catch (error) {
                // Error creating processor
            }
        }
    }, [audioContextRef, createEffectProcessor, effectType]);

    // Apply effect when the audio context is ready
    useEffect(() => {
        if (effectRef.current) {
            startEffectProcessing(displayValue);
        }
    }, [displayValue, startEffectProcessing]);

    // Handle effect value change
    const handleEffectValueChange = useCallback((newValue) => {
        const effectValue = parseFloat(newValue);
        onValueChange(effectValue);
        onDisplayValueChange(effectValue);
        
        if (effectRef.current) {
            startEffectProcessing(effectValue);
        }
    }, [onValueChange, onDisplayValueChange, startEffectProcessing]);

    // Apply external effect value (from ReactionToSoundMapper)
    const applyExternalEffect = useCallback((effectValue) => {
        try {
            if (typeof effectValue !== 'number' || isNaN(effectValue) || !isFinite(effectValue)) {
                return;
            }
            
            const finalEffect = Math.max(0, Math.min(100, effectValue));
            startEffectProcessing(finalEffect);
            onDisplayValueChange(finalEffect);
            
        } catch (error) {
            // Silent error handling
        }
    }, [startEffectProcessing, onDisplayValueChange]);

    // Reset effect to default values
    const resetEffect = useCallback(() => {
        if (effectRef.current && effectConfig) {
            effectConfig.reset(effectRef.current);
        }
        onDisplayValueChange(0);
    }, [effectConfig, onDisplayValueChange]);

    // Force effect creation when audio context becomes active
    const forceEffectCreation = useCallback(() => {
        if (audioContextRef.current && !effectRef.current && audioContextRef.current.state === 'running') {
            try {
                effectRef.current = createEffectProcessor(effectType);
                if (effectRef.current) {
                    // Apply current display value to the newly created effect
                    startEffectProcessing(displayValue);
                }
            } catch (error) {
                // Error creating processor after user interaction
            }
        }
    }, [audioContextRef, createEffectProcessor, effectType, startEffectProcessing, displayValue]);

    // Track if methods have been exposed to reduce console noise
    const methodsExposedRef = useRef(false);

    // Expose methods to parent component (only when effectRef changes)
    useEffect(() => {
        if (onExternalEffectChange) {
            try {
                const methods = {
                    applyExternalEffect,
                    resetEffect,
                    startEffectProcessing,
                    forceEffectCreation,
                    effectRef,
                    // Expose the specific node references for audio graph connection
                    ...(effectType === 'rhythmicEnhancement' && {
                        rhythmicEnhancerRef: effectRef
                    }),
                    ...(effectType === 'reverb' && {
                        reverbRef: effectRef
                    }),
                    ...(effectType === 'delay' && {
                        delayRef: effectRef
                    })
                };
                onExternalEffectChange(methods);
                
                   // Track that methods have been exposed
                   if (effectRef.current && !methodsExposedRef.current) {
                       methodsExposedRef.current = true;
                   }
            } catch (error) {
                // Error exposing methods
            }
        }
    }, [onExternalEffectChange, applyExternalEffect, resetEffect, startEffectProcessing, forceEffectCreation, effectType]);

    // Handle recommendations from ReactionToSoundMapper
    useEffect(() => {
        if (recommendation) {
            let effectValue;
            switch (effectType) {
                case 'rhythmicEnhancement':
                    effectValue = recommendation.rhythmicEnhancement;
                    break;
                case 'reverb':
                    effectValue = recommendation.reverbAmount;
                    break;
                case 'delay':
                    effectValue = recommendation.delayAmount;
                    break;
                default:
                    effectValue = undefined;
            }
                
            if (recommendation.emotionState && effectValue !== undefined) {
                if (effectValue > 0) {
                    applyExternalEffect(effectValue);
                } else {
                    resetEffect();
                }
            }
        }
    }, [recommendation, effectType, applyExternalEffect, resetEffect]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (effectRef.current && effectRef.current.cleanup) {
                effectRef.current.cleanup();
            }
        };
    }, []);

    // Get display label based on effect type
    const getDisplayLabel = () => {
        return effectConfig?.displayLabel || 'Audio Effect';
    };

    // Get display suffix based on effect type
    const getDisplaySuffix = () => {
        return effectConfig?.displaySuffix || '';
    };

    return (
        <div className="mt-4 mb-4">
            <div className="d-flex align-items-center justify-content-between mb-2">
                <Subtitle style={{ margin: 0 }}>{getDisplayLabel()}</Subtitle>
                <div className="d-flex gap-2 align-items-center">
                    <Text style={{ margin: 0, fontSize: '0.9rem', color: secondaryColor, fontWeight: 'bold' }}>
                        {displayValue === 0 ? 'Off' : `${displayValue.toFixed(0)}${getDisplaySuffix()}`}
                    </Text>
                </div>
            </div>
            <div className="d-flex align-items-center gap-3">
                <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Off</span>
                <Form.Range
                    min="0"
                    max="100"
                    step="1"
                    value={displayValue}
                    onChange={(e) => handleEffectValueChange(e.target.value)}
                    style={{
                        flex: 1,
                        background: `linear-gradient(to right, ${secondaryColor} 0%, ${secondaryColor} ${displayValue}%, #333 ${displayValue}%, #333 100%)`
                    }}
                />
                <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Max</span>
            </div>
        </div>
    );
};

export default AudioEffect;
