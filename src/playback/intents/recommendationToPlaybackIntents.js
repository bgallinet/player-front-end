/**
 * Builds ordered DSP playback intents from a reaction recommendation row
 * (`compileReactionRecommendation` / declarative rule merge).
 */

import { PLAYBACK_INTENT_KIND_V1, PLAYBACK_INTENT_SCHEMA_V1 } from './playbackIntentKinds.v1';

/**
 * @typedef {{
 *   schemaVersion: string,
 *   kind: string,
 *   intentId: string,
 *   priority: number,
 *   expiresAtMs?: number,
 *   confidence: number,
 *   source: string,
 *   payload: Record<string, unknown>,
 * }} PlaybackIntentV1
 */

function num(v, fallback = 0) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
}

/** Default intent `source` when the caller does not pass `meta.source`. */
export const RECOMMENDATION_TO_INTENTS_SOURCE_V0 = 'reaction_recommendation_v0';

/**
 * @param {unknown} recommendation output of compileReactionRecommendation / mergeDeclarativeRules
 * @param {{ source?: string, priority?: number, confidence?: number }} [meta]
 * @returns {PlaybackIntentV1[]}
 */
export function recommendationToPlaybackIntents(recommendation, meta = {}) {
    if (!recommendation || typeof recommendation !== 'object') return [];

    const source = meta.source ?? RECOMMENDATION_TO_INTENTS_SOURCE_V0;
    const priority = typeof meta.priority === 'number' ? meta.priority : 100;
    const confidence = typeof meta.confidence === 'number' ? meta.confidence : 1;

    const eq = recommendation.eqVector;
    const db =
        Array.isArray(eq) && eq.length === 6 ? [...eq.map((x) => num(x, 0))] : [0, 0, 0, 0, 0, 0];

    /** @type {PlaybackIntentV1[]} */
    const intents = [
        {
            schemaVersion: PLAYBACK_INTENT_SCHEMA_V1,
            kind: PLAYBACK_INTENT_KIND_V1.DSP_EQ_VECTOR,
            intentId: 'rules:baseline:dsp:eq_vector',
            priority,
            confidence,
            source,
            payload: { db },
        },
        {
            schemaVersion: PLAYBACK_INTENT_SCHEMA_V1,
            kind: PLAYBACK_INTENT_KIND_V1.DSP_VOLUME_MULTIPLIER,
            intentId: 'rules:baseline:dsp:volume_multiplier',
            priority,
            confidence,
            source,
            payload: { value: num(recommendation.volumeMultiplier, 1) },
        },
        {
            schemaVersion: PLAYBACK_INTENT_SCHEMA_V1,
            kind: PLAYBACK_INTENT_KIND_V1.DSP_RHYTHMIC_ENHANCEMENT_PERCENT,
            intentId: 'rules:baseline:dsp:rhythmic_enhancement',
            priority,
            confidence,
            source,
            payload: { percent: num(recommendation.rhythmicEnhancement, 0) },
        },
        {
            schemaVersion: PLAYBACK_INTENT_SCHEMA_V1,
            kind: PLAYBACK_INTENT_KIND_V1.DSP_REVERB_PERCENT,
            intentId: 'rules:baseline:dsp:reverb',
            priority,
            confidence,
            source,
            payload: { percent: num(recommendation.reverbAmount, 0) },
        },
        {
            schemaVersion: PLAYBACK_INTENT_SCHEMA_V1,
            kind: PLAYBACK_INTENT_KIND_V1.DSP_DELAY_PERCENT,
            intentId: 'rules:baseline:dsp:delay',
            priority,
            confidence,
            source,
            payload: { percent: num(recommendation.delayAmount, 0) },
        },
        {
            schemaVersion: PLAYBACK_INTENT_SCHEMA_V1,
            kind: PLAYBACK_INTENT_KIND_V1.DSP_KEY_SEMITONES,
            intentId: 'rules:baseline:dsp:key_semitones',
            priority,
            confidence,
            source,
            payload: { semitones: Math.round(num(recommendation.keyShiftSemitones, 0)) },
        },
        {
            schemaVersion: PLAYBACK_INTENT_SCHEMA_V1,
            kind: PLAYBACK_INTENT_KIND_V1.DSP_BPM_PERCENT_DELTA,
            intentId: 'rules:baseline:dsp:bpm_percent_delta',
            priority,
            confidence,
            source,
            payload: { percent: Math.round(num(recommendation.bpmShiftPercent, 0)) },
        },
    ];

    return intents;
}
