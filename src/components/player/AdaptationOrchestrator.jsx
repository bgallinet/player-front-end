/**
 * Music adaptation orchestration: sensing feed → cue timeline → `usePlaybackPolicy` compile ticks.
 *
 * Policy tables and instance builders are re-exported here for `Player` / `ManualMapping`.
 * Mapping rules live under `music_adaptation/policy/*`.
 */

import { useCallback, useEffect, useRef } from 'react';
import {
    REACTION_MAPPER_UPDATE_INTERVAL,
    EMOTION_ANALYSIS_WINDOW,
    CUE_RING_RETENTION_MS,
    CUE_RING_SAMPLE_HZ,
} from '../../hooks/ReactionMapperConfig';
import { useCueTimeline } from '../../hooks/useCueTimeline';
import { usePlaybackPolicy } from '../../music_adaptation/hooks/usePlaybackPolicy';
import { isSensingDebugEnabled } from '../../music_adaptation/debug/sensingDebugFlag';
import { emitCueTensorDebugSnapshot } from '../../music_adaptation/debug/cueTensorSnapshot';
import { ingestSensingFeedIntoBuffer } from '../../music_adaptation/policy/compileReactionRecommendation';
import { emptyReactionSensingFeedSnapshot, normalizeReactionSensingFeed } from '../../music_adaptation/feeds/reactionSensingFeed';
import { runReactionCompile } from '../../music_adaptation/policy/runReactionCompile';
import {
    applyThumbTempoStep,
    resolveThumbTempoStepBpm,
} from '../test_player/modeCThumbTempoOverride';
import UnifiedSensingUserUI from '../sensing_UI/UnifiedSensingUserUI';

/** Named exports — EQ presets live under `music_adaptation/policy`. */

export { EQ_PRESETS, resolveEqVector } from '../../music_adaptation/policy/eqPresetVectors.v1';

export {
    DEFAULT_EQ_MAPPINGS,
    DEFAULT_VOLUME_MAPPINGS,
    DEFAULT_RHYTHMIC_ENHANCEMENT_MAPPINGS,
    DEFAULT_REVERB_MAPPINGS,
    DEFAULT_DELAY_MAPPINGS,
    DEFAULT_KEY_SHIFT_MAPPINGS,
    DEFAULT_BPM_SHIFT_MAPPINGS,
    resolveVolumeMultiplierForPlaybackProfile,
    resolveKeyShiftForPlaybackProfile,
} from '../../music_adaptation/policy/mappingDefaults.v1';

export {
    resolveVolumeMultiplierForPlaybackProfile as resolveVolumeMultiplierForEmotion,
    resolveKeyShiftForPlaybackProfile as resolveKeyShiftSemitonesForEmotion,
} from '../../music_adaptation/policy/mappingDefaults.v1';

export {
    REACTION_PLAYBACK_PROFILE,
    REACTION_PLAYBACK_PROFILE_UI_ROWS,
    DOMINANT_FACE_TONE,
    playbackProfileUsesNoddingVolume,
} from '../../music_adaptation/policy/playbackProfiles.v1';

export {
    createBuiltinStaticReactionPolicyInstance,
    REACTION_POLICY_PRODUCER_KIND,
    REACTION_POLICY_INSTANCE_SCHEMA_V1,
} from '../../music_adaptation/policy/reactionPolicyInstances.v1';

/**
 * Headless orchestration: each sensing frame is ingested into the cue ring; compile ticks read the last analysis window.
 *
 * @param {{
 *   policyBundleRef: React.MutableRefObject<import('../../music_adaptation/policy/reactionPolicyBundle').ReactionPolicyBundleSnapshot>,
 *   stream?: MediaStream | null,
 *   sensingSessionName?: string,
 *   sensingSizeMode?: 'large' | 'small',
 *   autoStartLandmarkTick?: number,
 *   forceStopDetectionTick?: number,
 *   enabled?: boolean,
 *   nodTrackBpmAudioRef?: React.MutableRefObject<HTMLAudioElement | null>,
 *   onReactionOutput?: (payload: {
 *     recommendation: unknown,
 *     playbackCommands: object[],
 *     playbackIntents: object[],
 *   }) => void,
 *   thumbBpmControlRef?: React.MutableRefObject<import('../test_player/modeCThumbTempoOverride').ThumbBpmControlHandle>,
 *   enableSensingOverlayOnScan?: boolean,
 * }} props
 */
