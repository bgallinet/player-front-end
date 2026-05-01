/**
 * Cue schema v1 — mirrors sensing signals wired today (Player ↔ UnifiedSensingUserUI /
 * face_position_data_arrays). Order defines row-major layout in {@link Float32Array} tensors.
 */

/** @typedef {'continuous01'|'frequency_hz'|'amplitude'|'pixels'|'boolean01'} CueChannelType */

/**
 * @typedef {{
 *   id: string,
 *   type: CueChannelType,
 *   source: string,
 *   defaultMissing: number,
 * }} CueChannelSpec
 */

/** Semantic version string for serialized tensors and policy configs. */
export const CUE_SCHEMA_VERSION_V1 = 'cue-schema-v1';

/** Full channel order for v1 tensors (vision block then gesture block). */
export const CUE_CHANNEL_IDS_V1 = Object.freeze([
    'vision.face.smiling',
    'vision.face.jaw_open',
    'vision.face.nod_amplitude',
    'vision.face.nod_frequency',
    'vision.face.bbox_center_x',
    'vision.face.bbox_center_y',
    'vision.face.bbox_width',
    'vision.face.bbox_height',
    'gesture.hands_raised',
    'gesture.thumb_up',
    'gesture.thumb_down',
]);

/** @type {readonly CueChannelSpec[]} */
export const CUE_CHANNELS_V1 = Object.freeze([
    { id: 'vision.face.smiling', type: 'continuous01', source: 'mediapipe_face', defaultMissing: 0 },
    { id: 'vision.face.jaw_open', type: 'continuous01', source: 'mediapipe_face', defaultMissing: 0 },
    { id: 'vision.face.nod_amplitude', type: 'amplitude', source: 'nodding_calculator', defaultMissing: 0 },
    { id: 'vision.face.nod_frequency', type: 'frequency_hz', source: 'nodding_calculator', defaultMissing: 0 },
    { id: 'vision.face.bbox_center_x', type: 'pixels', source: 'mediapipe_face', defaultMissing: 0 },
    { id: 'vision.face.bbox_center_y', type: 'pixels', source: 'mediapipe_face', defaultMissing: 0 },
    { id: 'vision.face.bbox_width', type: 'pixels', source: 'mediapipe_face', defaultMissing: 0 },
    { id: 'vision.face.bbox_height', type: 'pixels', source: 'mediapipe_face', defaultMissing: 0 },
    { id: 'gesture.hands_raised', type: 'boolean01', source: 'pose_hand_raise', defaultMissing: 0 },
    { id: 'gesture.thumb_up', type: 'boolean01', source: 'mediapipe_gesture', defaultMissing: 0 },
    { id: 'gesture.thumb_down', type: 'boolean01', source: 'mediapipe_gesture', defaultMissing: 0 },
]);

/** @type {ReadonlyMap<string, number>} */
const CHANNEL_INDEX_V1 = new Map(CUE_CHANNEL_IDS_V1.map((id, i) => [id, i]));

/**
 * @param {string} channelId
 * @returns {number} index in [0, numChannels), or -1
 */
export function getCueChannelIndexV1(channelId) {
    return CHANNEL_INDEX_V1.get(channelId) ?? -1;
}

export function getCueChannelCountV1() {
    return CUE_CHANNEL_IDS_V1.length;
}
