/**
 * BPM / tempo shift via HTMLMediaElement playback rate, with pitch preserved.
 */

export const BPM_SHIFT_PERCENT_MIN = -50;
export const BPM_SHIFT_PERCENT_MAX = 50;

/**
 * @param {unknown} value - Raw slider / external input
 * @returns {number|null} Clamped percent, or null if value is not a finite number
 */
export const clampBpmShiftPercent = (value) => {
    const bpmPercent = typeof value === 'string' ? parseInt(value, 10) : Number(value);
    if (!Number.isFinite(bpmPercent)) {
        return null;
    }
    return Math.max(BPM_SHIFT_PERCENT_MIN, Math.min(BPM_SHIFT_PERCENT_MAX, bpmPercent));
};

/**
 * @param {HTMLMediaElement|null|undefined} media
 * @param {number} bpmPercent - Clamped percent (−50 … +50); use clampBpmShiftPercent if needed
 */
export const applyBpmShift = (media, bpmPercent) => {
    if (!media) return;

    media.preservesPitch = true;
    media.mozPreservesPitch = true;
    media.webkitPreservesPitch = true;
    media.playbackRate = 1 + bpmPercent / 100;
};

export const resetBpmShift = (media) => {
    if (!media) return;
    media.preservesPitch = true;
    media.mozPreservesPitch = true;
    media.webkitPreservesPitch = true;
    media.playbackRate = 1;
};
