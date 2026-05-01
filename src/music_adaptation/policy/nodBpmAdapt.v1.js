/**
 * Map mean head-nod frequency (Hz) over the analysis window to SoundConsole BPM shift (%).
 */

import {
    NOD_BPM_ADAPT_REFERENCE_BPM,
    NOD_BPM_ADAPT_MIN_MEAN_HZ,
    NOD_BPM_ADAPT_MAX_MEAN_HZ,
} from '../../hooks/ReactionMapperConfig';
import { BPM_SHIFT_PERCENT_MIN, BPM_SHIFT_PERCENT_MAX } from '../../components/audio_processing/audioEffects/bpmShift';

function resolveNodReferenceBpm(trackBpm) {
    const n = typeof trackBpm === 'number' ? trackBpm : NaN;
    if (Number.isFinite(n) && n >= 40 && n <= 280) {
        return n;
    }
    return NOD_BPM_ADAPT_REFERENCE_BPM;
}

/**
 * NoddingCalculator reports frequency in Hz (cycles/s). Treat implied tempo as `hz * 60` BPM.
 *
 * @param {number} meanNodFrequencyHz — mean of `vision.face.nod_frequency` over the cue window
 * @param {boolean} isNodding — true when latest amplitude crosses nod threshold
 * @param {number | null | undefined} trackBpm — detected deck tempo (BPM); falls back to {@link NOD_BPM_ADAPT_REFERENCE_BPM}
 * @returns {number | null} integer percent for playback rate, or `null` to keep manual mapping only
 */
export function computeNodBpmShiftPercent(meanNodFrequencyHz, isNodding, trackBpm) {
    if (!isNodding) return null;
    const hz =
        typeof meanNodFrequencyHz === 'number' && Number.isFinite(meanNodFrequencyHz)
            ? meanNodFrequencyHz
            : 0;
    if (hz < NOD_BPM_ADAPT_MIN_MEAN_HZ) return null;
    const hzClamped = Math.min(Math.max(hz, NOD_BPM_ADAPT_MIN_MEAN_HZ), NOD_BPM_ADAPT_MAX_MEAN_HZ);
    const nodBpm = hzClamped * 60;
    const refBpm = resolveNodReferenceBpm(trackBpm);
    const raw = (nodBpm / refBpm - 1) * 100;
    const clamped = Math.max(BPM_SHIFT_PERCENT_MIN, Math.min(BPM_SHIFT_PERCENT_MAX, raw));
    return Math.round(clamped);
}
