/**
 * Key (pitch) shift — Web Audio node via soundbank-pitch-shift.
 * Independent of tempo (BPM is handled in bpmShift.js).
 */

import createPitchShift from 'soundbank-pitch-shift';

export const KEY_SHIFT_SEMITONE_MIN = -12;
export const KEY_SHIFT_SEMITONE_MAX = 12;

/**
 * @param {unknown} value - Raw slider / external input
 * @returns {number|null} Clamped semitones, or null if value is not a finite number
 */
export const clampKeyShiftSemitones = (value) => {
    const semitones = typeof value === 'string' ? parseInt(value, 10) : Number(value);
    if (!Number.isFinite(semitones)) {
        return null;
    }
    return Math.max(KEY_SHIFT_SEMITONE_MIN, Math.min(KEY_SHIFT_SEMITONE_MAX, semitones));
};

/**
 * @param {AudioContext} audioContext
 * @returns {AudioNode|null}
 */
export const createKeyShiftProcessor = (audioContext) => {
    if (!audioContext) {
        return null;
    }
    try {
        const node = createPitchShift(audioContext);
        if (node) {
            // 0 semitones: dry-only bypass. The Jungle path always colors audio; wet must be off when not shifting.
            node.wet.value = 0;
            node.dry.value = 1;
            node.transpose = 0;
        }
        return node;
    } catch {
        return null;
    }
};

/**
 * @param {AudioNode|null|undefined} processor
 * @param {number} semitones - Clamped semitones (use clampKeyShiftSemitones first if needed)
 */
export const processKeyShift = (processor, semitones) => {
    if (!processor) return;
    if (semitones === 0) {
        processor.wet.value = 0;
        processor.dry.value = 1;
        processor.transpose = 0;
    } else {
        processor.dry.value = 0;
        processor.wet.value = 1;
        processor.transpose = semitones;
    }
};

export const resetKeyShift = (processor) => {
    processKeyShift(processor, 0);
};
