/**
 * Test mapping for adaptation Mode C.
 * Mode C = thumbs up/down controls BPM step changes.
 */

import { REACTION_PLAYBACK_PROFILE } from './reactionPlaybackProfiles.v1';

const FLAT_EQ = Object.freeze([0, 0, 0, 0, 0, 0]);
export const TEST_THUMB_TEMPO_STEP_BPM_MODE_C = 5;

const PROFILE_IDS = Object.freeze(Object.values(REACTION_PLAYBACK_PROFILE));

function createProfileRecord(valueFactory) {
    return PROFILE_IDS.reduce((acc, profileId) => {
        acc[profileId] = valueFactory(profileId);
        return acc;
    }, {});
}

export const REACTION_MAPPING_TEST_BPM_ENERGY_DECLARATIVE_RULES_MODE_C = Object.freeze([]);

export function createReactionMappingTestBPMEnergyModeCBundle() {
    return {
        eqMappings: createProfileRecord(() => [...FLAT_EQ]),
        volumeMappings: createProfileRecord(() => 1.0),
        rhythmicEnhancementMappings: createProfileRecord(() => 0),
        reverbMappings: createProfileRecord(() => 0),
        delayMappings: createProfileRecord(() => 0),
        keyShiftMappings: createProfileRecord(() => 0),
        bpmShiftMappings: createProfileRecord(() => 0),
        thumbTempoStepBpm: TEST_THUMB_TEMPO_STEP_BPM_MODE_C,
        declarativeRules: [...REACTION_MAPPING_TEST_BPM_ENERGY_DECLARATIVE_RULES_MODE_C],
    };
}
