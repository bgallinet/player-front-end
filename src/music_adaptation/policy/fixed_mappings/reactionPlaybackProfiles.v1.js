/**
 * Canonical playback profiles — one stable id per mutually exclusive sensing→audio regime.
 * Nothing here concatenates cues at runtime; the compiler picks exactly one profile id via {@link deriveReactionPlaybackProfile}.
 */

import { THRESHOLD_NODDING } from '../../../hooks/ReactionMapperConfig';

/** Dominant face tone from vision channels (before nod/gesture arbitration). */
export const DOMINANT_FACE_TONE = Object.freeze({
    NEUTRAL: 'neutral',
    HAPPY: 'happy',
    MOUTH_OPEN: 'mouthOpen',
});

/**
 * Stable ids for ManualMapping keys and recommendation.playbackProfile.
 * @readonly
 */
export const REACTION_PLAYBACK_PROFILE = Object.freeze({
    NODDING_HAPPY: 'reaction.profile.v1.nodding_happy',
    NODDING_MOUTH_OPEN: 'reaction.profile.v1.nodding_mouth_open',
    NODDING_NEUTRAL: 'reaction.profile.v1.nodding_neutral',
    THUMB_DOWN_HANDS_RAISED: 'reaction.profile.v1.thumb_down_hands_raised',
    THUMB_UP_HANDS_RAISED: 'reaction.profile.v1.thumb_up_hands_raised',
    HANDS_RAISED: 'reaction.profile.v1.hands_raised',
    THUMB_DOWN: 'reaction.profile.v1.thumb_down',
    THUMB_UP: 'reaction.profile.v1.thumb_up',
    HAPPY: 'reaction.profile.v1.happy',
    MOUTH_OPEN: 'reaction.profile.v1.mouth_open',
    NEUTRAL: 'reaction.profile.v1.neutral',
});

/** Profiles whose volume multiplier is modulated by nodding amplitude in SoundConsole. */
export const NODDING_VOLUME_PLAYBACK_PROFILES = new Set([
    REACTION_PLAYBACK_PROFILE.NODDING_HAPPY,
    REACTION_PLAYBACK_PROFILE.NODDING_MOUTH_OPEN,
    REACTION_PLAYBACK_PROFILE.NODDING_NEUTRAL,
]);

export function playbackProfileUsesNoddingVolume(profileId) {
    return NODDING_VOLUME_PLAYBACK_PROFILES.has(profileId);
}

/** UI row order / labels — keys are {@link REACTION_PLAYBACK_PROFILE} values. */
export const REACTION_PLAYBACK_PROFILE_UI_ROWS = Object.freeze([
    { id: REACTION_PLAYBACK_PROFILE.NODDING_HAPPY, label: 'Nodding + Smiling' },
    { id: REACTION_PLAYBACK_PROFILE.NODDING_MOUTH_OPEN, label: 'Nodding + Mouth open' },
    { id: REACTION_PLAYBACK_PROFILE.NODDING_NEUTRAL, label: 'Nodding + Neutral' },
    { id: REACTION_PLAYBACK_PROFILE.THUMB_UP, label: 'Thumb up' },
    { id: REACTION_PLAYBACK_PROFILE.THUMB_DOWN, label: 'Thumb down' },
    { id: REACTION_PLAYBACK_PROFILE.THUMB_UP_HANDS_RAISED, label: 'Thumb up + Hands raised' },
    { id: REACTION_PLAYBACK_PROFILE.THUMB_DOWN_HANDS_RAISED, label: 'Thumb down + Hands raised' },
    { id: REACTION_PLAYBACK_PROFILE.HANDS_RAISED, label: 'Hands raised' },
    { id: REACTION_PLAYBACK_PROFILE.HAPPY, label: 'Smiling' },
    { id: REACTION_PLAYBACK_PROFILE.MOUTH_OPEN, label: 'Mouth open' },
    { id: REACTION_PLAYBACK_PROFILE.NEUTRAL, label: 'Neutral' },
]);

/**
 * Arbitration order: gestures / hands → thumbs → nodding + face tone → face-only.
 * Returns one {@link REACTION_PLAYBACK_PROFILE} id or null.
 *
 * @param {{
 *   dominantFaceTone: string | null,
 *   noddingAmplitude: number,
 *   handsRaised: boolean,
 *   thumbUpActive: boolean,
 *   thumbDownActive: boolean,
 * }} args
 * @returns {string|null}
 */
export function deriveReactionPlaybackProfile(args) {
    const { dominantFaceTone, noddingAmplitude, handsRaised, thumbUpActive, thumbDownActive } = args;

    const nod =
        typeof noddingAmplitude === 'number' &&
        !Number.isNaN(noddingAmplitude) &&
        Number.isFinite(noddingAmplitude) &&
        noddingAmplitude > THRESHOLD_NODDING;

    if (handsRaised && thumbDownActive) return REACTION_PLAYBACK_PROFILE.THUMB_DOWN_HANDS_RAISED;
    if (handsRaised && thumbUpActive) return REACTION_PLAYBACK_PROFILE.THUMB_UP_HANDS_RAISED;
    if (handsRaised) return REACTION_PLAYBACK_PROFILE.HANDS_RAISED;
    if (thumbDownActive) return REACTION_PLAYBACK_PROFILE.THUMB_DOWN;
    if (thumbUpActive) return REACTION_PLAYBACK_PROFILE.THUMB_UP;

    if (!dominantFaceTone) return null;

    if (nod) {
        if (dominantFaceTone === DOMINANT_FACE_TONE.HAPPY) return REACTION_PLAYBACK_PROFILE.NODDING_HAPPY;
        if (dominantFaceTone === DOMINANT_FACE_TONE.MOUTH_OPEN) return REACTION_PLAYBACK_PROFILE.NODDING_MOUTH_OPEN;
        return REACTION_PLAYBACK_PROFILE.NODDING_NEUTRAL;
    }

    if (dominantFaceTone === DOMINANT_FACE_TONE.HAPPY) return REACTION_PLAYBACK_PROFILE.HAPPY;
    if (dominantFaceTone === DOMINANT_FACE_TONE.MOUTH_OPEN) return REACTION_PLAYBACK_PROFILE.MOUTH_OPEN;
    return REACTION_PLAYBACK_PROFILE.NEUTRAL;
}
