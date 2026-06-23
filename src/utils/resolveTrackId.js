/**
 * Resolve catalog track_id from a track-like object (matches songs.tracks.track_id).
 * @param {object|null|undefined} source
 * @returns {string|null}
 */
export function resolveTrackIdFromSource(source) {
    if (!source || typeof source !== 'object') {
        return null;
    }
    const keys = ['track_id', 'trackId', 'songId', 'id'];
    for (const key of keys) {
        const value = source[key];
        if (value === null || value === undefined) {
            continue;
        }
        const text = String(value).trim();
        if (text) {
            return text;
        }
    }
    return null;
}

/**
 * @param {...(object|null|undefined)} sources — first match wins
 * @returns {string|null}
 */
export function resolveTrackIdFromSources(...sources) {
    for (const source of sources) {
        const id = resolveTrackIdFromSource(source);
        if (id) {
            return id;
        }
    }
    return null;
}
