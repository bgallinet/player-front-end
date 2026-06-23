/**
 * Resample irregular cue samples onto a uniform grid (Phase 1 timeline).
 */

import { CUE_SCHEMA_VERSION_V1 } from '../schema/cueSchema.v1';

/**
 * @typedef {import('../debug/cueTensorSnapshot').CueTensorLike} CueTensorLike
 */

/**
 * Sort samples by time ascending (mutates copy).
 * @param {{ t: number, row: Float32Array }[]} samples
 */
export function sortSamplesByTime(samples) {
    return [...samples].sort((a, b) => finiteT(a.t) - finiteT(b.t));
}

function finiteT(ts) {
    const n = typeof ts === 'number' ? ts : parseFloat(ts);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Forward-fill from sorted samples onto a uniform grid ending at `endMs`.
 *
 * @param {{ t: number, row: Float32Array }[]} samplesSorted
 * @param {readonly string[]} channelIds
 * @param {number} windowMs
 * @param {number} targetHz
 * @param {number} endMs
 * @returns {CueTensorLike}
 */
export function resampleSamplesToTensor(samplesSorted, channelIds, windowMs, targetHz, endMs) {
    const samplePeriodMs = 1000 / Math.max(1, targetHz);
    const frameCount = Math.max(1, Math.round((windowMs / 1000) * targetHz));
    const F = channelIds.length;
    const frames = new Float32Array(frameCount * F);

    let idx = 0;
    /** @type {Float32Array | null} */
    let carry = null;

    for (let i = 0; i < frameCount; i++) {
        const tGrid = endMs - (frameCount - 1 - i) * samplePeriodMs;
        while (idx < samplesSorted.length && finiteT(samplesSorted[idx].t) <= tGrid) {
            carry = samplesSorted[idx].row;
            idx += 1;
        }
        const off = i * F;
        const row = frames.subarray(off, off + F);
        if (carry && carry.length === F) {
            row.set(carry);
        } else {
            row.fill(0);
        }
    }

    return {
        schemaVersion: CUE_SCHEMA_VERSION_V1,
        samplePeriodMs,
        frames,
        channelNames: channelIds,
        endTimestampMs: endMs,
        frameCount,
    };
}
