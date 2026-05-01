/**
 * Ring buffer of merged cue rows on an epoch-ms timeline (Phase 1).
 */

import { CUE_CHANNEL_IDS_V1 } from '../schema/cueSchema.v1';
import { sortSamplesByTime, resampleSamplesToTensor } from './resampleTimeline';

export class CueRingBuffer {
    /**
     * @param {{ retentionMs?: number, channelIds?: readonly string[] }} [opts]
     */
    constructor(opts = {}) {
        this.retentionMs = opts.retentionMs ?? 15000;
        this.channelIds = Object.freeze([...(opts.channelIds ?? CUE_CHANNEL_IDS_V1)]);
        this.F = this.channelIds.length;
        /** @type {{ t: number, row: Float32Array }[]} */
        this.samples = [];
        /** @type {Float32Array | null} */
        this.lastRow = null;
    }

    /**
     * Merge partial channel values into the running row and append one sample at `tEpochMs`.
     *
     * @param {Record<string, number>} partialRecord keys are channel ids from schema v1
     * @param {number} [tEpochMs]
     */
    pushPartialUpdate(partialRecord, tEpochMs = Date.now()) {
        const row = new Float32Array(this.F);
        if (this.lastRow) {
            row.set(this.lastRow);
        }

        for (let i = 0; i < this.channelIds.length; i++) {
            const id = this.channelIds[i];
            if (Object.prototype.hasOwnProperty.call(partialRecord, id)) {
                const v = partialRecord[id];
                row[i] = typeof v === 'number' && Number.isFinite(v) ? v : 0;
            }
        }

        this.lastRow = row.slice();
        this.samples.push({ t: tEpochMs, row: this.lastRow.slice() });
        this.pruneOlderThan(tEpochMs - this.retentionMs);
    }

    /** @param {number} cutoffEpochMs exclusive removal below this time */
    pruneOlderThan(cutoffEpochMs) {
        while (this.samples.length > 0 && this.samples[0].t < cutoffEpochMs) {
            this.samples.shift();
        }
    }

    /**
     * Uniform grid view over `(endMs - windowMs, endMs]` at `targetHz`.
     *
     * @param {number} windowMs
     * @param {number} targetHz
     * @param {number} [endMs]
     */
    sampleWindow(windowMs, targetHz, endMs = Date.now()) {
        const sorted = sortSamplesByTime(this.samples);
        return resampleSamplesToTensor(sorted, this.channelIds, windowMs, targetHz, endMs);
    }

    clear() {
        this.samples = [];
        this.lastRow = null;
    }
}
