/**
 * ReactionToSoundMapper Component - Maps User Reactions to Audio Parameters
 * 
 * This component analyzes streams of reaction data (emotions, body pose, facial landmarks)
 * and generates real-time recommendations for audio processing parameters.
 * 
 * EMOTION PROCESSING:
 * - Analyzes recent emotion data (default: last 1 second = ~5 datapoints at 200ms intervals)
 * - Determines dominant emotion from smiling and jawOpen values (happy/surprised/neutral)
 * - Combines with nodding amplitude for compound states (nodding+happy, nodding+surprised, nodding+neutral)
 * - Generates EQ preset and volume multiplier recommendations
 * 
 * MAPPING SYSTEM:
 * - User-configurable emotion-to-audio mappings with sensible defaults
 * - Mappings are passed as props from parent component (Player.jsx)
 * - User can customize mappings via EmotionMappingSettings component
 * - Supports all emotion states: happy, surprised, neutral, nodding+happy, nodding+surprised, nodding+neutral
 * - Extensible architecture for future body pose and facial landmark integrations
 * 
 * DATA FLOW:
 * Input: Arrays of emotion data, nodding amplitude, body pose data (future), facial landmark data (future)
 * Processing: Analyzes recent history, determines dominant reaction, applies user mappings
 * Output: Callback with recommended audio parameters (EQ preset, volume)
 * 
 * CONFIGURATION:
 * - emotionMappings: Maps emotion states to EQ presets (from EmotionMappingSettings)
 * - volumeMappings: Maps emotion states to volume multipliers (from EmotionMappingSettings)
 * - analysisWindow: Time window for reaction analysis (default: 1000ms)
 * - Detection thresholds (all NUMERIC values): nodding=0.03, smiling=0.5, jawOpen=0.5
 * 
 * INTEGRATION WITH EmotionMappingSettings:
 * The parent component (Player.jsx) manages the mapping state and passes it to this component.
 * Users modify mappings through the EmotionMappingSettings component, which updates Player.jsx state.
 * This component automatically receives updated mappings and applies them to new recommendations.
 * 
 * INPUT DATA FORMAT:
 * All input values are numeric (floats/integers) with specific ranges:
 * 
 * emotionDataArray: Array of objects, each containing:
 * - timestamp: Detection time (number, milliseconds since epoch)
 * - smiling: Smile intensity (number, 0.0-1.0 range, where 0=no smile, 1=maximum smile)
 * - jawOpen: Jaw open intensity (number, 0.0-1.0 range, where 0=closed jaw, 1=maximum open)
 * - amplitude: Nodding amplitude (number, typically 0.0-1.0+ range)
 * - frequency: Nodding frequency (number, Hz, typically 0.5-3.0 range)
 * - xPosition: Face X position (number, pixels or normalized coordinates)
 * - yPosition: Face Y position (number, pixels or normalized coordinates) 
 * - width: Face width (number, pixels or normalized coordinates)
 * - height: Face height (number, pixels or normalized coordinates)
 * 
 * noddingAmplitude: Current nodding intensity (number, 0.0-1.0+ range, where >0.03 indicates nodding)
 * 
 * Mapping values are also numeric:
 * - eqMappings: Emotion state → EQ preset (6D vector [low, lowMid, mid, highMid, high, presence] in dB)
 * - volumeMappings: Emotion state → Volume multiplier (number, 0.0-2.0+ range, where 1.0=no change)
 * - rhythmicEnhancementMappings: Emotion state → Enhancement percentage (number, 0-100 range)
 * - reverbMappings: Emotion state → Reverb percentage (number, 0-100 range)
 * 
 * Example usage in Player.jsx:
 * ```jsx
 * <ReactionToSoundMapper
 *     emotionDataArray={emotionDataArray}
 *     noddingAmplitude={noddingAmplitude}
 *     emotionMappings={emotionMappings}      // User-configured via EmotionMappingSettings
 *     volumeMappings={volumeMappings}        // User-configured via EmotionMappingSettings
 *     onRecommendationChange={handleRecommendationChange}
 * />
 * ```
 */

import { useEffect, useRef, useCallback } from 'react';
import { 
    REACTION_MAPPER_UPDATE_INTERVAL,
    EMOTION_ANALYSIS_WINDOW,
    MIN_DATA_POINTS_REQUIRED,
    THRESHOLD_NODDING,
    THRESHOLD_SMILING,
    THRESHOLD_JAW_OPEN,
    THRESHOLD_SMILING_LOW,
    THRESHOLD_JAW_OPEN_LOW
} from '../../hooks/ReactionMapperConfig';

