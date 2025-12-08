/**
 * ManualMapping Component - Emotion-to-Audio Mapping Configuration Interface
 * 
 * This component provides a comprehensive interface for configuring emotion-to-audio mappings,
 * allowing users to customize how detected emotions affect audio parameters.
 * 
 * FEATURES:
 * - Emotion state configuration (nodding, smiling, surprised, neutral combinations)
 * - EQ preset mapping for each emotion state
 * - Volume multiplier mapping for each emotion state
 * - Rhythmic enhancement mapping for each emotion state
 * - Reverb amount mapping for each emotion state
 * - Real-time preview of current settings
 * - Comprehensive preset options for all audio parameters
 * 
 * TECHNICAL FEATURES:
 * - Modal overlay with backdrop
 * - Responsive grid layout for emotion states
 * - Form controls with validation
 * - Real-time mapping updates
 * - Preset management system
 * 
 * PROPS INTERFACE:
 * - Emotion mapping state and callbacks
 * - Volume mapping state and callbacks
 * - Rhythmic enhancement mapping state and callbacks
 * - Reverb mapping state and callbacks
 * - Visibility control and toggle callback
 */

import React, { useState } from 'react';
import { Form } from 'react-bootstrap';
import { Subtitle, Text } from '../../utils/StyledComponents';
import { secondaryColor } from '../../utils/DisplaySettings';
import settingsIcon from '../../images/settingsicon.png';
import CloseButton from '../../utils/CloseButton';

