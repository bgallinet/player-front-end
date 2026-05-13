/**
 * Reaction analytics: full landmark series keyed by MediaPipe index
 * (POSE_0…POSE_32, HAND_LEFT_0…HAND_RIGHT_20, FACE_<idx>).
 *
 * ---------------------------------------------------------------------------
 * ARCHIVE — previous compact 5- then 8-point SQL columns (landmark_0 … landmark_7).
 * ---------------------------------------------------------------------------
 */
import {
    REACTION_LANDMARK_KEY_ORDER,
    POSE_ANALYTICS_INDICES,
    HAND_ANALYTICS_INDICES,
    FACE_ANALYTICS_INDICES,
} from './reactionAnalyticsLandmarkConfig';

function clampTriplet(x, y, z) {
    const zx = x == null || Number.isNaN(x) ? null : Number(x);
    const zy = y == null || Number.isNaN(y) ? null : Number(y);
    const zz = z == null || Number.isNaN(z) ? null : Number(z);
    if (zx == null || zy == null) return [null, null, null];
    return [zx, zy, zz == null ? 0 : zz];
}

function tripletAt(lmArray, index) {
    if (!lmArray || index >= lmArray.length) return [null, null, null];
    const p = lmArray[index];
    if (!p) return [null, null, null];
    return clampTriplet(p.x, p.y, p.z);
}

/**
 * One sample: map each analytics key → [x, y, z] (nullable components).
 * @param {unknown[]|null|undefined} faceLandmarks
 * @param {unknown[]|null|undefined} leftHandLm
 * @param {unknown[]|null|undefined} rightHandLm
 * @param {unknown[]|null|undefined} poseLandmarks
 * @returns {Record<string, [number|null, number|null, number|null]>}
 */
export function buildLandmarkSeriesSampleTriples(
    faceLandmarks,
    leftHandLm,
    rightHandLm,
    poseLandmarks,
) {
    /** @type {Record<string, [number|null, number|null, number|null]>} */
    const out = {};
    for (const i of POSE_ANALYTICS_INDICES) {
        out[`POSE_${i}`] = tripletAt(poseLandmarks, i);
    }
    for (const i of HAND_ANALYTICS_INDICES) {
        out[`HAND_LEFT_${i}`] = tripletAt(leftHandLm, i);
        out[`HAND_RIGHT_${i}`] = tripletAt(rightHandLm, i);
    }
    for (const i of FACE_ANALYTICS_INDICES) {
        out[`FACE_${i}`] = tripletAt(faceLandmarks, i);
    }
    return out;
}

/** Stable key list shared with backend / CSV (same module as config). */
export { REACTION_LANDMARK_KEY_ORDER };

/** Number of scalar channels per batch (= keys × 3 × sample_count). */
export const REACTION_LANDMARK_KEY_COUNT = REACTION_LANDMARK_KEY_ORDER.length;

/**
 * Empty per-key buffers (flat x,y,z triples appended per sample).
 * @returns {Record<string, number[]>}
 */
export function emptyLandmarkSeriesBuffers() {
    return Object.fromEntries(REACTION_LANDMARK_KEY_ORDER.map((k) => [k, []]));
}
