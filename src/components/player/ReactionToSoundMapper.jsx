/**
 * ReactionToSoundMapper Component - Maps User Reactions to Audio Parameters
 * 
 * This component analyzes streams of reaction data (emotions, body pose, facial landmarks)
 * and generates real-time recommendations for audio processing parameters.
 * 
 * EMOTION PROCESSING:
 * - Analyzes recent emotion data (default: last 1 second = ~5 datapoints at 200ms intervals)
 * - Determines dominant emotion from smiling and jawOpen values (happy / mouth open / neutral)
 * - Combines with nodding amplitude for compound states (nodding+happy, nodding+mouthOpen, nodding+neutral)
 * - Generates EQ preset, volume, rhythmic enhancement, and related recommendations
 * 
 * MAPPING SYSTEM:
 * - User-configurable emotion-to-audio mappings with sensible defaults
 * - Mappings are passed as props from parent component (Player.jsx)
 * - User can customize mappings via EmotionMappingSettings component
 * - Supports emotion keys including happy, mouthOpen, neutral, nodding+*, thumbUp/thumbDown, thumb*+handsRaised, handsRaised
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
    /** Arms raised: lift 60Hz / 170Hz (sub + bass) and low-mid; pair with higher volume map */
    'hands-raised': [11, 9, 4, 0, -2, -3],
    'treble-boost': [-3, -2, 0, 3, 6, 8],
    'vocal': [-4, -3, 5, 8, 7, 3],
    'warm': [3, 6, 3, 0, 0, 0],
    'bright': [0, 0, 0, 0, 6, 9],
    'muddy': [-3, -6, -3, 0, 0, 0],
    'harsh': [0, 0, 0, -3, -6, -3],
    /** Mouth open (jaw open): deep cut 310Hz–3kHz where vocal intelligibility sits */
    'mouth-open': [0, 0, -14, -15, -15, -12]
};

/** Same 6-band EQ as default `handsRaised` — used for nodding+smiling / nodding+neutral too */
const DEFAULT_HANDS_RAISED_EQ = [8, 6, 3, 0, -2, -3];

/** Nodding + mouth open: subs flat; boosted 310Hz–3kHz for voice vs nodding+neutral */
const NODDING_MOUTH_OPEN_EQ = [0, 0, 8, 5, 3, 0];

// Default EQ mappings - centralized configuration (using 6D vectors)
// Values match SoundConsole.jsx presets for consistency
export const DEFAULT_EQ_MAPPINGS = {
    'nodding+happy': [...DEFAULT_HANDS_RAISED_EQ],
    'nodding+mouthOpen': [...NODDING_MOUTH_OPEN_EQ],
    'nodding+neutral': [...DEFAULT_HANDS_RAISED_EQ],
    'thumbDown': [0, 0, 0, 0, 0, 0],
    'thumbUp': [0, 0, 0, 0, 0, 0],
    'thumbUp+handsRaised': [0, 0, 0, 0, 0, 0],
    'thumbDown+handsRaised': [0, 0, 0, 0, 0, 0],
    'handsRaised': [...DEFAULT_HANDS_RAISED_EQ],
    'happy': [0, 0, 0, 0, 0, 0],                // same EQ as neutral (smiling)
    mouthOpen: [...NODDING_MOUTH_OPEN_EQ], // same defaults as nodding+mouthOpen
    'neutral': [0, 0, 0, 0, 0, 0]               // flat
};

export const DEFAULT_VOLUME_MAPPINGS = {
    'nodding+happy': 1.2,
    'nodding+mouthOpen': 1.2,
    'nodding+neutral': 1.2,
    'thumbDown': 1.0,
    'thumbUp': 1.0,
    'thumbUp+handsRaised': 1.0,
    'thumbDown+handsRaised': 1.0,
    'handsRaised': 1.45, // 145% — max volume multiplier in mapping UI (full)
    'happy': 1.0, // same as neutral
    mouthOpen: 1.2,
    'neutral': 1.0
};

/**
 * Volume multiplier for an emotion: use stored value when valid; otherwise install default.
 */
export const resolveVolumeMultiplierForEmotion = (volumeMappings, emotionState) => {
    const raw = volumeMappings?.[emotionState];
    if (raw !== undefined && raw !== null) {
        const n = typeof raw === 'number' ? raw : parseFloat(raw);
        if (Number.isFinite(n)) return n;
    }
    return DEFAULT_VOLUME_MAPPINGS[emotionState] ?? 1.0;
};

// Compression removed

export const DEFAULT_RHYTHMIC_ENHANCEMENT_MAPPINGS = {
    'nodding+happy': 0,
    'nodding+mouthOpen': 100,
    'nodding+neutral': 0,
    'thumbDown': 0,
    'thumbUp': 0,
    'thumbUp+handsRaised': 0,
    'thumbDown+handsRaised': 0,
    'handsRaised': 0,
    'happy': 0,
    mouthOpen: 100,
    'neutral': 0
};