const ManualMapping = ({
    // Emotion mapping state
    eqMappings,
    onEmotionMappingChange,
    
    // Volume mapping state
    volumeMappings,
    onVolumeMappingChange,
    
    // Rhythmic enhancement mapping state
    rhythmicEnhancementMappings,
    onRhythmicEnhancementMappingChange,
    
    // Reverb mapping state
    reverbMappings,
    onReverbMappingChange,
    
    // Delay mapping state
    delayMappings,
    onDelayMappingChange,
    
    // Visibility control
    showEmotionMappings,
    onToggleEmotionMappings
}) => {
    // State for selected emotion
    const [selectedEmotion, setSelectedEmotion] = useState('nodding+happy');
    
    // Available emotion states
    const emotionStates = [
        { key: 'nodding+happy', label: 'Nodding + Smiling', icon: '' },
        { key: 'nodding+surprised', label: 'Nodding + Surprised', icon: '' },
        { key: 'nodding+neutral', label: 'Nodding + Neutral', icon: '' },
        { key: 'happy', label: 'Smiling', icon: '' },
        { key: 'surprised', label: 'Surprised', icon: '' },
        { key: 'neutral', label: 'Neutral', icon: '' }
    ];
    
    // EQ band labels and frequencies
    const eqBands = [
        { label: '60Hz', index: 0, description: 'Sub Bass' },
        { label: '170Hz', index: 1, description: 'Bass' },
        { label: '310Hz', index: 2, description: 'Low Mid' },
        { label: '600Hz', index: 3, description: 'Mid' },
        { label: '1kHz', index: 4, description: 'High Mid' },
        { label: '3kHz', index: 5, description: 'Presence' }
    ];
    

    // Handle emotion selection change
    const handleEmotionSelectionChange = (emotionKey) => {
        setSelectedEmotion(emotionKey);
    };
    
    // Handle EQ band change
    const handleEqBandChange = (bandIndex, value) => {
        const currentEq = eqMappings[selectedEmotion] || [0, 0, 0, 0, 0, 0];
        const newEq = [...currentEq];
        newEq[bandIndex] = parseFloat(value);
        onEmotionMappingChange(selectedEmotion, newEq);
    };
    
    // Handle volume mapping change
    const handleVolumeMappingChange = (volumeMultiplier) => {
        onVolumeMappingChange(selectedEmotion, parseFloat(volumeMultiplier));
    };
    
    // Handle rhythmic enhancement mapping change
    const handleRhythmicEnhancementMappingChange = (rhythmicEnhancement) => {
        onRhythmicEnhancementMappingChange(selectedEmotion, parseFloat(rhythmicEnhancement));
    };

    // Handle reverb mapping change
    const handleReverbMappingChange = (reverbAmount) => {
        onReverbMappingChange(selectedEmotion, parseFloat(reverbAmount));
    };

    // Handle delay mapping change
    const handleDelayMappingChange = (delayAmount) => {
        onDelayMappingChange(selectedEmotion, parseFloat(delayAmount));
    };
    
    // Get current values for selected emotion
    const getCurrentEqValue = (bandIndex) => {
        const currentEq = eqMappings[selectedEmotion];
        if (Array.isArray(currentEq)) {
            return currentEq[bandIndex] || 0;
        }
        return 0;
    };
    
    const getCurrentVolumeValue = () => {
        return (volumeMappings[selectedEmotion] || 1.0) * 100;
    };
    
    const getCurrentRhythmicEnhancementValue = () => {
        return rhythmicEnhancementMappings[selectedEmotion] || 0;
    };
    
    const getCurrentReverbValue = () => {
        return reverbMappings[selectedEmotion] || 0;
    };
    
    const getCurrentDelayValue = () => {
        return delayMappings[selectedEmotion] || 0;
    };

    return (
        <>
            {/* Emotion Mapping Settings Overlay */}
            {showEmotionMappings && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        zIndex: 1050,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1rem'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            onToggleEmotionMappings(false);
                        }
                    }}
                >
                    <div
                        style={{
                            backgroundColor: '#1a1a1a',
                            borderRadius: '0.5rem',
                            padding: '2rem',
                            maxWidth: '900px',
                            width: '100%',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            border: `2px solid ${secondaryColor}`,
                            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <div>
                                <div className="d-flex align-items-center">
                                    <img 
                                        src={settingsIcon} 
                                        alt="Settings" 
                                        style={{ 
                                            width: '1.5rem', 
                                            height: '1.5rem',
                                            marginRight: '0.5rem'
                                        }} 
                                    />
                                    <Subtitle style={{ margin: 0, fontSize: '1.5rem' }}>
                                        Emotion-to-Audio Mappings
                                    </Subtitle>
                                </div>
                                <Text style={{ fontSize: '0.9rem', opacity: 0.8, margin: '0.5rem 0 0 0' }}>
                                    Customize audio parameters for each emotion state
                                </Text>
                            </div>
                            <CloseButton
                                onClick={() => onToggleEmotionMappings(false)}
                            />
                        </div>

                        {/* Emotion Selection */}
                        <div className="mb-4">
                            <Text style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: 'bold' }}>
                                Select Emotion to Configure:
                            </Text>
                            <Form.Select
                                value={selectedEmotion}
                                onChange={(e) => handleEmotionSelectionChange(e.target.value)}
                                style={{
                                    backgroundColor: '#333',
                                    borderColor: secondaryColor,
                                    color: 'white',
                                    fontSize: '1rem',
                                    padding: '0.75rem'
                                }}
                            >
                                {emotionStates.map((emotion) => (
                                    <option key={emotion.key} value={emotion.key}>
                                        {emotion.icon} {emotion.label}
                                    </option>
                                ))}
                            </Form.Select>
                        </div>


                        {/* EQ Bands */}
                        <div className="mb-4">
                            <Text style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: 'bold' }}>
                                EQ Bands:
                            </Text>
                            <div className="row">
                                {eqBands.map((band) => (
                                    <div key={band.index} className="col-6 col-md-4 mb-3">
                                        <div className="text-center">
                                            <Text style={{ fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                                                {band.label}
                                            </Text>
                                            <Text style={{ fontSize: '0.7rem', marginBottom: '0.5rem', opacity: 0.7 }}>
                                                {band.description}
                                            </Text>
                                            <Form.Range
                                                min="-15"
                                                max="15"
                                                step="0.5"
                                                value={getCurrentEqValue(band.index)}
                                                onChange={(e) => handleEqBandChange(band.index, e.target.value)}
                                                style={{
                                                    background: `linear-gradient(to right, ${secondaryColor} 0%, ${secondaryColor} ${(getCurrentEqValue(band.index) + 15) / 30 * 100}%, #333 ${(getCurrentEqValue(band.index) + 15) / 30 * 100}%, #333 100%)`
                                                }}
                                            />
                                            <Text style={{ fontSize: '0.8rem', color: secondaryColor, fontWeight: 'bold' }}>
                                                {getCurrentEqValue(band.index) > 0 ? '+' : ''}{getCurrentEqValue(band.index).toFixed(1)}dB
                                            </Text>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Volume Control */}
                        <div className="mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <Text style={{ fontSize: '1rem', margin: 0, fontWeight: 'bold' }}>Volume:</Text>
                                <Text style={{ fontSize: '1rem', margin: 0, color: secondaryColor, fontWeight: 'bold' }}>
                                    {getCurrentVolumeValue().toFixed(0)}%
                                </Text>
                            </div>
                            <Form.Range
                                min="70"
                                max="145"
                                step="5"
                                value={getCurrentVolumeValue()}
                                onChange={(e) => handleVolumeMappingChange(parseFloat(e.target.value) / 100)}
                                style={{
                                    background: `linear-gradient(to right, ${secondaryColor} 0%, ${secondaryColor} ${(getCurrentVolumeValue() - 70) / 75 * 100}%, #333 ${(getCurrentVolumeValue() - 70) / 75 * 100}%, #333 100%)`
                                }}
                            />
                        </div>

                        {/* Rhythmic Enhancement Control */}
                        <div className="mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <Text style={{ fontSize: '1rem', margin: 0, fontWeight: 'bold' }}>Rhythmic Enhancement:</Text>
                                <Text style={{ fontSize: '1rem', margin: 0, color: secondaryColor, fontWeight: 'bold' }}>
                                    {getCurrentRhythmicEnhancementValue()}%
                                </Text>
                            </div>
                            <Form.Range
                                min="0"
                                max="100"
                                step="5"
                                value={getCurrentRhythmicEnhancementValue()}
                                onChange={(e) => handleRhythmicEnhancementMappingChange(parseFloat(e.target.value))}
                                style={{
                                    background: `linear-gradient(to right, ${secondaryColor} 0%, ${secondaryColor} ${getCurrentRhythmicEnhancementValue()}%, #333 ${getCurrentRhythmicEnhancementValue()}%, #333 100%)`
                                }}
                            />
                        </div>

                        {/* Reverb Control */}
                        <div className="mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <Text style={{ fontSize: '1rem', margin: 0, fontWeight: 'bold' }}>Reverb:</Text>
                                <Text style={{ fontSize: '1rem', margin: 0, color: secondaryColor, fontWeight: 'bold' }}>
                                    {getCurrentReverbValue()}%
                                </Text>
                            </div>
                            <Form.Range
                                min="0"
                                max="100"
                                step="5"
                                value={getCurrentReverbValue()}
                                onChange={(e) => handleReverbMappingChange(parseFloat(e.target.value))}
                                style={{
                                    background: `linear-gradient(to right, ${secondaryColor} 0%, ${secondaryColor} ${getCurrentReverbValue()}%, #333 ${getCurrentReverbValue()}%, #333 100%)`
                                }}
                            />
                        </div>

                        {/* Delay Control */}
                        <div className="mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <Text style={{ fontSize: '1rem', margin: 0, fontWeight: 'bold' }}>Delay:</Text>
                                <Text style={{ fontSize: '1rem', margin: 0, color: secondaryColor, fontWeight: 'bold' }}>
                                    {getCurrentDelayValue()}%
                                </Text>
                            </div>
                            <Form.Range
                                min="0"
                                max="100"
                                step="5"
                                value={getCurrentDelayValue()}
                                onChange={(e) => handleDelayMappingChange(parseFloat(e.target.value))}
                                style={{
                                    background: `linear-gradient(to right, ${secondaryColor} 0%, ${secondaryColor} ${getCurrentDelayValue()}%, #333 ${getCurrentDelayValue()}%, #333 100%)`
                                }}
                            />
                        </div>

                        <div 
                            className="mt-4 pt-3" 
                            style={{ 
                                borderTop: `1px solid #333`,
                                backgroundColor: '#2a2a2a',
                                borderRadius: '0.5rem',
                                padding: '1rem'
                            }}
                        >
                            <Text style={{ fontSize: '0.9rem', opacity: 0.8, margin: 0 }}>
                                <strong>Tips:</strong>
                            </Text>
                            <ul style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem', marginBottom: 0 }}>
                                <li>Select an emotion from the dropdown to configure its audio parameters</li>
                                <li>EQ bands range from -15dB to +15dB for precise frequency control</li>
                                <li>Volume multipliers range from 70% (Quiet) to 145% (Maximum)</li>
                                <li>Rhythmic enhancement ranges from Off (0%) to Maximum (100%)</li>
                                <li>Reverb amounts range from Off (0%) to Maximum (100%)</li>
                                <li>Delay amounts range from Off (0%) to Maximum (100%)</li>
                                <li>Nodding states scale EQ intensity and volume based on head movement amplitude (0-3)</li>
                                <li>Changes apply immediately - try different emotions to test your settings!</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ManualMapping;
