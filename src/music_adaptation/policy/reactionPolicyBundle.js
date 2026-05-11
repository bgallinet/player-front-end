/**
 * User-authored reaction→audio mapping tables (+ optional declarative rules).
 * Player may attach a broader {@link import('./reactionPolicyInstances.v1').ReactionPolicyInstance};
 * {@link normalizeReactionPolicyBundle} reads only the mapping fields.
 */

/**
 * @typedef {object} ReactionPolicyBundleSnapshot
 * @property {Record<string, unknown>} [eqMappings]
 * @property {Record<string, unknown>} [volumeMappings]
 * @property {Record<string, unknown>} [rhythmicEnhancementMappings]
 * @property {Record<string, unknown>} [reverbMappings]
 * @property {Record<string, unknown>} [delayMappings]
 * @property {Record<string, unknown>} [keyShiftMappings]
 * @property {Record<string, unknown>} [bpmShiftMappings]
 * @property {number} [thumbTempoStepBpm]
 * @property {import('./declarativeReactionRules').DeclarativeReactionRule[]} [declarativeRules]
 */

function shallowMappingCopy(m) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
    return { ...m };
}

/** @param {Partial<ReactionPolicyBundleSnapshot> | null | undefined} raw */
export function normalizeReactionPolicyBundle(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    return {
        eqMappings: shallowMappingCopy(r.eqMappings),
        volumeMappings: shallowMappingCopy(r.volumeMappings),
        rhythmicEnhancementMappings: shallowMappingCopy(r.rhythmicEnhancementMappings),
        reverbMappings: shallowMappingCopy(r.reverbMappings),
        delayMappings: shallowMappingCopy(r.delayMappings),
        keyShiftMappings: shallowMappingCopy(r.keyShiftMappings),
        bpmShiftMappings: shallowMappingCopy(r.bpmShiftMappings),
        thumbTempoStepBpm: Number.isFinite(Number(r.thumbTempoStepBpm))
            ? Number(r.thumbTempoStepBpm)
            : undefined,
        declarativeRules: r.declarativeRules,
    };
}