export const DEFAULT_REVERB_MAPPINGS = {
    'nodding+happy': 0,
    'nodding+mouthOpen': 0,
    'nodding+neutral': 0,
    'thumbDown': 0,
    'thumbUp': 0,
    'thumbUp+handsRaised': 0,
    'thumbDown+handsRaised': 0,
    'handsRaised': 0,
    'happy': 0,
    mouthOpen: 0,
    'neutral': 0
};

export const DEFAULT_DELAY_MAPPINGS = {
    'nodding+happy': 0,
    'nodding+mouthOpen': 0,
    'nodding+neutral': 0,
    'thumbDown': 0,
    'thumbUp': 0,
    'thumbUp+handsRaised': 0,
    'thumbDown+handsRaised': 0,
    'handsRaised': 0,
    'happy': 0,
    mouthOpen: 0,
    'neutral': 0
};

/** Per-emotion key shift in semitones (−12 … +12); 0 = no change */
export const DEFAULT_KEY_SHIFT_MAPPINGS = {
    'nodding+happy': 0,
    'nodding+mouthOpen': 0,
    'nodding+neutral': 0,
    'thumbDown': -2,
    'thumbUp': 2,
    'thumbUp+handsRaised': 2,
    'thumbDown+handsRaised': -2,
    'handsRaised': 0,
    'happy': 0,
    mouthOpen: 0,
    'neutral': 0
};

/**
 * Key shift for an emotion: explicit `keyShiftMappings[emotion]` wins; if missing, use install default
 * (so thumb up/down keep −2 / +2 when that key is missing from `keyShiftMappings`).
 */
export const resolveKeyShiftSemitonesForEmotion = (keyShiftMappings, emotionState) => {
    const v = keyShiftMappings?.[emotionState];
    if (v !== undefined && v !== null) return v;
    return DEFAULT_KEY_SHIFT_MAPPINGS[emotionState] ?? 0;
};

/** Per-emotion BPM shift in percent (−50 … +50); 0 = no change */
export const DEFAULT_BPM_SHIFT_MAPPINGS = {
    'nodding+happy': 0,
    'nodding+mouthOpen': 0,
    'nodding+neutral': 0,
    'thumbDown': 0,
    'thumbUp': 0,
    'thumbUp+handsRaised': 0,
    'thumbDown+handsRaised': 0,
    'handsRaised': 0,
    'happy': 0,
    mouthOpen: 0,
    'neutral': 0
};

/** Dominant emotion key when jaw-open signal wins over smiling / neutral. */
export const EMOTION_KEY_MOUTH_OPEN = 'mouthOpen';