const AdaptationOrchestrator = ({
    policyBundleRef,
    stream = null,
    sensingSessionName = 'player_session',
    sensingSizeMode = 'large',
    autoStartLandmarkTick = 0,
    forceStopDetectionTick = 0,
    enabled = true,
    enableSensingOverlayOnScan = true,
    nodTrackBpmAudioRef,
    onReactionOutput,
    thumbBpmControlRef,
}) => {
    const { bufferRef } = useCueTimeline({ retentionMs: CUE_RING_RETENTION_MS });
    const reactionSensingFeedRef = useRef(emptyReactionSensingFeedSnapshot());
    const prevDominantFaceToneRef = useRef(null);
    const persistentThumbBpmStateRef = useRef({
        persistentDeltaBpm: 0,
        prevThumbUpActive: false,
        prevThumbDownActive: false,
    });

    const handleSensingFeedFrame = useCallback(
        (snap) => {
            const normalized = normalizeReactionSensingFeed(snap);
            reactionSensingFeedRef.current = normalized;
            const nowMs = Date.now();
            ingestSensingFeedIntoBuffer(bufferRef.current, normalized, nowMs);
        },
        [bufferRef],
    );

    usePlaybackPolicy({
        policyBundleRef,
        bufferRef,
        prevDominantFaceToneRef,
        persistentThumbBpmStateRef,
        latestSensingFeedRef: reactionSensingFeedRef,
        analysisWindowMs: EMOTION_ANALYSIS_WINDOW,
        sampleHz: CUE_RING_SAMPLE_HZ,
        updateIntervalMs: REACTION_MAPPER_UPDATE_INTERVAL,
        onReactionOutput,
        enabled,
        nodTrackBpmAudioRef,
    });

    const flushReactionCompile = useCallback(() => {
        const raw = nodTrackBpmAudioRef?.current?.detectedTrackBpm;
        const nodTrackBpm =
            typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null;
        return runReactionCompile({
            buffer: bufferRef.current,
            policyBundle: policyBundleRef.current,
            prevDominantFaceToneRef,
            persistentThumbBpmStateRef,
            analysisWindowMs: EMOTION_ANALYSIS_WINDOW,
            sampleHz: CUE_RING_SAMPLE_HZ,
            nowMs: Date.now(),
            nodTrackBpm,
            latestSensingFeed: reactionSensingFeedRef.current,
        });
    }, [bufferRef, policyBundleRef, nodTrackBpmAudioRef]);

    useEffect(() => {
        if (!thumbBpmControlRef) {
            return undefined;
        }
        thumbBpmControlRef.current = {
            applyStep: (direction, options = {}) => {
                const stepBpm = resolveThumbTempoStepBpm(policyBundleRef.current);
                applyThumbTempoStep(persistentThumbBpmStateRef.current, direction, stepBpm);
                const output = flushReactionCompile();
                if (onReactionOutput && output) {
                    onReactionOutput({
                        ...output,
                        tempoChangeSource: options.source === 'button' ? 'button' : 'thumb',
                        tempoDirection: direction,
                    });
                }
            },
        };
        return () => {
            thumbBpmControlRef.current = null;
        };
    }, [thumbBpmControlRef, flushReactionCompile, onReactionOutput, policyBundleRef]);

    useEffect(() => {
        if (!isSensingDebugEnabled()) return undefined;
        const intervalMs = 500;
        const id = window.setInterval(() => {
            if (!isSensingDebugEnabled()) return;
            emitCueTensorDebugSnapshot(
                {
                    ...reactionSensingFeedRef.current,
                    windowMs: 1000,
                    targetHz: 10,
                },
                { label: 'player.CueTensor' },
            );
        }, intervalMs);
        return () => window.clearInterval(id);
    }, []);

    if (!stream) return null;

    return (
        <UnifiedSensingUserUI
            stream={stream}
            embeddingTW={false}
            sessionName={sensingSessionName}
            onSensingFeedFrame={handleSensingFeedFrame}
            sizeMode={sensingSizeMode}
            autoStartLandmarkTick={autoStartLandmarkTick}
            forceStopDetectionTick={forceStopDetectionTick}
            enableSensingOverlayOnScan={enableSensingOverlayOnScan}
        />
    );
};

export default AdaptationOrchestrator;
