/**
 * Session-scoped "now playing" state for analytics metadata enrichment.
 */

let activePlayback = {
    track_id: null,
    song_name: null,
    song_artist: null,
    isPlaying: false,
};

/**
 * @param {{
 *   track_id?: string|null,
 *   trackId?: string|null,
 *   song_name?: string|null,
 *   trackName?: string|null,
 *   song_artist?: string|null,
 *   trackArtist?: string|null,
 *   isPlaying?: boolean,
 * }|null} next
 */
export function setActivePlaybackTrack(next) {
    if (!next) {
        activePlayback = {
            track_id: null,
            song_name: null,
            song_artist: null,
            isPlaying: false,
        };
        return;
    }
    const trackId = next.track_id ?? next.trackId ?? null;
    activePlayback = {
        track_id: trackId != null && String(trackId).trim() ? String(trackId).trim() : null,
        song_name: next.song_name ?? next.trackName ?? null,
        song_artist: next.song_artist ?? next.trackArtist ?? null,
        isPlaying: Boolean(next.isPlaying),
    };
}

export function getActivePlaybackTrack() {
    return { ...activePlayback };
}

/** Fields to merge into analytics `metadata` while audio is playing. */
export function playbackFieldsForAnalytics() {
    if (!activePlayback.isPlaying || !activePlayback.track_id) {
        return {};
    }
    const fields = { track_id: activePlayback.track_id };
    if (activePlayback.song_name) {
        fields.song_name = activePlayback.song_name;
    }
    if (activePlayback.song_artist) {
        fields.song_artist = activePlayback.song_artist;
    }
    return fields;
}
