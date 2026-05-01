/**
 * Playback command kinds — parallel idea to cue channel IDs: stable strings for routing / ML / logs.
 * Version suffix allows future breaking payloads without ambiguity.
 */

export const PLAYBACK_COMMAND_SCHEMA_V1 = 'playback-commands-v1';

/** @readonly */
export const PLAYBACK_COMMAND_KIND_V1 = Object.freeze({
    EQ_VECTOR: 'playback.v1.eq.vector',
    VOLUME_MULTIPLIER: 'playback.v1.volume.multiplier',
    RHYTHMIC_ENHANCEMENT_PERCENT: 'playback.v1.rhythm.enhancement_percent',
    REVERB_PERCENT: 'playback.v1.reverb.percent',
    DELAY_PERCENT: 'playback.v1.delay.percent',
    KEY_SEMITONES: 'playback.v1.key.semitones',
    BPM_PERCENT_DELTA: 'playback.v1.bpm.percent_delta',
});
