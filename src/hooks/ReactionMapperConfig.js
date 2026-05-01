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

// Fraction of resampled timeline frames (0–1) in EMOTION_ANALYSIS_WINDOW required to treat a gesture as active.
export const GESTURE_ACTIVE_MEAN_THRESHOLD = 0.35;

// Reaction detection thresholds
export const THRESHOLD_NODDING = 0.005;      // Minimum amplitude to detect nodding
export const THRESHOLD_SMILING = 0.1;       // Minimum intensity to detect smiling (happy)
export const THRESHOLD_JAW_OPEN = 0.1;      // Minimum intensity to detect jaw open (surprised)

// Hysteresis thresholds to prevent shaking (lower thresholds to switch away from emotion)
export const THRESHOLD_SMILING_LOW = 0.05;   // Lower threshold to switch away from happy
export const THRESHOLD_JAW_OPEN_LOW = 0.05;  // Lower threshold to switch away from surprised

/**
 * Head-nod → tempo: mean `vision.face.nod_frequency` (Hz) over {@link EMOTION_ANALYSIS_WINDOW} is converted
 * to implied BPM (hz×60) and compared to the **detected track BPM** on the deck audio element when available;
 * otherwise this fallback reference is used.
 */
export const NOD_BPM_ADAPT_REFERENCE_BPM = 120;

/** Ignore mean nod Hz at or below this (noise / idle). */
export const NOD_BPM_ADAPT_MIN_MEAN_HZ = 0.35;

/** Clamp mean nod Hz above this before BPM mapping (≈210 BPM). */
export const NOD_BPM_ADAPT_MAX_MEAN_HZ = 3.5;

/** Fixed-rate resampling when reading `CueRingBuffer.sampleWindow` (`music_adaptation/timeline/CueRingBuffer`). */
export const CUE_RING_SAMPLE_HZ = 10;

/** How long raw cue samples are retained (epoch ms timeline). */
export const CUE_RING_RETENTION_MS = 15000;
