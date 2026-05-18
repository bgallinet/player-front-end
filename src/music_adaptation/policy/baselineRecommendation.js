/**
 * Build the SoundConsole recommendation row from one playback profile + user mapping tables.
 */

import { resolveEqVector, EQ_PRESETS } from './eqPresetVectors.v1';
import {
    resolveVolumeMultiplierForPlaybackProfile,
    resolveKeyShiftForPlaybackProfile,
    resolveSimplifyBpmKeyShiftForPlaybackProfile,
    DEFAULT_RHYTHMIC_ENHANCEMENT_MAPPINGS,
    DEFAULT_REVERB_MAPPINGS,
    DEFAULT_DELAY_MAPPINGS,
    DEFAULT_BPM_SHIFT_MAPPINGS,
} from './mappingDefaults.v1';
import { playbackProfileUsesNoddingVolume } from './playbackProfiles.v1';

/**
 * @param {{
 *   playbackProfile: string,
 *   dominantFaceTone: string | null,
 *   noddingAmplitude: number,
 *   isNodding: boolean,
 *   handsRaised: boolean,
 *   thumbUpActive: boolean,
 *   thumbDownActive: boolean,
 *   dataPointsAnalyzed: number,
 *   eqMappings: Record<string, unknown>,
 *   volumeMappings: Record<string, unknown>,
 *   rhythmicEnhancementMappings: Record<string, unknown>,
 *   reverbMappings: Record<string, unknown>,
 *   delayMappings: Record<string, unknown>,
 *   keyShiftMappings: Record<string, unknown>,
 *   bpmShiftMappings: Record<string, unknown>,
 *   simplifyBpmKeyShiftMappings?: Record<string, unknown>,
 *   nodBpmShiftPercentOverride?: number | null,
 *   meanNodFrequencyHz?: number,
 * }} args
 */
export function buildBaselineRecommendation(args) {
    const {
        playbackProfile,
        dominantFaceTone,
        noddingAmplitude,
        isNodding,
        handsRaised,
        thumbUpActive,
        thumbDownActive,
        dataPointsAnalyzed,
        eqMappings,
        volumeMappings,
        rhythmicEnhancementMappings,
        reverbMappings,
        delayMappings,
        keyShiftMappings,
        bpmShiftMappings,
        simplifyBpmKeyShiftMappings = {},
        nodBpmShiftPercentOverride = null,
        meanNodFrequencyHz,
    } = args;

    const eqMapping = eqMappings[playbackProfile];
    const eqVector = resolveEqVector(eqMapping);
    const volumeMultiplier = resolveVolumeMultiplierForPlaybackProfile(volumeMappings, playbackProfile);
    const rhythmicEnhancement =
        rhythmicEnhancementMappings[playbackProfile] ?? DEFAULT_RHYTHMIC_ENHANCEMENT_MAPPINGS[playbackProfile];
    const reverbAmount = reverbMappings[playbackProfile] ?? DEFAULT_REVERB_MAPPINGS[playbackProfile];
    const delayAmount = delayMappings[playbackProfile] ?? DEFAULT_DELAY_MAPPINGS[playbackProfile];
    const keyShiftSemitones = resolveKeyShiftForPlaybackProfile(keyShiftMappings, playbackProfile);
    const mappedBpmShift =
        bpmShiftMappings[playbackProfile] ?? DEFAULT_BPM_SHIFT_MAPPINGS[playbackProfile] ?? 0;
    const bpmShiftPercentRaw =
        typeof nodBpmShiftPercentOverride === 'number' && Number.isFinite(nodBpmShiftPercentOverride)
            ? nodBpmShiftPercentOverride
            : mappedBpmShift;
    const bpmShiftPercent = bpmShiftPercentRaw;
    const simplifyBpmKeyShift = resolveSimplifyBpmKeyShiftForPlaybackProfile(
        simplifyBpmKeyShiftMappings,
        playbackProfile,
    );

    const eqPresetKeyword = Array.isArray(eqMapping)
        ? Object.keys(EQ_PRESETS).find((key) => JSON.stringify(EQ_PRESETS[key]) === JSON.stringify(eqVector)) ||
          'custom'
        : typeof eqMapping === 'string'
          ? eqMapping
          : 'flat';

    const volumeTracksNoddingAmplitude = playbackProfileUsesNoddingVolume(playbackProfile);

    return {
        playbackProfile,
        emotionState: playbackProfile,
        dominantFaceTone,
        dominantEmotion: dominantFaceTone,
        noddingAmplitude: isNodding ? noddingAmplitude : 0,
        isNodding,
        volumeTracksNoddingAmplitude,
        handsRaised,
        thumbUpActive,
        thumbDownActive,

        eqPreset: eqPresetKeyword,
        eqVector,
        volumeMultiplier,
        rhythmicEnhancement,
        reverbAmount,
        delayAmount,
        keyShiftSemitones,
        bpmShiftPercent,
        simplifyBpmKeyShift,
        bpmKeyShiftPercent: simplifyBpmKeyShift,
        meanNodFrequencyHz:
            typeof meanNodFrequencyHz === 'number' && Number.isFinite(meanNodFrequencyHz)
                ? meanNodFrequencyHz
                : undefined,
        nodBpmAdaptActive:
            typeof nodBpmShiftPercentOverride === 'number' && Number.isFinite(nodBpmShiftPercentOverride),

        timestamp: Date.now(),
        dataPointsAnalyzed,

        bodyPoseInfluence: null,
        facialLandmarkInfluence: null,

        appliedDeclarativeRules: [],
    };
}
