/**
 * Phase 1 reaction compiler: timeline ring buffer → recommendation (+ declarative rules).
 *
 * Multimodal samples are pushed into the ring buffer on each sensing frame via
 * `ingestSensingFeedIntoBuffer`. Playback decisions use only `CueRingBuffer.sampleWindow`
 * aggregates (same EMOTION_ANALYSIS_WINDOW for vision + gestures + nod).
 */

import {
    EMOTION_ANALYSIS_WINDOW,
    MIN_DATA_POINTS_REQUIRED,
    THRESHOLD_NODDING,
    CUE_RING_SAMPLE_HZ,
} from '../../hooks/ReactionMapperConfig';
import { CUE_CHANNEL_IDS_V1 } from '../schema/cueSchema.v1';
import { BPM_SHIFT_PERCENT_MAX, BPM_SHIFT_PERCENT_MIN } from '../../components/audio_processing/audioEffects/bpmShift';
import { normalizeReactionSensingFeed } from '../feeds/reactionSensingFeed';
import { normalizeReactionPolicyBundle } from './reactionPolicyBundle';
import { visionCuePatchFromDatapoint } from '../adapters/visionCueAdapter';
import { gestureCuePatchFromFlags, gestureBooleansFromMeanWindow } from '../adapters/gestureCueAdapter';
import { tensorMeanByChannel, tensorLatestRowRecord } from './tensorChannelStats';
import { analyzeDominantFaceToneFromChannelMeans } from './dominantFaceFromChannels';
import {
    deriveReactionPlaybackProfile,
    DOMINANT_FACE_TONE,
    REACTION_PLAYBACK_PROFILE,
} from './fixed_mappings/reactionPlaybackProfiles.v1';
import { buildBaselineRecommendation } from './baselineRecommendation';
import { mergeDeclarativeRules, getDeclarativeRulesRuntime } from './declarativeReactionRules';

function finiteTs(ts) {
    const n = typeof ts === 'number' ? ts : parseFloat(ts);
    return Number.isFinite(n) ? n : 0;
}

export function latestVisionTimelineDatapoint(emotionDataArray) {
    if (!emotionDataArray?.length) return null;
    let best = emotionDataArray[0];
    let bestT = finiteTs(best.timestamp);
    for (let i = 1; i < emotionDataArray.length; i++) {
        const d = emotionDataArray[i];
        const t = finiteTs(d.timestamp);
        if (t >= bestT) {
            best = d;
            bestT = t;
        }
    }
    return best;
}

/**
 * Single fused observation row for `CueRingBuffer.prototype.pushPartialUpdate`.
 *
 * @param {import('../feeds/reactionSensingFeed').ReactionSensingFeedSnapshot} feed
 */
export function buildPushPatchFromSensingFeed(feed) {
    const f = normalizeReactionSensingFeed(feed);
    const dp = latestVisionTimelineDatapoint(f.emotionDataArray);
    const vision = visionCuePatchFromDatapoint(dp, {
        noddingAmplitude: f.noddingAmplitude,
        noddingFrequency: f.noddingFrequency,
    });
    const gesture = gestureCuePatchFromFlags({
        handsRaised: f.handsRaised,
        thumbUpActive: f.thumbUpActive,
        thumbDownActive: f.thumbDownActive,
    });
    return { ...vision, ...gesture };
}

/**
 * Append one multimodal sample (vision + nod fallbacks + gestures) at sensing rate.
 *
 * @param {import('../timeline/CueRingBuffer').CueRingBuffer|null|undefined} buffer
 * @param {import('../feeds/reactionSensingFeed').ReactionSensingFeedSnapshot} feed
 * @param {number} [nowMs]
 */
export function ingestSensingFeedIntoBuffer(buffer, feed, nowMs = Date.now()) {
    const patch = buildPushPatchFromSensingFeed(feed);
    if (!buffer) return patch;
    buffer.pushPartialUpdate(patch, nowMs);
    return patch;
}

/**
 * @param {{
 *   buffer: import('../timeline/CueRingBuffer').CueRingBuffer,
 *   policyBundle: import('./reactionPolicyBundle').ReactionPolicyBundleSnapshot,
 *   prevDominantFaceToneRef: { current: string | null },
 *   persistentThumbBpmStateRef?: { current: { persistentDeltaBpm: number, prevThumbUpActive: boolean, prevThumbDownActive: boolean } },
 *   analysisWindowMs?: number,
 *   sampleHz?: number,
 *   nowMs?: number,
 *   nodTrackBpm?: number | null,
 *   latestSensingFeed?: import('../feeds/reactionSensingFeed').ReactionSensingFeedSnapshot | null,
 * }} args
 */
