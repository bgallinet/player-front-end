/**
 * Playback intents — discriminated union contract (policy / ML → effect compiler).
 * Parallel to {@link ../commands/playbackCommandKinds.v1} but carries priority, source, and fusion metadata.
 */

export const PLAYBACK_INTENT_SCHEMA_V1 = 'playback-intents-v1';

/** @readonly */
export const PLAYBACK_INTENT_KIND_V1 = Object.freeze({
    DSP_EQ_VECTOR: 'playback.intent.v1.dsp.eq_vector',
    DSP_VOLUME_MULTIPLIER: 'playback.intent.v1.dsp.volume_multiplier',
    DSP_RHYTHMIC_ENHANCEMENT_PERCENT: 'playback.intent.v1.dsp.rhythmic_enhancement_percent',
    DSP_REVERB_PERCENT: 'playback.intent.v1.dsp.reverb_percent',
    DSP_DELAY_PERCENT: 'playback.intent.v1.dsp.delay_percent',
    DSP_KEY_SEMITONES: 'playback.intent.v1.dsp.key_semitones',
    DSP_BPM_PERCENT_DELTA: 'playback.intent.v1.dsp.bpm_percent_delta',
});
