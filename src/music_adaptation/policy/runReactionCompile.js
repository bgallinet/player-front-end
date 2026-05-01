/**
 * Single tick: music adaptation timeline + policy bundle → recommendation + intents + playback commands v1.
 */

import { runRulePolicyEvaluation } from './rulePolicyEngine';

/** @param {Parameters<typeof import('./compileReactionRecommendation').compileReactionRecommendation>[0]} compileArgs */
export function runReactionCompile(compileArgs) {
    return runRulePolicyEvaluation(compileArgs);
}
