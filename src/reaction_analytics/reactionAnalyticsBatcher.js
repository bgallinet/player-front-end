import { buildFiveLandmarkTriplets } from './landmarkFivePoints';
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
function emptyLandmarkSlotArrays() {
    return [[], [], [], [], []];
}

/**
 * Buffers smiling, jaw_open, and five landmark XYZ series; flushes on interval or stop.
 */
export function createReactionAnalyticsBatcher({ sessionName }) {
    const smiling = [];
    const jawOpen = [];
    const landmarkSlots = emptyLandmarkSlotArrays();

    let batchStartUnixMs = null;
    let lastSampleWallMs = 0;
    let flushTimerId = null;

    const clearBuffers = () => {
        smiling.length = 0;
        jawOpen.length = 0;
        for (let i = 0; i < 5; i += 1) landmarkSlots[i].length = 0;
        batchStartUnixMs = null;
    };

    const buildLandmarkVectors = () => {
        const n = smiling.length;
        const expected = n * 3;
        const out = [];
        for (let i = 0; i < 5; i += 1) {
            const slot = landmarkSlots[i];
            if (slot.length !== expected) {
                return null;
            }
            out.push([...slot]);
        }
        return out;
    };

    const flush = async () => {
        if (smiling.length === 0) return;
        const landmark_vectors = buildLandmarkVectors();
        if (!landmark_vectors) {
            console.warn('[reaction_analytics] landmark length mismatch, dropping batch');
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
            landmark_vectors,
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
     */
    const tryPushSample = ({ nowMs, faceReactions, faceLandmarks, leftHandLm, rightHandLm }) => {
        if (!faceLandmarks || faceLandmarks.length === 0) return;
        if (nowMs - lastSampleWallMs < REACTION_SAMPLE_INTERVAL_MS) return;
        lastSampleWallMs = nowMs;

        if (batchStartUnixMs == null) {
            batchStartUnixMs = nowMs;
        }

        smiling.push(faceReactions?.smiling ?? 0);
        jawOpen.push(faceReactions?.jawOpen ?? 0);

        const triples = buildFiveLandmarkTriplets(faceLandmarks, leftHandLm, rightHandLm);
        for (let i = 0; i < 5; i += 1) {
            const [x, y, z] = triples[i];
            landmarkSlots[i].push(roundLandmarkCoord(x), roundLandmarkCoord(y), roundLandmarkCoord(z));
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