const ReactionToSoundMapper = ({
    // Reaction data (all values are NUMERIC)
    emotionDataArray = [],           // Array of recent reaction detections - each item contains numeric values: {timestamp, smiling: 0-1, jawOpen: 0-1, amplitude, frequency, xPosition, yPosition, width, height}
    noddingAmplitude = 0,             // Current nodding amplitude (number, 0.0-1.0+ range, >0.03 = nodding)
    handsRaised = false,               // Whether hands are raised (boolean)
    /** MediaPipe GestureRecognizer — either hand thumb up (not simultaneous thumb-down). */
    thumbUpActive = false,
    /** Any hand thumb down (wins over thumb up when both appear). */
    thumbDownActive = false,
    
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
    keyShiftMappings = {},            // Emotion state -> Key shift in semitones (integer, typically −12…+12)
    bpmShiftMappings = {},           // Emotion state -> BPM shift in percent (integer, typically −50…+50)
    
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
        const shouldSwitchToMouthOpen = avgJawOpen > THRESHOLD_JAW_OPEN;
        
        // Determine if we should switch away from current emotion (lower thresholds)
        const shouldSwitchAwayFromHappy = currentEmotion === 'happy' && avgSmiling < THRESHOLD_SMILING_LOW;
        const shouldSwitchAwayFromMouthOpen =
            currentEmotion === EMOTION_KEY_MOUTH_OPEN && avgJawOpen < THRESHOLD_JAW_OPEN_LOW;
        
        // Determine emotion state using hysteresis
        
        // Determine emotion based on hysteresis logic
        let dominantEmotion = 'neutral'; // default
        
        if (shouldSwitchToHappy && !shouldSwitchAwayFromHappy) {
            dominantEmotion = 'happy';
        } else if (shouldSwitchToMouthOpen && !shouldSwitchAwayFromMouthOpen) {
            dominantEmotion = EMOTION_KEY_MOUTH_OPEN;
        } else if (currentEmotion === 'happy' && !shouldSwitchAwayFromHappy) {
            dominantEmotion = 'happy'; // Keep current emotion
        } else if (currentEmotion === EMOTION_KEY_MOUTH_OPEN && !shouldSwitchAwayFromMouthOpen) {
            dominantEmotion = EMOTION_KEY_MOUTH_OPEN; // Keep current emotion
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
     * Determine if hands are raised
     */
    const areHandsRaised = useCallback(() => {
        return handsRaised === true;
    }, [handsRaised]);
    
    /**
     * Combine emotion with nodding state and hand raising to create compound emotion state
     */
    const determineEmotionState = useCallback((dominantEmotion) => {
        // Thumb + hands raised compounds (down wins over up); defaults match thumbDown / thumbUp
        if (areHandsRaised() && thumbDownActive) {
            return 'thumbDown+handsRaised';
        }
        if (areHandsRaised() && thumbUpActive) {
            return 'thumbUp+handsRaised';
        }
        // Hands raised alone
        if (areHandsRaised()) {
            return 'handsRaised';
        }
        // Thumb gestures without raised hands (down wins over up)
        if (thumbDownActive) {
            return 'thumbDown';
        }
        if (thumbUpActive) {
            return 'thumbUp';
        }

        if (!dominantEmotion) {
            return null;
        }

        // Combine with nodding if user is nodding
        if (isNodding()) {
            return `nodding+${dominantEmotion}`;
        }

        return dominantEmotion;
    }, [isNodding, areHandsRaised, thumbDownActive, thumbUpActive]);
    
    /**
     * Generate audio parameter recommendations based on current emotion state
     */
    const generateRecommendation = useCallback(() => {
        // Step 1: Analyze emotion data
        const dominantEmotion = analyzeDominantEmotion(emotionDataArray);
        
        // Step 2: Determine emotion state (with nodding or hand raising)
        const emotionState = determineEmotionState(dominantEmotion);
        
        // If no emotion state determined, return null (no recommendation)
        if (!emotionState) {
            return null;
        }
        
        // Step 3: Look up mappings for this emotion state
        const eqMapping = eqMappings[emotionState];
        const eqVector = getEQVector(eqMapping);
        const volumeMultiplier = resolveVolumeMultiplierForEmotion(volumeMappings, emotionState);
        const rhythmicEnhancement = rhythmicEnhancementMappings[emotionState];
        const reverbAmount = reverbMappings[emotionState];
        const delayAmount = delayMappings[emotionState];
        const keyShiftSemitones = resolveKeyShiftSemitonesForEmotion(keyShiftMappings, emotionState);
        const bpmShiftPercent = bpmShiftMappings[emotionState] ?? 0;
        
        
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
            handsRaised: areHandsRaised(),
            thumbUpActive,
            thumbDownActive,
            
            // Audio parameters - use exact values from mappings, no fallbacks
            eqPreset: eqPresetKeyword,        // Keep keyword for UI compatibility
            eqVector: eqVector,               // 6D vector for actual processing
            volumeMultiplier: volumeMultiplier,
            rhythmicEnhancement: rhythmicEnhancement,
            reverbAmount: reverbAmount,
            delayAmount: delayAmount,
            keyShiftSemitones,
            bpmShiftPercent,
            
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
        handsRaised,
        thumbUpActive,
        thumbDownActive,
        eqMappings,
        volumeMappings,
        rhythmicEnhancementMappings,
        reverbMappings,
        delayMappings,
        keyShiftMappings,
        bpmShiftMappings,
        analyzeDominantEmotion,
        determineEmotionState,
        isNodding,
        areHandsRaised,
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
               newRec.handsRaised !== oldRec.handsRaised || // Check hand raising changes
               Math.abs((newRec.volumeMultiplier || 0) - (oldRec.volumeMultiplier || 0)) > 0.01 ||  // More sensitive to volume changes
               Math.abs((newRec.noddingAmplitude || 0) - (oldRec.noddingAmplitude || 0)) > THRESHOLD_NODDING || // More sensitive to nodding changes
               Math.abs((newRec.rhythmicEnhancement || 0) - (oldRec.rhythmicEnhancement || 0)) > 0.01 || // Check rhythmic enhancement changes
               Math.abs((newRec.reverbAmount || 0) - (oldRec.reverbAmount || 0)) > 0.01 || // Check reverb changes
               Math.abs((newRec.delayAmount || 0) - (oldRec.delayAmount || 0)) > 0.01 || // Check delay changes
               Math.abs((newRec.keyShiftSemitones ?? 0) - (oldRec.keyShiftSemitones ?? 0)) > 0.01 ||
               Math.abs((newRec.bpmShiftPercent ?? 0) - (oldRec.bpmShiftPercent ?? 0)) > 0.01;
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
        
        // Always process to detect state changes (including when hands are raised/lowered)
        // Process immediately
        processReactions();
        
        // Set up interval for continuous processing
        // Use configurable interval from ReactionMapperConfig (1000ms = 1Hz for once per second)
        const interval = setInterval(processReactions, REACTION_MAPPER_UPDATE_INTERVAL);
        
        return () => {
            clearInterval(interval);
        };
    }, [
        onRecommendationChange,
        emotionDataArray,
        noddingAmplitude,
        handsRaised,
        thumbUpActive,
        thumbDownActive,
        generateRecommendation,
        hasRecommendationChanged
    ]);
    
    // This is a headless component - no visual output
    return null;
};

export default ReactionToSoundMapper;

