/**
 * Human-authored overlays on top of baseline mappings — ideal for UX / lab testing.
 *
 * Enable sample pack: `localStorage.setItem('reaction_rules_test', '1')` then reload.
 */

/**
 * @typedef {{
 *   latest: Record<string, number>,
 *   meanWindow: Record<string, number>,
 *   playbackProfile: string | null,
 *   emotionState: string | null,
 *   dominantFaceTone: string | null,
 *   dominantEmotion: string | null,
 *   currentEnergy?: number | null,
 *   targetEnergy?: number | null,
 *   energyDelta?: number | null,
 * }} ReactionRuleContext
 */

/**
 * @typedef {{
 *   id: string,
 *   priority?: number,
 *   when: (ctx: ReactionRuleContext) => boolean,
 *   patch: Partial<Record<string, unknown>>,
 * }} DeclarativeReactionRule
 */

/** Demo: thumb up forces key shift +1 semitone (overrides mapping table while active). */
export const DECLARATIVE_RULES_TEST_PACK_V1 = /** @type {DeclarativeReactionRule[]} */ ([
    {
        id: 'test.thumb_up.key_plus_one_semitone',
        priority: 1000,
        when: (ctx) =>
            (ctx.latest['gesture.thumb_up'] ?? 0) >= 0.5 && (ctx.latest['gesture.thumb_down'] ?? 0) < 0.5,
        patch: { keyShiftSemitones: 1 },
    },
]);

/**
 * @returns {DeclarativeReactionRule[]}
 */
export function getDeclarativeRulesRuntime() {
    try {
        if (typeof window !== 'undefined' && window.localStorage?.getItem('reaction_rules_test') === '1') {
            return DECLARATIVE_RULES_TEST_PACK_V1;
        }
    } catch {
        /* ignore */
    }
    return [];
}

/**
 * Later rules override earlier rules on overlapping patch keys (sort ascending priority).
 *
 * @template T
 * @param {ReactionRuleContext} ctx
 * @param {T} recommendation
 * @param {DeclarativeReactionRule[]} rules
 * @returns {T & { appliedDeclarativeRules: string[] }}
 */
export function mergeDeclarativeRules(ctx, recommendation, rules) {
    const sorted = [...rules].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    /** @type {string[]} */
    const appliedDeclarativeRules =
        recommendation && typeof recommendation === 'object' && Array.isArray(recommendation.appliedDeclarativeRules)
            ? [...recommendation.appliedDeclarativeRules]
            : [];

    let out = { ...recommendation };

    for (const rule of sorted) {
        try {
            if (rule.when(ctx)) {
                out = { ...out, ...rule.patch };
                appliedDeclarativeRules.push(rule.id);
            }
        } catch {
            /* ignore broken lab rules */
        }
    }

    return { ...out, appliedDeclarativeRules };
}
