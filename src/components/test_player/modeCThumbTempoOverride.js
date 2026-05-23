/**
 * Mode C (experiment 20260504) thumb-tempo override helpers.
 * Mirrors {@link import('../../music_adaptation/policy/compileReactionRecommendation').compileReactionRecommendation}
 * thumb stepping for policy `reaction.fixed.20260504c` / `data/models/reaction.fixed.20260504c.json`.
 */

/** Server policy id for 20260504 Mode C — see `data/csv_database/variants.csv`. */
export const MODE_C_REACTION_POLICY_ID = 'reaction.fixed.20260504c';

/** Default from `reaction.fixed.20260504c.json` → `thumbTempoStepBpm`. */
export const MODE_C_THUMB_TEMPO_STEP_BPM = 5;

/**
 * @typedef {'up' | 'down'} ThumbTempoDirection
 */

/**
 * @typedef {{ persistentDeltaBpm: number, prevThumbUpActive: boolean, prevThumbDownActive: boolean }} ThumbBpmPersistentState
 */

/**
 * @typedef {{ applyStep: (direction: ThumbTempoDirection) => void } | null} ThumbBpmControlHandle
 */

/** @returns {ThumbBpmPersistentState} */
export function createThumbBpmPersistentState() {
    return {
        persistentDeltaBpm: 0,
        prevThumbUpActive: false,
        prevThumbDownActive: false,
    };
}

/**
 * @param {import('../../music_adaptation/policy/reactionPolicyBundle').ReactionPolicyBundleSnapshot | null | undefined} policyBundle
 */
export function resolveThumbTempoStepBpm(policyBundle) {
    const fromBundle = Number(policyBundle?.thumbTempoStepBpm);
    if (Number.isFinite(fromBundle) && fromBundle > 0) {
        return fromBundle;
    }
    return MODE_C_THUMB_TEMPO_STEP_BPM;
}

/**
 * Apply one thumb tempo step (same delta units as camera thumb edges in compileReactionRecommendation).
 *
 * @param {ThumbBpmPersistentState | null | undefined} state
 * @param {ThumbTempoDirection} direction
 * @param {number} [stepBpm]
 */
export function applyThumbTempoStep(state, direction, stepBpm = MODE_C_THUMB_TEMPO_STEP_BPM) {
    if (!state || (direction !== 'up' && direction !== 'down')) {
        return;
    }
    const step = Number(stepBpm);
    if (!Number.isFinite(step) || step <= 0) {
        return;
    }
    const previousDelta = Number(state.persistentDeltaBpm) || 0;
    state.persistentDeltaBpm = direction === 'up' ? previousDelta + step : previousDelta - step;
}