// EQ preset definitions as 6D vectors [low, lowMid, mid, highMid, high, presence]
// Each value represents gain in dB for that frequency band
// Values match SoundConsole.jsx presets for consistency
export const EQ_PRESETS = {
    'flat': [0, 0, 0, 0, 0, 0],
    'bass-boost': [8, 6, 3, 0, -2, -3],
    'treble-boost': [-3, -2, 0, 3, 6, 8],
    'vocal': [-4, -3, 5, 8, 7, 3],
    'warm': [3, 6, 3, 0, 0, 0],
    'bright': [0, 0, 0, 0, 6, 9],
    'muddy': [-3, -6, -3, 0, 0, 0],
    'harsh': [0, 0, 0, -3, -6, -3]
};

// Default EQ mappings - centralized configuration (using 6D vectors)
// Values match SoundConsole.jsx presets for consistency
export const DEFAULT_EQ_MAPPINGS = {
    'nodding+happy': [-4, -3, 5, 8, 7, 3],      // vocal
    'nodding+surprised': [-3, -2, 0, 3, 6, 8],  // treble-boost
    'nodding+neutral': [8, 6, 3, 0, -2, -3],    // bass-boost
    'happy': [0, 0, 0, 0, 0, 0],                // flat
    'surprised': [0, 0, 0, 0, 0, 0],            // flat
    'neutral': [0, 0, 0, 0, 0, 0]               // flat
};

export const DEFAULT_VOLUME_MAPPINGS = {
    'nodding+happy': 1.3,
    'nodding+surprised': 1.3, 
    'nodding+neutral': 1.45,
    'happy': 1.0,
    'surprised': 1.0,
    'neutral': 1.0
};

// Compression removed

export const DEFAULT_RHYTHMIC_ENHANCEMENT_MAPPINGS = {
    'nodding+happy': 0,
    'nodding+surprised': 0, 
    'nodding+neutral': 0,
    'happy': 100,
    'surprised': 0,
    'neutral': 0
};

export const DEFAULT_REVERB_MAPPINGS = {
    'nodding+happy': 0,
    'nodding+surprised': 0, 
    'nodding+neutral': 0,
    'happy': 0,
    'surprised': 50,
    'neutral': 0
};

export const DEFAULT_DELAY_MAPPINGS = {
    'nodding+happy': 0,
    'nodding+surprised': 0, 
    'nodding+neutral': 0,
    'happy': 0,
    'surprised': 40,
    'neutral': 0
};


