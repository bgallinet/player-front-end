/**
 * Client-side playback profile arbitration (sensing → profile id).
 * Policy *tables* come from the server bundle; this module only picks which row applies.
 */

import { THRESHOLD_NODDING } from '../ReactionMapperConfig';

/** Dominant face tone from vision channels (before nod/gesture arbitration). */
export const DOMINANT_FACE_TONE = Object.freeze({
    NEUTRAL: 'neutral',
    SMILING: 'smiling',
    JAW_OPEN: 'jawOpen',
});

/**
 * Stable ids for ManualMapping keys and recommendation.playbackProfile.
 * @readonly
 */
export const REACTION_PLAYBACK_PROFILE = Object.freeze({
    NODDING_SMILING: 'reaction.profile.v1.nodding_smiling',
    NODDING_JAW_OPEN: 'reaction.profile.v1.nodding_jawOpen',
    NODDING_NEUTRAL: 'reaction.profile.v1.nodding_neutral',
    THUMB_DOWN_HANDS_RAISED: 'reaction.profile.v1.thumb_down_hands_raised',
    THUMB_UP_HANDS_RAISED: 'reaction.profile.v1.thumb_up_hands_raised',
    HANDS_RAISED: 'reaction.profile.v1.hands_raised',
    THUMB_DOWN: 'reaction.profile.v1.thumb_down',
    THUMB_UP: 'reaction.profile.v1.thumb_up',
    SMILING: 'reaction.profile.v1.smiling',
    JAW_OPEN: 'reaction.profile.v1.jawOpen',
    NEUTRAL: 'reaction.profile.v1.neutral',
});

export const NODDING_VOLUME_PLAYBACK_PROFILES = new Set([
    REACTION_PLAYBACK_PROFILE.NODDING_SMILING,
    REACTION_PLAYBACK_PROFILE.NODDING_JAW_OPEN,
    REACTION_PLAYBACK_PROFILE.NODDING_NEUTRAL,
]);

export function playbackProfileUsesNoddingVolume(profileId) {
    return NODDING_VOLUME_PLAYBACK_PROFILES.has(profileId);
}

export const REACTION_PLAYBACK_PROFILE_UI_ROWS = Object.freeze([
    { id: REACTION_PLAYBACK_PROFILE.NODDING_SMILING, label: 'Nodding + Smiling' },
    { id: REACTION_PLAYBACK_PROFILE.NODDING_JAW_OPEN, label: 'Nodding + Jaw open' },
    { id: REACTION_PLAYBACK_PROFILE.NODDING_NEUTRAL, label: 'Nodding + Neutral' },
    { id: REACTION_PLAYBACK_PROFILE.THUMB_UP, label: 'Thumb up' },
    { id: REACTION_PLAYBACK_PROFILE.THUMB_DOWN, label: 'Thumb down' },
    { id: REACTION_PLAYBACK_PROFILE.THUMB_UP_HANDS_RAISED, label: 'Thumb up + Hands raised' },
    { id: REACTION_PLAYBACK_PROFILE.THUMB_DOWN_HANDS_RAISED, label: 'Thumb down + Hands raised' },
    { id: REACTION_PLAYBACK_PROFILE.HANDS_RAISED, label: 'Hands raised' },
    { id: REACTION_PLAYBACK_PROFILE.SMILING, label: 'Smiling' },
    { id: REACTION_PLAYBACK_PROFILE.JAW_OPEN, label: 'Jaw open' },
    { id: REACTION_PLAYBACK_PROFILE.NEUTRAL, label: 'Neutral' },
]);

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
        if (dominantFaceTone === DOMINANT_FACE_TONE.SMILING) return REACTION_PLAYBACK_PROFILE.NODDING_SMILING;
        if (dominantFaceTone === DOMINANT_FACE_TONE.JAW_OPEN) return REACTION_PLAYBACK_PROFILE.NODDING_JAW_OPEN;
        return REACTION_PLAYBACK_PROFILE.NODDING_NEUTRAL;
    }

    if (dominantFaceTone === DOMINANT_FACE_TONE.SMILING) return REACTION_PLAYBACK_PROFILE.SMILING;
    if (dominantFaceTone === DOMINANT_FACE_TONE.JAW_OPEN) return REACTION_PLAYBACK_PROFILE.JAW_OPEN;
    return REACTION_PLAYBACK_PROFILE.NEUTRAL;
}
