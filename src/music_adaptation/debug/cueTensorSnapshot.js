/**
 * Builds {@link CueTensor}-shaped snapshots from current Player-linked state (Phase 0).
 * Historical vision samples use forward-fill from sorted emotion datapoints per grid time.
 */

import {
    CUE_SCHEMA_VERSION_V1,
    CUE_CHANNEL_IDS_V1,
    getCueChannelCountV1,
} from '../schema/cueSchema.v1';
import { gestureCuePatchFromFlags } from '../adapters/gestureCueAdapter';
import { sortEmotionDatapointsByTime, visionCuePatchFromDatapoint } from '../adapters/visionCueAdapter';

/**
 * @typedef {object} CueTensorLike
 * @property {string} schemaVersion
 * @property {number} samplePeriodMs
 * @property {Float32Array} frames
 * @property {readonly string[]} channelNames
 * @property {number} endTimestampMs Epoch ms when snapshot ends (aligned with emotion timestamps).
 * @property {number} frameCount
 */

/**
 * @param {Record<string, number>} patch
 * @param {Float32Array} out row length F, writes vision indices only if patch omits gesture keys — caller merges gesture separately
 */
function writePatchIntoRow(patch, channelIds, out) {
    for (let i = 0; i < channelIds.length; i++) {
        const id = channelIds[i];
        const v = patch[id];
        out[i] = typeof v === 'number' && Number.isFinite(v) ? v : 0;
    }
}

/**
 * @param {{
 *   emotionDataArray?: import('../adapters/visionCueAdapter').EmotionDatapoint[],
 *   noddingAmplitude?: number,
 *   noddingFrequency?: number,
 *   handsRaised?: boolean,
 *   thumbUpActive?: boolean,
 *   thumbDownActive?: boolean,
 *   windowMs?: number,
 *   targetHz?: number,
 *   nowMs?: number,
 * }} opts
 * @returns {CueTensorLike}
 */
export function buildCueTensorSnapshot(opts = {}) {
    const windowMs = opts.windowMs ?? 1000;
    const targetHz = opts.targetHz ?? 10;
    const nowMs = typeof opts.nowMs === 'number' ? opts.nowMs : Date.now();

    const samplePeriodMs = 1000 / Math.max(1, targetHz);
    const frameCount = Math.max(1, Math.round((windowMs / 1000) * targetHz));

    const F = getCueChannelCountV1();
    const frames = new Float32Array(frameCount * F);

    const sorted = sortEmotionDatapointsByTime(opts.emotionDataArray ?? []);

    const gesturePatch = gestureCuePatchFromFlags({
        handsRaised: opts.handsRaised,
        thumbUpActive: opts.thumbUpActive,
        thumbDownActive: opts.thumbDownActive,
    });

    const nodFall = {
        noddingAmplitude: opts.noddingAmplitude,
        noddingFrequency: opts.noddingFrequency,
    };

    let idx = 0;
    /** @type {import('../adapters/visionCueAdapter').EmotionDatapoint | null} */
    let carry = null;

    for (let i = 0; i < frameCount; i++) {
        const tGrid = nowMs - (frameCount - 1 - i) * samplePeriodMs;

        while (idx < sorted.length && finiteTs(sorted[idx].timestamp) <= tGrid) {
            carry = sorted[idx];
            idx += 1;
        }

        const visionPatch = visionCuePatchFromDatapoint(carry, nodFall);
        const rowOffset = i * F;
        const row = frames.subarray(rowOffset, rowOffset + F);
        writePatchIntoRow({ ...visionPatch, ...gesturePatch }, [...CUE_CHANNEL_IDS_V1], row);
    }

    return {
        schemaVersion: CUE_SCHEMA_VERSION_V1,
        samplePeriodMs,
        frames,
        channelNames: CUE_CHANNEL_IDS_V1,
        endTimestampMs: nowMs,
        frameCount,
    };
}

/**
 * @param {unknown} ts
 */
function finiteTs(ts) {
    const n = typeof ts === 'number' ? ts : parseFloat(ts);
    return Number.isFinite(n) ? n : 0;
}

/** Last snapshot for export / debugger attachment (updated when debug emit runs). */
let lastSnapshotRef = /** @type {CueTensorLike | null} */ (null);

export function getLastCueTensorSnapshotForDebug() {
    return lastSnapshotRef;
}

/**
 * Rate-limited debug logging + stores {@link getLastCueTensorSnapshotForDebug}.
 * Call only when {@link import('./sensingDebugFlag').isSensingDebugEnabled}.
 *
 * @param {object} opts — same fields as {@link buildCueTensorSnapshot}
 * @param {{ label?: string }} [meta]
 */
export function emitCueTensorDebugSnapshot(opts, meta = {}) {
    const tensor = buildCueTensorSnapshot(opts);
    lastSnapshotRef = tensor;

    const F = getCueChannelCountV1();
    const previewFrames = [];
    for (let i = 0; i < tensor.frameCount; i++) {
        const off = i * F;
        previewFrames.push(Array.from(tensor.frames.subarray(off, off + F)));
    }

    // eslint-disable-next-line no-console
    console.debug('[sensing]', meta.label ?? 'CueTensor', {
        schemaVersion: tensor.schemaVersion,
        samplePeriodMs: tensor.samplePeriodMs,
        endTimestampMs: tensor.endTimestampMs,
        channelNames: [...tensor.channelNames],
        framesRowMajor: previewFrames,
    });

    return tensor;
}
