/**
 * Rule policy engine: after the reaction compile step, turns the recommendation row
 * into an ordered playback-intent list, then into playback commands v1.
 *
 * Optional fusion / ML heads can append intents before command compilation later.
 */

import { compileReactionRecommendation } from './compileReactionRecommendation';
import { recommendationToPlaybackIntents } from '../../playback/intents/recommendationToPlaybackIntents';
import { playbackCommandsFromPlaybackIntents } from '../../playback/intents/playbackCommandsFromPlaybackIntents';

export const RULE_POLICY_ENGINE_ID = 'rule_policy_engine_v0';

/**
 * Full mapper tick: same args as `compileReactionRecommendation`.
 *
 * @param {Parameters<typeof compileReactionRecommendation>[0]} compileArgs
 */
export function runRulePolicyEvaluation(compileArgs) {
    const recommendation = compileReactionRecommendation(compileArgs);
    const playbackIntents = recommendationToPlaybackIntents(recommendation, {
        source: RULE_POLICY_ENGINE_ID,
    });
    const playbackCommands = playbackCommandsFromPlaybackIntents(playbackIntents);
    return { recommendation, playbackIntents, playbackCommands };
}

/**
 * Reserved for Phase 4+: evaluate rules/ML directly from a pre-sampled {@link CueTensor} without pushing into the ring buffer.
 *
 * @param {{ tensor: import('../timeline/CueRingBuffer').CueTensor }} _args
 * @returns {null}
 */
export function evaluateRulePolicyFromCueTensor(_args) {
    return null;
}
