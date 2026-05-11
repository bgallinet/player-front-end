/**
 * Test mapping for adaptation Mode B.
 * Mode B = BPM adaptation is computed from the latest stored energy survey value.
 */

import { REACTION_PLAYBACK_PROFILE } from './reactionPlaybackProfiles.v1';
import EnvironmentVariables from '../../../utils/EnvironmentVariables';

const FLAT_EQ = Object.freeze([0, 0, 0, 0, 0, 0]);
export const TEST_THUMB_TEMPO_STEP_BPM_MODE_B = 0;
export const ENERGY_SURVEY_LOCAL_STORAGE_KEY = 'latest_energy_survey';
export const ORIGINAL_BPM_LOCAL_STORAGE_KEY = 'calibration_original_bpm';

const PROFILE_IDS = Object.freeze(Object.values(REACTION_PLAYBACK_PROFILE));

function createProfileRecord(valueFactory) {
    return PROFILE_IDS.reduce((acc, profileId) => {
        acc[profileId] = valueFactory(profileId);
        return acc;
    }, {});
}

function readJsonSafe(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw !== 'string') return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function parseLatestEnergyFromUserPayload(payload) {
    const parsedBody = readJsonSafe(payload?.body);
    const directCandidates = [
        payload?.latest_energy_survey,
        payload?.latestEnergySurvey,
        payload?.energy_survey,
        payload?.energySurvey,
        parsedBody?.latest_energy_survey,
        parsedBody?.latestEnergySurvey,
        parsedBody?.energy_survey,
        parsedBody?.energySurvey,
    ];
    for (const candidate of directCandidates) {
        const n = Number(candidate);
        if (Number.isFinite(n)) return n;
    }
    return null;
}

/**
 * Fetches the latest energy survey value through the user endpoint and caches it in localStorage.
 * Returns `null` when no valid survey value is available.
 */
export async function fetchLatestEnergySurveyFromUserEndpoint(idToken) {
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (idToken) {
            headers.Authorization = `Bearer ${idToken}`;
        }
        const response = await fetch(EnvironmentVariables.UserAPI_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                request_type: 'user',
                user_request_type: 'latest_energy_survey',
            }),
        });
        if (!response.ok) return null;
        const payload = await response.json();
        const energySurvey = parseLatestEnergyFromUserPayload(payload);
        console.log('[Mode B] latest energy survey fetched:', {
            energySurvey,
            hasIdToken: Boolean(idToken),
        });
        if (energySurvey === null || typeof window === 'undefined') return energySurvey;
        window.localStorage.setItem(ENERGY_SURVEY_LOCAL_STORAGE_KEY, String(energySurvey));
        return energySurvey;
    } catch {
        console.log('[Mode B] latest energy survey fetch failed');
        return null;
    }
}

function computeModeBBpmShiftPercent() {
    if (typeof window === 'undefined') return 0;
    const originalBpm = Number(window.localStorage.getItem(ORIGINAL_BPM_LOCAL_STORAGE_KEY));
    const energySurvey = Number(window.localStorage.getItem(ENERGY_SURVEY_LOCAL_STORAGE_KEY));
    if (!Number.isFinite(originalBpm) || originalBpm <= 0) {
        console.log('[Mode B] BPM computation skipped: invalid original BPM', { originalBpm });
        return 0;
    }
    if (!Number.isFinite(energySurvey)) {
        console.log('[Mode B] BPM computation skipped: invalid energy survey', { energySurvey });
        return 0;
    }

    const bpmAdapted = 0.85 * originalBpm + (energySurvey / 10) * 0.3 * originalBpm;
    const bpmShiftPercent = ((bpmAdapted - originalBpm) / originalBpm) * 100;
    console.log('[Mode B] BPM computation', {
        energySurveyConsidered: energySurvey,
        originalBpm,
        bpmAdapted,
        bpmShiftPercent,
    });
    return bpmShiftPercent;
}

export const REACTION_MAPPING_TEST_BPM_ENERGY_DECLARATIVE_RULES_MODE_B = Object.freeze([
    {
        id: 'mode_b.energy_survey_controls_bpm',
        priority: 1000,
        when: () => true,
        patch: {
            get bpmShiftPercent() {
                return computeModeBBpmShiftPercent();
            },
        },
    },
]);

export function createReactionMappingTestBPMEnergyModeBBundle() {
    return {
        eqMappings: createProfileRecord(() => [...FLAT_EQ]),
        volumeMappings: createProfileRecord(() => 1.0),
        rhythmicEnhancementMappings: createProfileRecord(() => 0),
        reverbMappings: createProfileRecord(() => 0),
        delayMappings: createProfileRecord(() => 0),
        keyShiftMappings: createProfileRecord(() => 0),
        bpmShiftMappings: createProfileRecord(() => 0),
        thumbTempoStepBpm: TEST_THUMB_TEMPO_STEP_BPM_MODE_B,
        declarativeRules: [...REACTION_MAPPING_TEST_BPM_ENERGY_DECLARATIVE_RULES_MODE_B],
    };
}
