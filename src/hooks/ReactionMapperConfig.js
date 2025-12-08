/**
 * ReactionToSoundMapper Configuration
 * 
 * Centralized configuration for the ReactionToSoundMapper component
 * and related audio processing intervals.
 */

// Update interval for reaction processing (milliseconds)
export const REACTION_MAPPER_UPDATE_INTERVAL = 1000; // 1 second

// Analysis window for emotion detection (milliseconds)
export const EMOTION_ANALYSIS_WINDOW = 1000; // 1 second

// Data collection window for rolling buffer (milliseconds)
export const DATA_COLLECTION_WINDOW = 10000; // 10 seconds

// Minimum data points required for reliable emotion analysis
export const MIN_DATA_POINTS_REQUIRED = 3;

// Reaction detection thresholds
export const THRESHOLD_NODDING = 0.005;      // Minimum amplitude to detect nodding
export const THRESHOLD_SMILING = 0.1;       // Minimum intensity to detect smiling (happy)
export const THRESHOLD_JAW_OPEN = 0.1;      // Minimum intensity to detect jaw open (surprised)

// Hysteresis thresholds to prevent shaking (lower thresholds to switch away from emotion)
export const THRESHOLD_SMILING_LOW = 0.05;   // Lower threshold to switch away from happy
export const THRESHOLD_JAW_OPEN_LOW = 0.05;  // Lower threshold to switch away from surprised
