import {
    buildLandmarkSeriesSampleTriples,
    emptyLandmarkSeriesBuffers,
    REACTION_LANDMARK_KEY_ORDER,
} from './reactionAnalyticsLandmarks';
import { sendReactionAnalyticsBatch } from './sendReactionAnalyticsBatch';

/** Target ingest rate for reaction analytics batches (Hz). */
const REACTION_SAMPLE_HZ = 4;
/** Wall-clock spacing between stored samples (ms). */
const REACTION_SAMPLE_INTERVAL_MS = Math.round(1000 / REACTION_SAMPLE_HZ);
/** Flush one DB row at this interval (ms). */
const REACTION_FLUSH_INTERVAL_MS = 10_000;

/** Landmarks only: three decimal places for payload size (smiling/jaw unchanged). */
function roundLandmarkCoord(value) {
    if (value == null || Number.isNaN(value)) return null;
    return Math.round(Number(value) * 1000) / 1000;
}

/**
 * Buffers smiling, jaw_open, and per–MediaPipe-index landmark triples; flushes on interval or stop.
 */
export function createReactionAnalyticsBatcher({ sessionName }) {
    const smiling = [];
    const jawOpen = [];
    /** Per-sample wall time (epoch ms); only sent for analytics / landmark CSV stitching. */
    const sampleTimestampsMs = [];
    /** @type {Record<string, number[]>} */
    const landmarkSeries = emptyLandmarkSeriesBuffers();

    let batchStartUnixMs = null;
    let lastSampleWallMs = 0;
    let flushTimerId = null;

    const clearBuffers = () => {
        smiling.length = 0;
        jawOpen.length = 0;
        sampleTimestampsMs.length = 0;
        for (const k of REACTION_LANDMARK_KEY_ORDER) {
            landmarkSeries[k].length = 0;
        }
        batchStartUnixMs = null;
    };

    const buildLandmarkSeriesPayload = () => {
        const n = smiling.length;
        const expected = n * 3;
        /** @type {Record<string, number[]>} */
        const out = {};
        for (const k of REACTION_LANDMARK_KEY_ORDER) {
            const slot = landmarkSeries[k];
            if (slot.length !== expected) {
                return null;
            }
            out[k] = [...slot];
        }
        return out;
    };

    const flush = async () => {
        if (smiling.length === 0) return;
        const landmark_series = buildLandmarkSeriesPayload();
        if (!landmark_series) {
            console.warn('[reaction_analytics] landmark_series length mismatch, dropping batch');
            clearBuffers();
            return;
        }
        if (sampleTimestampsMs.length !== smiling.length) {
            console.warn('[reaction_analytics] sample_timestamps_ms length mismatch, dropping batch');
            clearBuffers();
            return;
        }

        const unixTime =
            batchStartUnixMs != null
                ? Math.floor(batchStartUnixMs / 1000)
                : Math.floor(Date.now() / 1000);

        const payload = {
            session_name: sessionName || 'default',
            unixTime,
            sample_rate_hz: REACTION_SAMPLE_HZ,
            sample_count: smiling.length,
            smiling: [...smiling],
            jaw_open: [...jawOpen],
            landmark_series,
            sample_timestamps_ms: [...sampleTimestampsMs],
        };

        clearBuffers();
        await sendReactionAnalyticsBatch(payload);
    };

    /**
     * @param {object} p
     * @param {number} p.nowMs
     * @param {{smiling:number,jawOpen:number}} p.faceReactions
     * @param {unknown[]|null} p.faceLandmarks
     * @param {unknown|null} p.leftHandLm
     * @param {unknown|null} p.rightHandLm
     * @param {unknown[]|null} [p.poseLandmarks] — Holistic pose (33), optional
     */
    const tryPushSample = ({
        nowMs,
        faceReactions,
        faceLandmarks,
        leftHandLm,
        rightHandLm,
        poseLandmarks = null,
    }) => {
        if (!faceLandmarks || faceLandmarks.length === 0) return;
        if (nowMs - lastSampleWallMs < REACTION_SAMPLE_INTERVAL_MS) return;
        lastSampleWallMs = nowMs;

        if (batchStartUnixMs == null) {
            batchStartUnixMs = nowMs;
        }

        smiling.push(faceReactions?.smiling ?? 0);
        jawOpen.push(faceReactions?.jawOpen ?? 0);
        sampleTimestampsMs.push(Math.round(nowMs));

        const triples = buildLandmarkSeriesSampleTriples(
            faceLandmarks,
            leftHandLm,
            rightHandLm,
            poseLandmarks,
        );
        for (const k of REACTION_LANDMARK_KEY_ORDER) {
            const [x, y, z] = triples[k];
            landmarkSeries[k].push(
                roundLandmarkCoord(x),
                roundLandmarkCoord(y),
                roundLandmarkCoord(z),
            );
        }
    };

    const start = () => {
        if (flushTimerId != null) return;
        lastSampleWallMs = 0;
        clearBuffers();
        flushTimerId = window.setInterval(() => {
            void flush();
        }, REACTION_FLUSH_INTERVAL_MS);
    };

    const stop = async () => {
        if (flushTimerId != null) {
            window.clearInterval(flushTimerId);
            flushTimerId = null;
        }
        await flush();
        lastSampleWallMs = 0;
    };

    return { tryPushSample, start, stop, flush };
}
