/**
 * Map Holistic face + hand landmarks to five 3D points (normalized MediaPipe space).
 * Order: nose tip, left eye center, right eye center, left wrist, right wrist.
 *
 * Iris centers use indices 468 / 473 on the 478-landmark topology when available;
 * otherwise fall back to contour points on smaller meshes.
 */
const IDX_NOSE_TIP = 1;
const IDX_LEFT_IRIS = 468;
const IDX_RIGHT_IRIS = 473;
const IDX_LEFT_EYE_FALLBACK = 159;
const IDX_RIGHT_EYE_FALLBACK = 386;
const IDX_HAND_WRIST = 0;

function clampTriplet(x, y, z) {
    const zx = x == null || Number.isNaN(x) ? null : Number(x);
    const zy = y == null || Number.isNaN(y) ? null : Number(y);
    const zz = z == null || Number.isNaN(z) ? null : Number(z);
    if (zx == null || zy == null) return [null, null, null];
    return [zx, zy, zz == null ? 0 : zz];
}

function faceTriplet(faceLandmarks, index) {
    if (!faceLandmarks || index >= faceLandmarks.length) return [null, null, null];
    const p = faceLandmarks[index];
    if (!p) return [null, null, null];
    return clampTriplet(p.x, p.y, p.z);
}

function leftEyeIndex(faceLandmarks) {
    if (faceLandmarks && faceLandmarks.length > IDX_LEFT_IRIS) return IDX_LEFT_IRIS;
    return IDX_LEFT_EYE_FALLBACK;
}

function rightEyeIndex(faceLandmarks) {
    if (faceLandmarks && faceLandmarks.length > IDX_RIGHT_IRIS) return IDX_RIGHT_IRIS;
    return IDX_RIGHT_EYE_FALLBACK;
}

function handTriplet(handLandmarks) {
    if (!handLandmarks || !handLandmarks[IDX_HAND_WRIST]) return [null, null, null];
    const p = handLandmarks[IDX_HAND_WRIST];
    return clampTriplet(p.x, p.y, p.z);
}

/**
 * @param {Array<{x:number,y:number,z?:number}>|null|undefined} faceLandmarks
 * @param {Array<{x:number,y:number,z?:number}>|null|undefined} leftHandLm
 * @param {Array<{x:number,y:number,z?:number}>|null|undefined} rightHandLm
 * @returns {[[number|null,number|null,number|null], ...]} five triplets
 */
export function buildFiveLandmarkTriplets(faceLandmarks, leftHandLm, rightHandLm) {
    const le = leftEyeIndex(faceLandmarks);
    const re = rightEyeIndex(faceLandmarks);
    return [
        faceTriplet(faceLandmarks, IDX_NOSE_TIP),
        faceTriplet(faceLandmarks, le),
        faceTriplet(faceLandmarks, re),
        handTriplet(leftHandLm),
        handTriplet(rightHandLm),
    ];
}
