/**
 * Gesture cue adapter — maps Player gesture booleans to schema v1 channels.
 * Thumb-down arbitration matches sensing (down suppresses up).
 */

import { GESTURE_ACTIVE_MEAN_THRESHOLD as DEFAULT_GESTURE_THRESHOLD } from '../../hooks/ReactionMapperConfig';

/**
 * Maps gesture channel means (over {@link EMOTION_ANALYSIS_WINDOW}) to booleans for profile arbitration.
 * Thumb-down wins over thumb-up when both exceed the threshold (same ordering as {@link gestureCuePatchFromFlags}).
 *
 * @param {Record<string, number>} meanWindow
 * @param {number} [threshold]
 * @returns {{ handsRaised: boolean, thumbUpActive: boolean, thumbDownActive: boolean }}
 */
export function gestureBooleansFromMeanWindow(meanWindow, threshold = DEFAULT_GESTURE_THRESHOLD) {
    const th = typeof threshold === 'number' && Number.isFinite(threshold) ? threshold : DEFAULT_GESTURE_THRESHOLD;
    const td = Number(meanWindow['gesture.thumb_down']) || 0;
    const tu = Number(meanWindow['gesture.thumb_up']) || 0;
    const hr = Number(meanWindow['gesture.hands_raised']) || 0;
    const thumbDownActive = td >= th;
    const thumbUpActive = !thumbDownActive && tu >= th;
    const handsRaised = hr >= th;
    return { handsRaised, thumbUpActive, thumbDownActive };
}

/**
 * @param {{
 *   handsRaised?: boolean,
 *   thumbUpActive?: boolean,
 *   thumbDownActive?: boolean,
 * }} flags
 * @returns {Record<string, number>}
 */
export function gestureCuePatchFromFlags(flags = {}) {
    const hands = !!flags.handsRaised;
    const thumbDown = !!flags.thumbDownActive;
    const thumbUp = !thumbDown && !!flags.thumbUpActive;

    return {
        'gesture.hands_raised': hands ? 1 : 0,
        'gesture.thumb_up': thumbUp ? 1 : 0,
        'gesture.thumb_down': thumbDown ? 1 : 0,
    };
}
