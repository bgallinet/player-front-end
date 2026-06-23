/**
 * Compile server-authored declarative rule descriptors (JSON) into runtime rules.
 */

import EnvironmentVariables from '../../EnvironmentVariables';
import { getDeclarativeRulesRuntime } from './declarativeReactionRules';

export const ENERGY_SURVEY_LOCAL_STORAGE_KEY = 'latest_energy_survey';
export const ORIGINAL_BPM_LOCAL_STORAGE_KEY = 'calibration_original_bpm';

/**
 * @param {{ base_multiplier?: number, energy_scale?: number, energy_divisor?: number }} [params]
 */
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

/** Fetches latest energy survey and caches in localStorage for Mode B policy rules. */
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
        if (energySurvey === null || typeof window === 'undefined') return energySurvey;
        window.localStorage.setItem(ENERGY_SURVEY_LOCAL_STORAGE_KEY, String(energySurvey));
        return energySurvey;
    } catch {
        return null;
    }
}

/** Tempo-only BPM shift % from intro energy survey (pitch preserved — same path as Mode C thumb tempo). */
export function computeEnergySurveyBpmShiftPercent(params = {}) {
    if (typeof window === 'undefined') return 0;
    const baseMultiplier = Number(params.base_multiplier ?? 0.85);
    const energyScale = Number(params.energy_scale ?? 0.3);
    const energyDivisor = Number(params.energy_divisor ?? 10);
    const originalBpm = Number(window.localStorage.getItem(ORIGINAL_BPM_LOCAL_STORAGE_KEY));
    const energySurvey = Number(window.localStorage.getItem(ENERGY_SURVEY_LOCAL_STORAGE_KEY));
    if (!Number.isFinite(originalBpm) || originalBpm <= 0) return 0;
    if (!Number.isFinite(energySurvey)) return 0;
    const bpmAdapted = baseMultiplier * originalBpm + (energySurvey / energyDivisor) * energyScale * originalBpm;
    return ((bpmAdapted - originalBpm) / originalBpm) * 100;
}

/** @deprecated Use {@link computeEnergySurveyBpmShiftPercent} — kept for legacy rule type names. */
export function computeEnergySurveySimplifyBpmKeyShift(params = {}) {
    return computeEnergySurveyBpmShiftPercent(params);
}

/**
 * @param {Array<Record<string, unknown>>} descriptors
 * @returns {import('./declarativeReactionRules').DeclarativeReactionRule[]}
 */
export function compileDeclarativeRuleDescriptors(descriptors) {
    if (!Array.isArray(descriptors)) return [];
    /** @type {import('./declarativeReactionRules').DeclarativeReactionRule[]} */
    const rules = [];
    for (const d of descriptors) {
        if (!d || typeof d !== 'object') continue;
        const type = String(d.type || '');
        const id = String(d.id || type || 'server.rule');
        const priority = Number(d.priority) || 0;
        const params = d.params && typeof d.params === 'object' ? d.params : {};

        if (
            type === 'energy_survey_bpm' ||
            type === 'energy_survey_simplify_bpm_key_shift'
        ) {
            rules.push({
                id,
                priority,
                when: () => true,
                patch: {
                    get bpmShiftPercent() {
                        return computeEnergySurveyBpmShiftPercent(params);
                    },
                },
            });
            continue;
        }
    }
    return rules;
}

/**
 * @param {import('./reactionPolicyBundle').ReactionPolicyBundleSnapshot} bundle
 */
export function resolveDeclarativeRulesFromBundle(bundle) {
    const raw = bundle?.declarativeRules;
    if (!Array.isArray(raw) || raw.length === 0) {
        return getDeclarativeRulesRuntime();
    }
    if (raw[0] && typeof raw[0] === 'object' && typeof raw[0].type === 'string') {
        return compileDeclarativeRuleDescriptors(raw);
    }
    if (raw[0] && typeof raw[0].when === 'function') {
        return raw;
    }
    return getDeclarativeRulesRuntime();
}
