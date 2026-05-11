import { useEffect, useRef, useCallback } from 'react';
import { runReactionCompile } from '../music_adaptation/policy/runReactionCompile';
import { reactionOutputsDiffer } from '../music_adaptation/policy/reactionOutputDiff';

/**
 * Phase 3 — policy compile tick: ring buffer → recommendation + intents + commands.
 * Sensing frames must be written to `bufferRef` separately (e.g. `ingestSensingFeedIntoBuffer`).
 *
 * @param {{
 *   policyBundleRef: React.MutableRefObject<import('../music_adaptation/policy/reactionPolicyBundle').ReactionPolicyBundleSnapshot>,
 *   bufferRef: React.MutableRefObject<import('../music_adaptation/timeline/CueRingBuffer').CueRingBuffer|null>,
 *   prevDominantFaceToneRef: React.MutableRefObject<string|null>,
 *   persistentThumbBpmStateRef?: React.MutableRefObject<{ persistentDeltaBpm: number, prevThumbUpActive: boolean, prevThumbDownActive: boolean }>,
 *   analysisWindowMs: number,
 *   sampleHz: number,
 *   updateIntervalMs: number,
 *   enabled?: boolean,
 *   onReactionOutput?: (
 *     payload: {
 *       recommendation: unknown,
 *       playbackCommands: unknown[],
 *       playbackIntents: unknown[],
 *     },
 *   ) => void,
 *   nodTrackBpmAudioRef?: React.MutableRefObject<({ detectedTrackBpm?: number | null } & HTMLMediaElement) | null>,
 *   latestSensingFeedRef?: React.MutableRefObject<import('../music_adaptation/feeds/reactionSensingFeed').ReactionSensingFeedSnapshot>,
 * }} args
 */
export function usePlaybackPolicy({
    policyBundleRef,
    bufferRef,
    prevDominantFaceToneRef,
    persistentThumbBpmStateRef,
    analysisWindowMs,
    sampleHz,
    updateIntervalMs,
    onReactionOutput,
    enabled = true,
    nodTrackBpmAudioRef,
    latestSensingFeedRef,
}) {
    const lastOutputRef = useRef(null);

    const tick = useCallback(() => {
        const raw = nodTrackBpmAudioRef?.current?.detectedTrackBpm;
        const nodTrackBpm =
            typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null;
        return runReactionCompile({
            buffer: bufferRef.current,
            policyBundle: policyBundleRef.current,
            prevDominantFaceToneRef,
            persistentThumbBpmStateRef,
            analysisWindowMs,
            sampleHz,
            nowMs: Date.now(),
            nodTrackBpm,
            latestSensingFeed: latestSensingFeedRef?.current,
        });
    }, [policyBundleRef, bufferRef, prevDominantFaceToneRef, persistentThumbBpmStateRef, analysisWindowMs, sampleHz, nodTrackBpmAudioRef, latestSensingFeedRef]);

    useEffect(() => {
        if (!enabled) return undefined;

        const processReactions = () => {
            try {
                const output = tick();
                // Always emit the latest compile output so adaptation remains reactive even when
                // value deltas are subtle and diff heuristics would suppress updates.
                if (reactionOutputsDiffer(output, lastOutputRef.current)) {
                    lastOutputRef.current = output;
                }
                if (onReactionOutput && typeof onReactionOutput === 'function') {
                    onReactionOutput(output);
                }
            } catch {
                /* ignore */
            }
        };

        processReactions();
        const interval = setInterval(processReactions, updateIntervalMs);
        return () => clearInterval(interval);
    }, [onReactionOutput, tick, updateIntervalMs, enabled]);
}