export function compileReactionRecommendation(args) {
    const {
        buffer,
        policyBundle,
        prevDominantFaceToneRef,
        persistentThumbBpmStateRef,
        analysisWindowMs = EMOTION_ANALYSIS_WINDOW,
        sampleHz = CUE_RING_SAMPLE_HZ,
        nowMs = Date.now(),
        nodTrackBpm = null,
        latestSensingFeed = null,
    } = args;

    const pb = normalizeReactionPolicyBundle(policyBundle);
    const declarativeRules = pb.declarativeRules ?? getDeclarativeRulesRuntime();
    const thumbTempoStepBpm = Number.isFinite(Number(pb.thumbTempoStepBpm))
        ? Number(pb.thumbTempoStepBpm)
        : 3;

    const tensor = buffer.sampleWindow(analysisWindowMs, sampleHz, nowMs);
    const channelIds = [...CUE_CHANNEL_IDS_V1];
    const meanWindow = tensorMeanByChannel(tensor, channelIds);
    const latest = tensorLatestRowRecord(tensor, channelIds);

    /** @type {string} */
    let dominantFaceTone =
        prevDominantFaceToneRef.current && typeof prevDominantFaceToneRef.current === 'string'
            ? prevDominantFaceToneRef.current
            : DOMINANT_FACE_TONE.NEUTRAL;
    if (tensor.frameCount >= MIN_DATA_POINTS_REQUIRED) {
        dominantFaceTone = analyzeDominantFaceToneFromChannelMeans(meanWindow, prevDominantFaceToneRef.current);
        prevDominantFaceToneRef.current = dominantFaceTone;
    }

    const nodAmp = Number(meanWindow['vision.face.nod_amplitude']) || 0;
    const isNodding =
        typeof nodAmp === 'number' &&
        !Number.isNaN(nodAmp) &&
        Number.isFinite(nodAmp) &&
        nodAmp > THRESHOLD_NODDING;

    const meanNodHz = Number(meanWindow['vision.face.nod_frequency']) || 0;
    const nodBpmShiftPercentOverride = null;

    const { handsRaised, thumbUpActive, thumbDownActive } = gestureBooleansFromMeanWindow(meanWindow);
    const thumbBpmState = persistentThumbBpmStateRef?.current;
    if (thumbBpmState) {
        if (thumbUpActive && !thumbBpmState.prevThumbUpActive) {
            const previousDelta = Number(thumbBpmState.persistentDeltaBpm) || 0;
            thumbBpmState.persistentDeltaBpm =
                previousDelta + thumbTempoStepBpm;
            console.log('[Thumb BPM] dynamic increase applied', {
                direction: 'up',
                stepBpm: thumbTempoStepBpm,
                previousPersistentDeltaBpm: previousDelta,
                nextPersistentDeltaBpm: thumbBpmState.persistentDeltaBpm,
            });
        }
        if (thumbDownActive && !thumbBpmState.prevThumbDownActive) {
            const previousDelta = Number(thumbBpmState.persistentDeltaBpm) || 0;
            thumbBpmState.persistentDeltaBpm =
                previousDelta - thumbTempoStepBpm;
            console.log('[Thumb BPM] dynamic decrease applied', {
                direction: 'down',
                stepBpm: thumbTempoStepBpm,
                previousPersistentDeltaBpm: previousDelta,
                nextPersistentDeltaBpm: thumbBpmState.persistentDeltaBpm,
            });
        }
        thumbBpmState.prevThumbUpActive = !!thumbUpActive;
        thumbBpmState.prevThumbDownActive = !!thumbDownActive;
    }

    const currentEnergy =
        typeof latestSensingFeed?.currentEnergy === 'number' && Number.isFinite(latestSensingFeed.currentEnergy)
            ? latestSensingFeed.currentEnergy
            : null;
    const targetEnergy =
        typeof latestSensingFeed?.targetEnergy === 'number' && Number.isFinite(latestSensingFeed.targetEnergy)
            ? latestSensingFeed.targetEnergy
            : null;
    const energyDelta =
        currentEnergy !== null && targetEnergy !== null ? targetEnergy - currentEnergy : null;

    let playbackProfile = deriveReactionPlaybackProfile({
        dominantFaceTone,
        noddingAmplitude: nodAmp,
        handsRaised,
        thumbUpActive,
        thumbDownActive,
    });

    // Allow policy evaluation to run for energy-only mappings even when face/gesture profile is absent.
    if (!playbackProfile && energyDelta !== null) {
        playbackProfile = REACTION_PLAYBACK_PROFILE.NEUTRAL;
    }

    if (!playbackProfile) return null;

    const baselineRaw = buildBaselineRecommendation({
        playbackProfile,
        dominantFaceTone,
        noddingAmplitude: nodAmp,
        isNodding,
        handsRaised,
        thumbUpActive,
        thumbDownActive,
        dataPointsAnalyzed: tensor.frameCount,
        eqMappings: pb.eqMappings,
        volumeMappings: pb.volumeMappings,
        rhythmicEnhancementMappings: pb.rhythmicEnhancementMappings,
        reverbMappings: pb.reverbMappings,
        delayMappings: pb.delayMappings,
        keyShiftMappings: pb.keyShiftMappings,
        bpmShiftMappings: pb.bpmShiftMappings,
        nodBpmShiftPercentOverride,
        meanNodFrequencyHz: meanNodHz,
    });
    const persistentDeltaBpm = Number(thumbBpmState?.persistentDeltaBpm) || 0;
    // Apply thumb accumulator directly in BPM shift control units so each gesture uses the configured step.
    const bpmShiftWithThumbPersistence = (Number(baselineRaw.bpmShiftPercent) || 0) + persistentDeltaBpm;
    const clampedBpmShiftPercent = Math.max(
        BPM_SHIFT_PERCENT_MIN,
        Math.min(BPM_SHIFT_PERCENT_MAX, bpmShiftWithThumbPersistence),
    );
    const baseline = {
        ...baselineRaw,
        bpmShiftPercent: clampedBpmShiftPercent,
        persistentThumbBpmDeltaBpm: persistentDeltaBpm,
        currentEnergy,
        targetEnergy,
    };

    const ctx = {
        latest,
        meanWindow,
        playbackProfile,
        emotionState: playbackProfile,
        dominantFaceTone,
        dominantEmotion: dominantFaceTone,
        currentEnergy,
        targetEnergy,
        energyDelta,
    };

    return mergeDeclarativeRules(ctx, baseline, declarativeRules);
}
