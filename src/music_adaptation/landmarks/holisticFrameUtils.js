/**
 * Pure helpers for MediaPipe holistic face / gesture parsing and face timeline samples.
 */

/** Min score to accept a canned gesture (Thumb_Up / Thumb_Down). */
export const MIN_HOLISTIC_GESTURE_SCORE = 0.55;

/** @param {{ score?: number, categoryName?: string }|null|undefined} category */
export function gestureLabelFromCategory(category) {
    if (!category || category.score < MIN_HOLISTIC_GESTURE_SCORE) return 'None';
    const n = category.categoryName;
    if (n === 'Thumb_Up' || n === 'Thumb_Down') return n;
    return 'None';
}

/**
 * @param {object|null|undefined} gestureResult MediaPipe GestureRecognizerResult
 */
export function readLeftRightGestures(gestureResult) {
    let left = 'None';
    let right = 'None';
    const n = gestureResult?.gestures?.length ?? 0;
    for (let i = 0; i < n; i++) {
        const side = gestureResult.handedness?.[i]?.[0]?.categoryName;
        const label = gestureLabelFromCategory(gestureResult.gestures[i]?.[0]);
        if (side === 'Left') left = label;
        else if (side === 'Right') right = label;
    }
    return { left, right };
}

/**
 * @param {Array<{ x: number, y: number }>|null|undefined} landmarks normalized
 * @param {number} videoWidth
 * @param {number} videoHeight
 */
export function computeFaceBoundingBox(landmarks, videoWidth, videoHeight) {
    if (!landmarks || landmarks.length === 0) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    landmarks.forEach((landmark) => {
        if (landmark.x < minX) minX = landmark.x;
        if (landmark.x > maxX) maxX = landmark.x;
        if (landmark.y < minY) minY = landmark.y;
        if (landmark.y > maxY) maxY = landmark.y;
    });
    const left = Math.round(minX * videoWidth);
    const top = Math.round(minY * videoHeight);
    const width = Math.round((maxX - minX) * videoWidth);
    const height = Math.round((maxY - minY) * videoHeight);
    const centerX = Math.round(left + width / 2);
    const centerY = Math.round(top + height / 2);
    return {
        left,
        top,
        width,
        height,
        position: { centerX, centerY, top, left },
    };
}

/** @param {Array<{ categoryName?: string, score?: number }>|null|undefined} blendshapes */
export function extractFaceReactions(blendshapes) {
    if (!blendshapes || blendshapes.length === 0) {
        return { smiling: 0, jawOpen: 0 };
    }
    const getScore = (name) => {
        const b = blendshapes.find((x) => x.categoryName === name);
        return b ? b.score : 0;
    };
    const smileLeft = getScore('mouthSmileLeft');
    const smileRight = getScore('mouthSmileRight');
    const smilingIntensity = (smileLeft + smileRight) / 2;
    const jawOpenIntensity = getScore('jawOpen');
    return {
        smiling: Math.round(smilingIntensity * 1000) / 1000,
        jawOpen: Math.round(jawOpenIntensity * 1000) / 1000,
    };
}

/**
 * One face frame for the timeline buffer + reaction policy.
 * @param {unknown[]} faceLandmarks holistic face mesh
 * @param {Array<{ categoryName?: string, score?: number }>|null|undefined} categories blendshapes row
 * @param {number} videoWidth
 * @param {number} videoHeight
 */
export function buildFaceLandmarkSample(faceLandmarks, categories, videoWidth, videoHeight) {
    const faceReactions = extractFaceReactions(categories || []);
    const faceBox = computeFaceBoundingBox(faceLandmarks, videoWidth, videoHeight);
    const confidence = 0.8;
    const landmarkData = {
        timestamp: Date.now(),
        landmarks: faceLandmarks.map((landmark, index) => ({
            index,
            x: parseFloat(landmark.x.toFixed(3)),
            y: parseFloat(landmark.y.toFixed(3)),
            z: parseFloat((landmark.z || 0).toFixed(3)),
        })),
        confidence,
        facePosition: faceBox,
    };
    return { landmarkData, faceReactions, faceBox, confidence };
}

/**
 * @param {unknown[]} poseLandmarks single pose instance
 * @param {boolean} hasPoseWorld whether pose world landmarks were present
 */
export function buildPoseLandmarkSample(poseLandmarks, hasPoseWorld) {
    const confidence = hasPoseWorld ? 0.8 : 0.6;
    return {
        timestamp: Date.now(),
        landmarks: poseLandmarks.map((landmark, index) => ({
            index,
            x: landmark.x,
            y: landmark.y,
            z: landmark.z || 0,
            visibility: landmark.visibility || 1.0,
        })),
        confidence,
    };
}
