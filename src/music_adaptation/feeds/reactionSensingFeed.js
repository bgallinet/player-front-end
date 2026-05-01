/**
 * Canonical sensing snapshot: each frame is normalized and **`ingestSensingFeedIntoBuffer`** appends a fused
 * vision+gesture sample to the cue ring. **`compileReactionRecommendation`** does not read this object directly;
 * it uses **`CueRingBuffer.sampleWindow`** over **`EMOTION_ANALYSIS_WINDOW`** so every modality is weighted equally
 * in that window.
 */

/**
 * @typedef {object} ReactionSensingHandRaiseSide
 * @property {boolean} isRaised
 * @property {number} amplitude
 * @property {number} frequency
 */

/**
 * Rich per-frame sensing (for debugging / logging). Policy still uses the flat scalar fields above.
 *
 * @typedef {object} ReactionSensingModalitiesDetail
 * @property {{ amplitude: number, frequency: number }} nodding
 * @property {{ left: ReactionSensingHandRaiseSide, right: ReactionSensingHandRaiseSide }} handRaise
 * @property {{ left: string, right: string }} mediaPipeHandGestures
 * @property {{ smiling: number, jawOpen: number }} [faceInstant]
 * @property {object|null} [faceTimelineWindow] compact summary of merged face blob (not full landmark arrays)
 */

/**
 * @typedef {object} ReactionSensingFeedSnapshot
 * @property {import('../adapters/visionCueAdapter').EmotionDatapoint[]} emotionDataArray
 * @property {number} noddingAmplitude
 * @property {number} [noddingFrequency]
 * @property {boolean} handsRaised
 * @property {boolean} thumbUpActive
 * @property {boolean} thumbDownActive
 * @property {ReactionSensingModalitiesDetail} [modalitiesDetail]
 */

/** @param {unknown} v @param {number} fb */
function finiteNum(v, fb = 0) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : fb;
}

/** @param {unknown} raw @returns {ReactionSensingHandRaiseSide} */
function normalizeHandRaiseSide(raw) {
    if (!raw || typeof raw !== 'object') {
        return { isRaised: false, amplitude: 0, frequency: 0 };
    }
    const o = /** @type {Record<string, unknown>} */ (raw);
    return {
        isRaised: !!o.isRaised,
        amplitude: finiteNum(o.amplitude, 0),
        frequency: finiteNum(o.frequency, 0),
    };
}

/**
 * @param {unknown} raw
 * @returns {ReactionSensingModalitiesDetail | undefined}
 */
function normalizeModalitiesDetail(raw) {
    if (!raw || typeof raw !== 'object') return undefined;
    const o = /** @type {Record<string, unknown>} */ (raw);
    const hr = o.handRaise && typeof o.handRaise === 'object' ? /** @type {Record<string, unknown>} */ (o.handRaise) : {};
    const mpg =
        o.mediaPipeHandGestures && typeof o.mediaPipeHandGestures === 'object'
            ? /** @type {Record<string, unknown>} */ (o.mediaPipeHandGestures)
            : {};
    const fi = o.faceInstant && typeof o.faceInstant === 'object' ? /** @type {Record<string, unknown>} */ (o.faceInstant) : null;
    const ftw =
        o.faceTimelineWindow !== undefined && o.faceTimelineWindow !== null && typeof o.faceTimelineWindow === 'object'
            ? /** @type {Record<string, unknown>} */ (o.faceTimelineWindow)
            : o.faceTimelineWindow === null
              ? null
              : undefined;

    const nod = o.nodding && typeof o.nodding === 'object' ? /** @type {Record<string, unknown>} */ (o.nodding) : {};

    /** @type {ReactionSensingModalitiesDetail} */
    const out = {
        nodding: {
            amplitude: finiteNum(nod.amplitude, 0),
            frequency: finiteNum(nod.frequency, 0),
        },
        handRaise: {
            left: normalizeHandRaiseSide(hr.left),
            right: normalizeHandRaiseSide(hr.right),
        },
        mediaPipeHandGestures: {
            left: typeof mpg.left === 'string' ? mpg.left : 'None',
            right: typeof mpg.right === 'string' ? mpg.right : 'None',
        },
    };

    if (fi) {
        out.faceInstant = {
            smiling: finiteNum(fi.smiling, 0),
            jawOpen: finiteNum(fi.jawOpen, 0),
        };
    }
    if (ftw !== undefined) {
        if (ftw === null) {
            out.faceTimelineWindow = null;
        } else {
            out.faceTimelineWindow = {
                lastUpdated: finiteNum(ftw.lastUpdated, 0),
                landmarkCount: finiteNum(ftw.landmarkCount, 0),
                faceConfidence: finiteNum(ftw.faceConfidence, 0),
                sampleCount: finiteNum(ftw.sampleCount, 0),
                noddingFrequency: finiteNum(ftw.noddingFrequency, 0),
                noddingAmplitude: finiteNum(ftw.noddingAmplitude, 0),
                smilingIntensity: finiteNum(ftw.smilingIntensity, 0),
                jawOpenIntensity: finiteNum(ftw.jawOpenIntensity, 0),
            };
        }
    }

    return out;
}

/** @returns {ReactionSensingFeedSnapshot} */
export function emptyReactionSensingFeedSnapshot() {
    return {
        emotionDataArray: [],
        noddingAmplitude: 0,
        noddingFrequency: undefined,
        handsRaised: false,
        thumbUpActive: false,
        thumbDownActive: false,
    };
}

/**
 * @param {Partial<ReactionSensingFeedSnapshot> | null | undefined} raw
 * @returns {ReactionSensingFeedSnapshot}
 */
export function normalizeReactionSensingFeed(raw) {
    const base = emptyReactionSensingFeedSnapshot();
    if (!raw || typeof raw !== 'object') return base;

    const nod = raw.noddingAmplitude;
    const nodNum = typeof nod === 'number' && Number.isFinite(nod) ? nod : base.noddingAmplitude;

    const nf = raw.noddingFrequency;
    const nfNum =
        nf !== undefined && nf !== null && typeof nf === 'number' && Number.isFinite(nf) ? nf : base.noddingFrequency;

    const modalitiesDetail = normalizeModalitiesDetail(raw.modalitiesDetail);

    return {
        emotionDataArray: Array.isArray(raw.emotionDataArray) ? raw.emotionDataArray : base.emotionDataArray,
        noddingAmplitude: nodNum,
        noddingFrequency: nfNum,
        handsRaised: !!raw.handsRaised,
        thumbUpActive: !!raw.thumbUpActive,
        thumbDownActive: !!raw.thumbDownActive,
        ...(modalitiesDetail !== undefined ? { modalitiesDetail } : {}),
    };
}
