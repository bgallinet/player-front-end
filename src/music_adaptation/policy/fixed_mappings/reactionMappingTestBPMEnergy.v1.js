/**
 * Test mapping for the test player.
 * Energy-delta overrides are disabled; only regular live reaction interactions
 * (including thumbs classification in profile selection) remain active.
 */

import { REACTION_PLAYBACK_PROFILE } from './reactionPlaybackProfiles.v1';

const FLAT_EQ = Object.freeze([0, 0, 0, 0, 0, 0]);
export const TEST_THUMB_TEMPO_STEP_BPM = 3;

const PROFILE_IDS = Object.freeze(Object.values(REACTION_PLAYBACK_PROFILE));

function createProfileRecord(valueFactory) {
    return PROFILE_IDS.reduce((acc, profileId) => {
        acc[profileId] = valueFactory(profileId);
        return acc;
    }, {});
}

export const REACTION_MAPPING_TEST_BPM_ENERGY_DECLARATIVE_RULES = Object.freeze([
]);

/**
 * Policy bundle with neutral baseline and no energy-delta declarative overrides.
 */
export function createReactionMappingTestBPMEnergyBundle() {
    return {
        eqMappings: createProfileRecord(() => [...FLAT_EQ]),
        volumeMappings: createProfileRecord(() => 1.0),
        rhythmicEnhancementMappings: createProfileRecord(() => 0),
        reverbMappings: createProfileRecord(() => 0),
        delayMappings: createProfileRecord(() => 0),
        keyShiftMappings: createProfileRecord(() => 0),
        bpmShiftMappings: createProfileRecord(() => 0),
        thumbTempoStepBpm: TEST_THUMB_TEMPO_STEP_BPM,
        declarativeRules: [...REACTION_MAPPING_TEST_BPM_ENERGY_DECLARATIVE_RULES],
    };
}

