/**
 * BPM/Key shift via HTMLMediaElement playbackRate, with pitch changing together (vinyl style).
 */

export const BPM_KEY_SHIFT_PERCENT_MIN = -50;
export const BPM_KEY_SHIFT_PERCENT_MAX = 50;

/**
 * @param {unknown} value
 * @returns {number|null}
 */
export const clampBpmKeyShiftPercent = (value) => {
    const bpmPercent = typeof value === 'string' ? parseInt(value, 10) : Number(value);
    if (!Number.isFinite(bpmPercent)) {
        return null;
    }
    return Math.max(BPM_KEY_SHIFT_PERCENT_MIN, Math.min(BPM_KEY_SHIFT_PERCENT_MAX, bpmPercent));
};

/**
 * @param {HTMLMediaElement|null|undefined} media
 * @param {number} bpmPercent
 */
export const applyBpmKeyShift = (media, bpmPercent) => {
    if (!media) return;

    // Vinyl-style behavior: pitch follows tempo.
    media.preservesPitch = false;
    media.mozPreservesPitch = false;
    media.webkitPreservesPitch = false;
    media.playbackRate = 1 + bpmPercent / 100;
};

export const resetBpmKeyShift = (media) => {
    if (!media) return;
    media.preservesPitch = true;
    media.mozPreservesPitch = true;
    media.webkitPreservesPitch = true;
    media.playbackRate = 1;
};

