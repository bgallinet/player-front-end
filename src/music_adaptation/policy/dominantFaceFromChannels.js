/**
 * Dominant face tone from smoothed vision cue channels (hysteresis).
 */

import {
    THRESHOLD_JAW_OPEN,
    THRESHOLD_JAW_OPEN_LOW,
    THRESHOLD_SMILING,
    THRESHOLD_SMILING_LOW,
} from '../ReactionMapperConfig';
import { DOMINANT_FACE_TONE } from './reactionPlaybackProfiles.v1';

/**
 * @param {Record<string, number>} meanWindowChannels keyed by cue schema ids
 * @param {string | null | undefined} previousDominantFaceTone for hysteresis
 * @returns {'happy'|'mouthOpen'|'neutral'}
 */
export function analyzeDominantFaceToneFromChannelMeans(meanWindowChannels, previousDominantFaceTone) {
    const avgSmiling = Number(meanWindowChannels['vision.face.smiling']) || 0;
    const avgJawOpen = Number(meanWindowChannels['vision.face.jaw_open']) || 0;

    const currentEmotion = previousDominantFaceTone;

    const shouldSwitchToHappy = avgSmiling > THRESHOLD_SMILING;
    const shouldSwitchToMouthOpen = avgJawOpen > THRESHOLD_JAW_OPEN;

    const shouldSwitchAwayFromHappy =
        currentEmotion === DOMINANT_FACE_TONE.HAPPY && avgSmiling < THRESHOLD_SMILING_LOW;
    const shouldSwitchAwayFromMouthOpen =
        currentEmotion === DOMINANT_FACE_TONE.MOUTH_OPEN && avgJawOpen < THRESHOLD_JAW_OPEN_LOW;

    /** @type {'happy'|'mouthOpen'|'neutral'} */
    let dominant = DOMINANT_FACE_TONE.NEUTRAL;

    if (shouldSwitchToHappy && !shouldSwitchAwayFromHappy) {
        dominant = DOMINANT_FACE_TONE.HAPPY;
    } else if (shouldSwitchToMouthOpen && !shouldSwitchAwayFromMouthOpen) {
        dominant = DOMINANT_FACE_TONE.MOUTH_OPEN;
    } else if (currentEmotion === DOMINANT_FACE_TONE.HAPPY && !shouldSwitchAwayFromHappy) {
        dominant = DOMINANT_FACE_TONE.HAPPY;
    } else if (currentEmotion === DOMINANT_FACE_TONE.MOUTH_OPEN && !shouldSwitchAwayFromMouthOpen) {
        dominant = DOMINANT_FACE_TONE.MOUTH_OPEN;
    }

    return dominant;
}