const ReactionToSoundMapper = ({
    // Reaction data (all values are NUMERIC)
    emotionDataArray = [],           // Array of recent reaction detections - each item contains numeric values: {timestamp, smiling: 0-1, jawOpen: 0-1, amplitude, frequency, xPosition, yPosition, width, height}
    noddingAmplitude = 0,             // Current nodding amplitude (number, 0.0-1.0+ range, >0.03 = nodding)
    
    // Body pose data (future use) - will contain numeric pose coordinates
    bodyPoseDataArray = [],           // Array of recent body pose detections
    
    // Facial landmark data (future use) - will contain numeric landmark coordinates  
    facialLandmarkDataArray = [],    // Array of recent facial landmark detections
    
    // Mapping configuration (all values are NUMERIC)
    eqMappings = {},                  // Emotion state -> EQ preset (6D vector in dB or string keyword)
    volumeMappings = {},              // Emotion state -> Volume multiplier (number, 0.0-2.0+ range)
    rhythmicEnhancementMappings = {}, // Emotion state -> Rhythmic enhancement percentage (number, 0-100 range)
    reverbMappings = {},              // Emotion state -> Reverb percentage (number, 0-100 range)
    delayMappings = {},               // Emotion state -> Delay percentage (number, 0-100 range)
    
    // Configuration
    analysisWindowMs = EMOTION_ANALYSIS_WINDOW,          // Time window for analysis (ms)
    minDataPointsRequired = MIN_DATA_POINTS_REQUIRED,    // Minimum data points needed for analysis
    
    // Output callback
    onRecommendationChange            // (recommendation) => void
}) => {
    // Keep track of last recommendation to avoid redundant updates
    const lastRecommendationRef = useRef(null);
    
    /**
     * Get EQ vector from mapping (now stored directly as vectors)
     * @param {number[]|string} eqMapping - EQ mapping (vector or keyword for backward compatibility)
     * @returns {number[]} 6D vector [low, lowMid, mid, highMid, high, presence]
     */
    const getEQVector = useCallback((eqMapping) => {
        // If it's already a vector, return it
        if (Array.isArray(eqMapping) && eqMapping.length === 6) {
            return eqMapping;
        }
        // If it's a string keyword, convert it
        if (typeof eqMapping === 'string') {
            return EQ_PRESETS[eqMapping] || EQ_PRESETS.flat;
        }
        // Default to flat
        return EQ_PRESETS.flat;
    }, []);
    
    /**
     * Analyze emotion data array and determine dominant emotion
     * Uses frequency analysis with smoothing to prevent shaking
     * Determines emotion from smiling and jawOpen values in data points
     */
    const analyzeDominantEmotion = useCallback((emotionData) => {
        if (!emotionData || emotionData.length === 0) {
            return null;
        }
        
        // Filter to recent data within the analysis window
        // Use the most recent data point timestamp as reference instead of current time
        const newestTimestamp = Math.max(...emotionData.map(d => d.timestamp));
        const recentData = emotionData.filter(
            item => item && item.timestamp && (newestTimestamp - item.timestamp) <= analysisWindowMs
        );
        
        if (emotionData.length > 0) {
            const oldest = Math.min(...emotionData.map(d => d.timestamp));
            const newest = Math.max(...emotionData.map(d => d.timestamp));
        }
        
        // Need minimum data points for reliable analysis
        if (recentData.length < minDataPointsRequired) {
            return null;
        }
        
        // Calculate average values for smoothing
        const avgSmiling = recentData.reduce((sum, item) => sum + (item.smiling || 0), 0) / recentData.length;
        const avgJawOpen = recentData.reduce((sum, item) => sum + (item.jawOpen || 0), 0) / recentData.length;
        
        // Calculate average values for emotion detection
        
        // Use hysteresis to prevent shaking between emotions
        const currentEmotion = lastRecommendationRef.current?.dominantEmotion;
        
        // Determine if we should switch to a new emotion (higher thresholds)
        const shouldSwitchToHappy = avgSmiling > THRESHOLD_SMILING;
        const shouldSwitchToSurprised = avgJawOpen > THRESHOLD_JAW_OPEN;
        
        // Determine if we should switch away from current emotion (lower thresholds)
        const shouldSwitchAwayFromHappy = currentEmotion === 'happy' && avgSmiling < THRESHOLD_SMILING_LOW;
        const shouldSwitchAwayFromSurprised = currentEmotion === 'surprised' && avgJawOpen < THRESHOLD_JAW_OPEN_LOW;
        
        // Determine emotion state using hysteresis
        
        // Determine emotion based on hysteresis logic
        let dominantEmotion = 'neutral'; // default
        
        if (shouldSwitchToHappy && !shouldSwitchAwayFromHappy) {
            dominantEmotion = 'happy';
        } else if (shouldSwitchToSurprised && !shouldSwitchAwayFromSurprised) {
            dominantEmotion = 'surprised';
        } else if (currentEmotion === 'happy' && !shouldSwitchAwayFromHappy) {
            dominantEmotion = 'happy'; // Keep current emotion
        } else if (currentEmotion === 'surprised' && !shouldSwitchAwayFromSurprised) {
            dominantEmotion = 'surprised'; // Keep current emotion
        }
        
        // Return determined emotion
        return dominantEmotion;
    }, [analysisWindowMs, minDataPointsRequired]);
    
    /**
     * Determine if user is currently nodding based on amplitude threshold
     */
    const isNodding = useCallback(() => {
        return typeof noddingAmplitude === 'number' && 
               !isNaN(noddingAmplitude) && 
               isFinite(noddingAmplitude) && 
               noddingAmplitude > THRESHOLD_NODDING;
    }, [noddingAmplitude]);
    
    /**
     * Combine emotion with nodding state to create compound emotion state
     */
    const determineEmotionState = useCallback((dominantEmotion) => {
        if (!dominantEmotion) {
            return null;
        }
        
        // Combine with nodding if user is nodding
        if (isNodding()) {
            return `nodding+${dominantEmotion}`;
        }
        
        return dominantEmotion;
    }, [isNodding]);
    
    /**
     * Generate audio parameter recommendations based on current emotion state
     */
    const generateRecommendation = useCallback(() => {
        // Step 1: Analyze emotion data
        const dominantEmotion = analyzeDominantEmotion(emotionDataArray);
        
        // Step 2: Determine emotion state (with nodding)
        const emotionState = determineEmotionState(dominantEmotion);
        
        
        // Step 3: Look up mappings for this emotion state
        const eqMapping = eqMappings[emotionState];
        const eqVector = getEQVector(eqMapping);
        const volumeMultiplier = volumeMappings[emotionState];
        const rhythmicEnhancement = rhythmicEnhancementMappings[emotionState];
        const reverbAmount = reverbMappings[emotionState];
        const delayAmount = delayMappings[emotionState];
        
        
        // For UI compatibility, determine the preset keyword
        const eqPresetKeyword = Array.isArray(eqMapping) ? 
            Object.keys(EQ_PRESETS).find(key => 
                JSON.stringify(EQ_PRESETS[key]) === JSON.stringify(eqVector)
            ) || 'custom' : eqMapping;
        
        
        // Step 4: Build recommendation object
        const recommendation = {
            // Source data
            emotionState,
            dominantEmotion,
            noddingAmplitude: isNodding() ? noddingAmplitude : 0,
            isNodding: isNodding(),
            
            // Audio parameters - use exact values from mappings, no fallbacks
            eqPreset: eqPresetKeyword,        // Keep keyword for UI compatibility
            eqVector: eqVector,               // 6D vector for actual processing
            volumeMultiplier: volumeMultiplier,
            rhythmicEnhancement: rhythmicEnhancement,
            reverbAmount: reverbAmount,
            delayAmount: delayAmount,
            
            // Metadata
            timestamp: Date.now(),
            dataPointsAnalyzed: emotionDataArray.length,
            
            // Future extensions
            bodyPoseInfluence: null,      // Reserved for body pose analysis
            facialLandmarkInfluence: null // Reserved for facial landmark analysis
        };
        
        
        // Generate complete recommendation
        
        
        return recommendation;
    }, [
        emotionDataArray,
        noddingAmplitude,
        eqMappings,
        volumeMappings,
        rhythmicEnhancementMappings,
        reverbMappings,
        delayMappings,
        analyzeDominantEmotion,
        determineEmotionState,
        isNodding,
        getEQVector
    ]);
    
    /**
     * Check if recommendation has changed significantly
     * This function controls how sensitive the system is to changes
     */
    const hasRecommendationChanged = useCallback((newRec, oldRec) => {
        if (!oldRec) return true;
        if (!newRec) return true; // Always trigger when recommendation becomes null (reset case)
        
        // Compare key fields with more sensitive thresholds for better responsiveness
        return newRec.emotionState !== oldRec.emotionState ||
               newRec.eqPreset !== oldRec.eqPreset ||
               Math.abs(newRec.volumeMultiplier - oldRec.volumeMultiplier) > 0.01 ||  // More sensitive to volume changes
               Math.abs(newRec.noddingAmplitude - oldRec.noddingAmplitude) > THRESHOLD_NODDING || // More sensitive to nodding changes
               Math.abs((newRec.rhythmicEnhancement || 0) - (oldRec.rhythmicEnhancement || 0)) > 0.01 || // Check rhythmic enhancement changes
               Math.abs((newRec.reverbAmount || 0) - (oldRec.reverbAmount || 0)) > 0.01 || // Check reverb changes
               Math.abs((newRec.delayAmount || 0) - (oldRec.delayAmount || 0)) > 0.01; // Check delay changes
    }, []);
    
    /**
     * Main processing loop - generate and emit recommendations
     */
    useEffect(() => {
        const processReactions = () => {
            try {
                
                const recommendation = generateRecommendation();
                                
                // Only emit if recommendation changed
                const hasChanged = hasRecommendationChanged(recommendation, lastRecommendationRef.current);
                
                if (hasChanged) {
                    lastRecommendationRef.current = recommendation;
                    
                    if (onRecommendationChange && typeof onRecommendationChange === 'function') {
                        onRecommendationChange(recommendation);
                    }
                }
            } catch (error) {
                // Silent error handling
            }
        };
        
        // Only set up interval if we have data to process
        if (emotionDataArray && emotionDataArray.length > 0) {
            // Process immediately
            processReactions();
            
            // Set up interval for continuous processing
            // Use configurable interval from ReactionMapperConfig (1000ms = 1Hz for once per second)
            const interval = setInterval(processReactions, REACTION_MAPPER_UPDATE_INTERVAL);
            
            return () => {
                clearInterval(interval);
            };
        }
    }, [onRecommendationChange, emotionDataArray]);
    
    // This is a headless component - no visual output
    return null;
};

export default ReactionToSoundMapper;

