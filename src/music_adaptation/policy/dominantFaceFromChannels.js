/**
 * Dominant face tone from smoothed vision cue channels (hysteresis).
 */

import {
    THRESHOLD_JAW_OPEN,
    THRESHOLD_JAW_OPEN_LOW,
    THRESHOLD_SMILING,
    THRESHOLD_SMILING_LOW,
} from '../ReactionMapperConfig';
import { DOMINANT_FACE_TONE } from './playbackProfiles.v1';

/**
 * @param {Record<string, number>} meanWindowChannels keyed by cue schema ids
 * @param {string | null | undefined} previousDominantFaceTone for hysteresis
 * @returns {'smiling'|'jawOpen'|'neutral'}
 */
export function analyzeDominantFaceToneFromChannelMeans(meanWindowChannels, previousDominantFaceTone) {
    const avgSmiling = Number(meanWindowChannels['vision.face.smiling']) || 0;
    const avgJawOpen = Number(meanWindowChannels['vision.face.jaw_open']) || 0;

    const currentEmotion = previousDominantFaceTone;

    const shouldSwitchToSmiling = avgSmiling > THRESHOLD_SMILING;
    const shouldSwitchToJawOpen = avgJawOpen > THRESHOLD_JAW_OPEN;

    const shouldSwitchAwayFromSmiling =
        currentEmotion === DOMINANT_FACE_TONE.SMILING && avgSmiling < THRESHOLD_SMILING_LOW;
    const shouldSwitchAwayFromJawOpen =
        currentEmotion === DOMINANT_FACE_TONE.JAW_OPEN && avgJawOpen < THRESHOLD_JAW_OPEN_LOW;

    /** @type {'smiling'|'jawOpen'|'neutral'} */
    let dominant = DOMINANT_FACE_TONE.NEUTRAL;

    if (shouldSwitchToSmiling && !shouldSwitchAwayFromSmiling) {
        dominant = DOMINANT_FACE_TONE.SMILING;
    } else if (shouldSwitchToJawOpen && !shouldSwitchAwayFromJawOpen) {
        dominant = DOMINANT_FACE_TONE.JAW_OPEN;
    } else if (currentEmotion === DOMINANT_FACE_TONE.SMILING && !shouldSwitchAwayFromSmiling) {
        dominant = DOMINANT_FACE_TONE.SMILING;
    } else if (currentEmotion === DOMINANT_FACE_TONE.JAW_OPEN && !shouldSwitchAwayFromJawOpen) {
        dominant = DOMINANT_FACE_TONE.JAW_OPEN;
    }

    return dominant;
}
