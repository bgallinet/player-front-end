/**
 * Vision cue adapter — maps face / nodding samples from Player emotion rows to schema v1 channels.
 * Pure functions only (no React).
 */

/**
 * One row from Player state (`emotionDataArray` elements).
 * @typedef {{
 *   timestamp: number,
 *   smiling?: number,
 *   jawOpen?: number,
 *   amplitude?: number,
 *   frequency?: number,
 *   xPosition?: number,
 *   yPosition?: number,
 *   width?: number,
 *   height?: number,
 * }} EmotionDatapoint
 */

/**
 * @param {number} v
 * @returns {number}
 */
function finiteOr(v, fallback = 0) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Builds partial channel → value map for vision channels only (gesture keys omitted).
 *
 * @param {EmotionDatapoint | null | undefined} dp
 * @param {{ noddingAmplitude?: number, noddingFrequency?: number }} [fallback]
 * @returns {Record<string, number>}
 */
export function visionCuePatchFromDatapoint(dp, fallback = {}) {
    const nodA = finiteOr(fallback.noddingAmplitude, 0);
    const nodF = finiteOr(fallback.noddingFrequency, 0);

    if (!dp || typeof dp !== 'object') {
        return {
            'vision.face.smiling': 0,
            'vision.face.jaw_open': 0,
            'vision.face.nod_amplitude': nodA,
            'vision.face.nod_frequency': nodF,
            'vision.face.bbox_center_x': 0,
            'vision.face.bbox_center_y': 0,
            'vision.face.bbox_width': 0,
            'vision.face.bbox_height': 0,
        };
    }

    return {
        'vision.face.smiling': finiteOr(dp.smiling, 0),
        'vision.face.jaw_open': finiteOr(dp.jawOpen, 0),
        'vision.face.nod_amplitude': finiteOr(dp.amplitude, nodA),
        'vision.face.nod_frequency': finiteOr(dp.frequency, nodF),
        'vision.face.bbox_center_x': finiteOr(dp.xPosition, 0),
        'vision.face.bbox_center_y': finiteOr(dp.yPosition, 0),
        'vision.face.bbox_width': finiteOr(dp.width, 0),
        'vision.face.bbox_height': finiteOr(dp.height, 0),
    };
}

/**
 * Sorted copy for temporal lookup.
 * @param {EmotionDatapoint[]} emotionDataArray
 * @returns {EmotionDatapoint[]}
 */
export function sortEmotionDatapointsByTime(emotionDataArray) {
    if (!Array.isArray(emotionDataArray) || emotionDataArray.length === 0) return [];
    return [...emotionDataArray].sort((a, b) => finiteOr(a.timestamp, 0) - finiteOr(b.timestamp, 0));
}
