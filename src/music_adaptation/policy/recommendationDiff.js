/**
 * Detect meaningful changes between successive SoundConsole recommendation payloads.
 */

import { THRESHOLD_NODDING } from '../../hooks/ReactionMapperConfig';

/**
 * @param {unknown} next
 * @param {unknown} prev
 */
export function reactionRecommendationsDiffer(next, prev) {
    if (!prev && !next) return false;
    if (!prev || !next) return true;

    const rulesPrev = JSON.stringify(prev.appliedDeclarativeRules ?? []);
    const rulesNext = JSON.stringify(next.appliedDeclarativeRules ?? []);

    return (
        next.emotionState !== prev.emotionState ||
        next.eqPreset !== prev.eqPreset ||
        next.handsRaised !== prev.handsRaised ||
        rulesPrev !== rulesNext ||
        Math.abs((next.volumeMultiplier || 0) - (prev.volumeMultiplier || 0)) > 0.01 ||
        Math.abs((next.noddingAmplitude || 0) - (prev.noddingAmplitude || 0)) > THRESHOLD_NODDING ||
        Math.abs((next.rhythmicEnhancement || 0) - (prev.rhythmicEnhancement || 0)) > 0.01 ||
        Math.abs((next.reverbAmount || 0) - (prev.reverbAmount || 0)) > 0.01 ||
        Math.abs((next.delayAmount || 0) - (prev.delayAmount || 0)) > 0.01 ||
        Math.abs((next.keyShiftSemitones ?? 0) - (prev.keyShiftSemitones ?? 0)) > 0.01 ||
        Math.abs((next.bpmShiftPercent ?? 0) - (prev.bpmShiftPercent ?? 0)) > 0.01
    );
}
