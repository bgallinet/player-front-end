/**
 * Detect changes to combined reaction compile output (recommendation + intents + playback commands).
 */

import { reactionRecommendationsDiffer } from './recommendationDiff';
import { playbackCommandsSequencesDiffer } from '../../playback/commands/playbackCommandV1';
import { playbackIntentsSequencesDiffer } from '../../playback/intents/playbackIntentsDiff';

/**
 * @param {{ recommendation: unknown, playbackCommands?: unknown[], playbackIntents?: unknown[] }} next
 * @param {{ recommendation: unknown, playbackCommands?: unknown[], playbackIntents?: unknown[] }} prev
 */
export function reactionOutputsDiffer(next, prev) {
    if (!prev) return true;
    if (!next) return true;

    const recA = next.recommendation ?? null;
    const recB = prev.recommendation ?? null;

    if (reactionRecommendationsDiffer(recA, recB)) return true;
    if (playbackCommandsSequencesDiffer(next.playbackCommands, prev.playbackCommands)) return true;
    if (playbackIntentsSequencesDiffer(next.playbackIntents, prev.playbackIntents)) return true;

    return false;
}
