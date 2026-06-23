/**
 * Canonical landmark keys for reaction analytics / CSV export and lightweight face overlay.
 * `FACE_ANALYTICS_INDICES` = **every vertex** on the drawn face: oval, eyes, nose, brows, and **mouth**
 * (`MOUTH_OUTER` / `MOUTH_INNER` follow `FACEMESH_LIPS` polylines), plus every second entry in the sorted
 * union of those indices (legacy sparsity for any stragglers).
 * `RIGHT_EYEBROW` omits MediaPipe **336** (ridge spike).
 * Archived full mesh: `components/sensing_UI/LandmarkDrawing.full.archive.jsx`.
 */

/** @type {readonly number[]} — same as archived LandmarkDrawing */
export const FACE_LANDMARKS_FACE_OVAL = Object.freeze([
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
    176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]);

export const LEFT_EYE = Object.freeze([
    33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33,
]);

export const RIGHT_EYE = Object.freeze([
    362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382, 362,
]);

export const LEFT_EYEBROW = Object.freeze([70, 63, 105, 66, 107, 55, 65, 52, 53, 46]);

/** Lower contour only — skip 336 (upper ridge) so the overlay matches a single smooth brow stroke. */
export const RIGHT_EYEBROW = Object.freeze([276, 283, 282, 295, 285, 296, 334, 293, 300]);

export const NOSE_TIP = Object.freeze([1, 2, 5, 4, 6]);

/** Closed outer lip — lower arc 61→291 then upper arc 291→61 (MediaPipe `FACEMESH_LIPS`). */
export const MOUTH_OUTER = Object.freeze([
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185,
]);

/** Closed inner / lower lip rim along mesh edges (no 415→78 chord). */
export const MOUTH_INNER = Object.freeze([
    78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
]);

export const NOSE_BRIDGE = Object.freeze([168, 8, 9, 10, 151]);
export const NOSE_EXTRA_POINTS = Object.freeze([19, 20, 94, 125]);

function sortedUniqueFaceDrawIndices() {
    const s = new Set();
    const pushAll = (arr) => {
        for (const i of arr) s.add(i);
    };
    pushAll(FACE_LANDMARKS_FACE_OVAL);
    pushAll(LEFT_EYE);
    pushAll(RIGHT_EYE);
    pushAll(LEFT_EYEBROW);
    pushAll(RIGHT_EYEBROW);
    pushAll(NOSE_TIP);
    pushAll(MOUTH_OUTER);
    pushAll(MOUTH_INNER);
    pushAll(NOSE_BRIDGE);
    pushAll(NOSE_EXTRA_POINTS);
    return [...s].sort((a, b) => a - b);
}

const _everySecondInSortedUnion = sortedUniqueFaceDrawIndices().filter((_, i) => i % 2 === 0);

const _fullFaceDrawingVertices = new Set([
    ...FACE_LANDMARKS_FACE_OVAL,
    ...LEFT_EYE,
    ...RIGHT_EYE,
    ...NOSE_TIP,
    ...NOSE_BRIDGE,
    ...NOSE_EXTRA_POINTS,
    ...LEFT_EYEBROW,
    ...RIGHT_EYEBROW,
    ...MOUTH_OUTER,
    ...MOUTH_INNER,
]);

/**
 * All drawn face vertices ∪ every second index in sorted union (same formula as before).
 * @type {readonly number[]}
 */
export const FACE_ANALYTICS_INDICES = Object.freeze(
    [...new Set([..._fullFaceDrawingVertices, ..._everySecondInSortedUnion])].sort((a, b) => a - b),
);

const _mouthAll = new Set([...MOUTH_OUTER, ...MOUTH_INNER]);
const _ovalAll = new Set(FACE_LANDMARKS_FACE_OVAL);

/** Mouth mesh indices that appear in `FACE_ANALYTICS_INDICES` (for status tint). */
export const FACE_MOUTH_ANALYTICS_SET = new Set(
    FACE_ANALYTICS_INDICES.filter((i) => _mouthAll.has(i)),
);

/** Face-oval indices that appear in `FACE_ANALYTICS_INDICES` (for nodding tint). */
export const FACE_OVAL_ANALYTICS_SET = new Set(
    FACE_ANALYTICS_INDICES.filter((i) => _ovalAll.has(i)),
);

/** Holistic pose: full 33-point topology (same as BodyPoseDrawing). */
export const POSE_ANALYTICS_INDICES = Object.freeze(Array.from({ length: 33 }, (_, i) => i));

/** MediaPipe hand topology (HandDrawing uses 0–20). */
export const HAND_ANALYTICS_INDICES = Object.freeze(Array.from({ length: 21 }, (_, i) => i));

/**
 * Stable key order for batch buffers and CSV columns: POSE_*, HAND_LEFT_*, HAND_RIGHT_*, FACE_*.
 * @type {readonly string[]}
 */
export const REACTION_LANDMARK_KEY_ORDER = Object.freeze([
    ...POSE_ANALYTICS_INDICES.map((i) => `POSE_${i}`),
    ...HAND_ANALYTICS_INDICES.map((i) => `HAND_LEFT_${i}`),
    ...HAND_ANALYTICS_INDICES.map((i) => `HAND_RIGHT_${i}`),
    ...FACE_ANALYTICS_INDICES.map((i) => `FACE_${i}`),
]);
