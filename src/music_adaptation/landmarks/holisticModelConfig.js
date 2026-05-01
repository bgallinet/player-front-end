/** Mediapipe Tasks Vision asset URLs — Holistic + gesture (Thumb_Up / Thumb_Down). */

export const HOLISTIC_MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task';

export const GESTURE_MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task';

/** @param {boolean} isProduction */
export function visionTasksWasmBaseUrl(isProduction) {
    return isProduction
        ? 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
        : 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
}
