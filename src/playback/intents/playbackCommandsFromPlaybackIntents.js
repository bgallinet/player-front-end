/**
 * Compiles ordered PlaybackIntent[] → playback commands v1 (stable kinds for Web Audio routing).
 */

import { PLAYBACK_COMMAND_KIND_V1, PLAYBACK_COMMAND_SCHEMA_V1 } from '../commands/playbackCommandKinds.v1';
import { PLAYBACK_INTENT_KIND_V1 } from './playbackIntentKinds.v1';

/** @typedef {import('../commands/playbackCommandV1').PlaybackCommandV1} PlaybackCommandV1 */

function num(v, fallback = 0) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {import('./recommendationToPlaybackIntents').PlaybackIntentV1[]} intents
 * @returns {PlaybackCommandV1[]}
 */
export function playbackCommandsFromPlaybackIntents(intents) {
    if (!intents?.length) return [];

    /** @type {PlaybackCommandV1[]} */
    const out = [];

    for (const intent of intents) {
        const pl = intent?.payload && typeof intent.payload === 'object' ? intent.payload : {};
        switch (intent?.kind) {
            case PLAYBACK_INTENT_KIND_V1.DSP_EQ_VECTOR: {
                const db = Array.isArray(pl.db) && pl.db.length === 6 ? pl.db.map((x) => num(x, 0)) : [0, 0, 0, 0, 0, 0];
                out.push({
                    schemaVersion: PLAYBACK_COMMAND_SCHEMA_V1,
                    kind: PLAYBACK_COMMAND_KIND_V1.EQ_VECTOR,
                    payload: { db },
                });
                break;
            }
            case PLAYBACK_INTENT_KIND_V1.DSP_VOLUME_MULTIPLIER:
                out.push({
                    schemaVersion: PLAYBACK_COMMAND_SCHEMA_V1,
                    kind: PLAYBACK_COMMAND_KIND_V1.VOLUME_MULTIPLIER,
                    payload: { value: num(pl.value, 1) },
                });
                break;
            case PLAYBACK_INTENT_KIND_V1.DSP_RHYTHMIC_ENHANCEMENT_PERCENT:
                out.push({
                    schemaVersion: PLAYBACK_COMMAND_SCHEMA_V1,
                    kind: PLAYBACK_COMMAND_KIND_V1.RHYTHMIC_ENHANCEMENT_PERCENT,
                    payload: { percent: num(pl.percent, 0) },
                });
                break;
            case PLAYBACK_INTENT_KIND_V1.DSP_REVERB_PERCENT:
                out.push({
                    schemaVersion: PLAYBACK_COMMAND_SCHEMA_V1,
                    kind: PLAYBACK_COMMAND_KIND_V1.REVERB_PERCENT,
                    payload: { percent: num(pl.percent, 0) },
                });
                break;
            case PLAYBACK_INTENT_KIND_V1.DSP_DELAY_PERCENT:
                out.push({
                    schemaVersion: PLAYBACK_COMMAND_SCHEMA_V1,
                    kind: PLAYBACK_COMMAND_KIND_V1.DELAY_PERCENT,
                    payload: { percent: num(pl.percent, 0) },
                });
                break;
            case PLAYBACK_INTENT_KIND_V1.DSP_KEY_SEMITONES:
                out.push({
                    schemaVersion: PLAYBACK_COMMAND_SCHEMA_V1,
                    kind: PLAYBACK_COMMAND_KIND_V1.KEY_SEMITONES,
                    payload: { semitones: Math.round(num(pl.semitones, 0)) },
                });
                break;
            case PLAYBACK_INTENT_KIND_V1.DSP_BPM_PERCENT_DELTA:
                out.push({
                    schemaVersion: PLAYBACK_COMMAND_SCHEMA_V1,
                    kind: PLAYBACK_COMMAND_KIND_V1.BPM_PERCENT_DELTA,
                    payload: { percent: Math.round(num(pl.percent, 0)) },
                });
                break;
            default:
                break;
        }
    }

    return out;
}
