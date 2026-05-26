/** Shared helpers: match Spotify playlist rows to catalog track_ids (title + artist). */

/** @param {object} track */
export function resolveCatalogTrackId(track) {
    return String(track?.songId ?? track?.track_id ?? track?.trackId ?? '').trim();
}

/**
 * Reorder (and subset) tracks to match `trackIds` order.
 * @param {object[]} tracks
 * @param {string[]} trackIds
 * @param {(track: object) => string} [getTrackId]
 */
export function buildSequencePlaylist(tracks, trackIds, getTrackId = resolveCatalogTrackId) {
    if (!Array.isArray(tracks) || tracks.length === 0) {
        return [];
    }
    if (!Array.isArray(trackIds) || trackIds.length === 0) {
        return [...tracks];
    }

    const byId = new Map();
    for (const track of tracks) {
        const id = getTrackId(track);
        if (id) {
            byId.set(id, track);
        }
    }

    const ordered = [];
    const missing = [];
    for (const rawId of trackIds) {
        const id = String(rawId || '').trim();
        if (!id) continue;
        const match = byId.get(id);
        if (match) {
            ordered.push(match);
        } else {
            missing.push(id);
        }
    }

    if (missing.length > 0) {
        console.warn('[experiment] Sequence tracks missing from playlist:', missing);
    }
    return ordered.length > 0 ? ordered : [...tracks];
}

const normalizeMatchText = (value) =>
    String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

function titlesMatch(wantTitle, gotTitle) {
    if (!wantTitle || !gotTitle) return false;
    if (wantTitle === gotTitle) return true;
    return gotTitle.includes(wantTitle) || wantTitle.includes(gotTitle);
}

function artistsMatch(wantArtist, gotArtist) {
    if (!wantArtist || !gotArtist) return true;
    if (wantArtist === gotArtist) return true;
    return gotArtist.includes(wantArtist) || wantArtist.includes(gotArtist);
}

/**
 * @param {object[]} spotifyTracks — from normalizeTrack()
 * @param {object[]} catalogTracks — rows from /info songs
 * @param {string[]} trackIds
 */
export function matchSpotifyTracksToSequence(spotifyTracks, catalogTracks, trackIds) {
    if (!Array.isArray(trackIds) || trackIds.length === 0) {
        return Array.isArray(spotifyTracks) ? [...spotifyTracks] : [];
    }

    const catalogById = new Map();
    for (const row of catalogTracks || []) {
        const id = String(row?.id ?? row?.track_id ?? row?.trackId ?? '').trim();
        if (id) {
            catalogById.set(id, row);
        }
    }

    const ordered = [];
    const missing = [];
    const usedSpotifyIds = new Set();

    for (const rawId of trackIds) {
        const id = String(rawId || '').trim();
        const catalog = catalogById.get(id);
        if (!catalog) {
            missing.push(id);
            continue;
        }
        const wantTitle = normalizeMatchText(catalog.title ?? catalog.Title);
        const wantArtist = normalizeMatchText(catalog.artist ?? catalog.Artist);
        const match = (spotifyTracks || []).find((track) => {
            const spotifyId = track?.id || track?.spTrack?.id;
            if (spotifyId && usedSpotifyIds.has(spotifyId)) return false;
            const title = normalizeMatchText(track?.title);
            const artist = normalizeMatchText(track?.artist);
            if (!titlesMatch(wantTitle, title)) return false;
            return artistsMatch(wantArtist, artist);
        });
        if (match) {
            const spotifyId = match?.id || match?.spTrack?.id;
            if (spotifyId) usedSpotifyIds.add(spotifyId);
            ordered.push({
                ...match,
                songId: id,
                bpm: match.bpm ?? catalog.bpm ?? catalog.BPM,
            });
        } else {
            missing.push(id);
        }
    }

    if (missing.length > 0) {
        console.warn('[experiment] Spotify playlist missing sequence tracks:', missing);
    }
    return ordered;
}

/**
 * Build a fixed-length sequence row per catalog id (for UI + playback state).
 * Merges Spotify matches with catalog metadata and BPM when available.
 *
 * @param {object[]} spotifyTracks
 * @param {object[]} catalogTracks
 * @param {string[]} trackIds
 */
export function buildFixedSequenceTracks(spotifyTracks, catalogTracks, trackIds) {
    if (!Array.isArray(trackIds) || trackIds.length === 0) {
        return [];
    }

    const matched = matchSpotifyTracksToSequence(spotifyTracks, catalogTracks, trackIds);
    const matchedBySongId = new Map(matched.map((track) => [String(track.songId || '').trim(), track]));

    const catalogById = new Map();
    for (const row of catalogTracks || []) {
        const id = String(row?.id ?? row?.track_id ?? row?.trackId ?? '').trim();
        if (id) {
            catalogById.set(id, row);
        }
    }

    return trackIds.map((rawId) => {
        const songId = String(rawId || '').trim();
        const catalog = catalogById.get(songId);
        const spotify = matchedBySongId.get(songId);
        const catalogBpm = Number(catalog?.bpm ?? catalog?.BPM);
        const spotifyBpm = Number(spotify?.bpm ?? spotify?.track_bpm);

        if (spotify) {
            const bpm = Number.isFinite(spotifyBpm) && spotifyBpm > 0
                ? spotifyBpm
                : Number.isFinite(catalogBpm) && catalogBpm > 0
                  ? catalogBpm
                  : null;
            return {
                ...spotify,
                songId,
                title: spotify.title ?? catalog?.title ?? catalog?.Title ?? songId,
                artist: spotify.artist ?? catalog?.artist ?? catalog?.Artist ?? '',
                bpm: bpm ?? undefined,
                track_bpm: bpm ?? undefined,
                bpmPending: !bpm,
                spotifyMissing: false,
            };
        }

        return {
            songId,
            id: `catalog-${songId}`,
            title: catalog?.title ?? catalog?.Title ?? songId,
            artist: catalog?.artist ?? catalog?.Artist ?? '',
            bpm: Number.isFinite(catalogBpm) && catalogBpm > 0 ? catalogBpm : undefined,
            track_bpm: Number.isFinite(catalogBpm) && catalogBpm > 0 ? catalogBpm : undefined,
            bpmPending: false,
            spotifyMissing: true,
        };
    });
}
