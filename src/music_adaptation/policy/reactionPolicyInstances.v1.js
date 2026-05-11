/**
 * Policy *instances*: concrete reaction→audio mapping bundles consumed by the compiler.
 *
 * Built-in defaults and ManualMapping edits are the same artifact — a mutable snapshot of one
 * policy instance. Later producers (e.g. model inference) can attach new snapshots with the
 * same mapping-table shape (+ optional producer metadata).
 */

import { normalizeReactionPolicyBundle } from './reactionPolicyBundle';
import {
    DEFAULT_EQ_MAPPINGS,
    DEFAULT_VOLUME_MAPPINGS,
    DEFAULT_RHYTHMIC_ENHANCEMENT_MAPPINGS,
    DEFAULT_REVERB_MAPPINGS,
    DEFAULT_DELAY_MAPPINGS,
    DEFAULT_KEY_SHIFT_MAPPINGS,
    DEFAULT_BPM_SHIFT_MAPPINGS,
} from './fixed_mappings/reactionMappingDefaults.v1';

/**
 * @typedef {import('./reactionPolicyBundle').ReactionPolicyBundleSnapshot & {
 *   policyInstanceSchemaVersion?: string,
 *   policyProducerKind?: string,
 * }} ReactionPolicyInstance
 */

/** Origin of this snapshot — extend when dynamic producers ship (e.g. model inference). */
export const REACTION_POLICY_PRODUCER_KIND = Object.freeze({
    STATIC_BUILTIN_V1: 'static_builtin_v1',
});

export const REACTION_POLICY_INSTANCE_SCHEMA_V1 = 'reaction.policy.instance.v1';

function cloneMappingRecord(rec) {
    return { ...rec };
}

/**
 * Deterministic built-in policy instance (mutable copies for React state / ManualMapping).
 *
 * @returns {ReactionPolicyInstance}
 */
export function createBuiltinStaticReactionPolicyInstance() {
    const bundle = normalizeReactionPolicyBundle({
        eqMappings: cloneMappingRecord(DEFAULT_EQ_MAPPINGS),
        volumeMappings: cloneMappingRecord(DEFAULT_VOLUME_MAPPINGS),
        rhythmicEnhancementMappings: cloneMappingRecord(DEFAULT_RHYTHMIC_ENHANCEMENT_MAPPINGS),
        reverbMappings: cloneMappingRecord(DEFAULT_REVERB_MAPPINGS),
        delayMappings: cloneMappingRecord(DEFAULT_DELAY_MAPPINGS),
        keyShiftMappings: cloneMappingRecord(DEFAULT_KEY_SHIFT_MAPPINGS),
        bpmShiftMappings: cloneMappingRecord(DEFAULT_BPM_SHIFT_MAPPINGS),
    });

    return {
        ...bundle,
        policyInstanceSchemaVersion: REACTION_POLICY_INSTANCE_SCHEMA_V1,
        policyProducerKind: REACTION_POLICY_PRODUCER_KIND.STATIC_BUILTIN_V1,
    };
}
