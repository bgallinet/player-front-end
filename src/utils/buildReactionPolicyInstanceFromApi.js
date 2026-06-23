import { normalizeReactionPolicyBundle } from '../music_adaptation/policy/reactionPolicyBundle';
import {
    REACTION_POLICY_INSTANCE_SCHEMA_V1,
    REACTION_POLICY_PRODUCER_KIND,
} from '../music_adaptation/policy/reactionPolicyInstances.v1';
import { compileDeclarativeRuleDescriptors } from '../music_adaptation/policy/serverDeclarativeRules';

/**
 * @param {Awaited<ReturnType<import('./fetchAdaptationPolicy').fetchAdaptationPolicy>>} apiPayload
 */
export function buildReactionPolicyInstanceFromApi(apiPayload) {
    const bundle = normalizeReactionPolicyBundle(apiPayload.bundle);
    const descriptors = apiPayload.bundle?.declarativeRules;
    const rawBundle = apiPayload.bundle && typeof apiPayload.bundle === 'object' ? apiPayload.bundle : {};
    const catalogTrackSelection =
        rawBundle.catalogTrackSelection && typeof rawBundle.catalogTrackSelection === 'object'
            ? rawBundle.catalogTrackSelection
            : null;

    return {
        ...bundle,
        catalogTrackSelection,
        declarativeRules: compileDeclarativeRuleDescriptors(
            Array.isArray(descriptors) ? descriptors : [],
        ),
        policyInstanceSchemaVersion: REACTION_POLICY_INSTANCE_SCHEMA_V1,
        policyProducerKind: REACTION_POLICY_PRODUCER_KIND.SERVER_CATALOG_V1,
        policyId: apiPayload.policy_id,
        policyVersion: apiPayload.version,
    };
}
