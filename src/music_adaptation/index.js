/**
 * Music adaptation cue pipeline (Phase 0+) — pure JS helpers for schema, adapters, landmarks UI, debug snapshots.
 */

export {
    CUE_SCHEMA_VERSION_V1,
    CUE_CHANNEL_IDS_V1,
    CUE_CHANNELS_V1,
    getCueChannelIndexV1,
    getCueChannelCountV1,
} from './schema/cueSchema.v1';

export { visionCuePatchFromDatapoint, sortEmotionDatapointsByTime } from './adapters/visionCueAdapter';

export { gestureCuePatchFromFlags } from './adapters/gestureCueAdapter';

export { isSensingDebugEnabled, isMultimodalDebugEnabled } from './debug/sensingDebugFlag';

export {
    buildCueTensorSnapshot,
    emitCueTensorDebugSnapshot,
    getLastCueTensorSnapshotForDebug,
} from './debug/cueTensorSnapshot';

export { CueRingBuffer } from './timeline/CueRingBuffer';
export { sortSamplesByTime, resampleSamplesToTensor } from './timeline/resampleTimeline';

export {
    compileReactionRecommendation,
    buildPushPatchFromSensingFeed,
    latestVisionTimelineDatapoint,
} from './policy/compileReactionRecommendation';

export { runReactionCompile } from './policy/runReactionCompile';

export { runRulePolicyEvaluation, RULE_POLICY_ENGINE_ID, evaluateRulePolicyFromCueTensor } from './policy/rulePolicyEngine';

export { normalizeReactionPolicyBundle } from './policy/reactionPolicyBundle';

export { reactionOutputsDiffer } from './policy/reactionOutputDiff';

export { reactionRecommendationsDiffer } from './policy/recommendationDiff';

export {
    emptyReactionSensingFeedSnapshot,
    normalizeReactionSensingFeed,
} from './feeds/reactionSensingFeed';
export { tensorMeanByChannel, tensorLatestRowRecord } from './policy/tensorChannelStats';
export {
    mergeDeclarativeRules,
    getDeclarativeRulesRuntime,
    DECLARATIVE_RULES_TEST_PACK_V1,
} from './policy/declarativeReactionRules';
