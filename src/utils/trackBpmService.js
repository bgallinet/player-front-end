import EnvironmentVariables from './EnvironmentVariables';

/**
 * Resolve track BPM from backend (MusicBrainz + GetSongBPM, cached in DB).
 * @returns {Promise<{ bpm: number|null, bpmSource: string|null, cached: boolean }>}
 */
export async function fetchTrackBpmFromCatalog({
    spotifyId,
    isrc,
    title,
    artist,
    signal,
} = {}) {
    const hasIsrc = Boolean(isrc);
    const hasTitleArtist = Boolean(title && artist);
    if (!hasIsrc && !hasTitleArtist) {
        return { bpm: null, bpmSource: null, cached: false };
    }

    const response = await fetch(EnvironmentVariables.InfoAPI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
            request_type: 'info',
            info_type: 'track_bpm',
            spotify_id: spotifyId || undefined,
            isrc: isrc || undefined,
            title: title || undefined,
            artist: artist || undefined,
        }),
    });

    if (!response.ok) {
        return { bpm: null, bpmSource: null, cached: false };
    }

    const payload = await response.json().catch(() => ({}));
    const bpm = Number(payload?.bpm);
    return {
        bpm: Number.isFinite(bpm) && bpm > 0 ? Math.round(bpm) : null,
        bpmSource: payload?.bpm_source || null,
        cached: Boolean(payload?.cached),
    };
}

export function extractTrackBpmLookupFields(track) {
    const sp = track?.spTrack || {};
    const artists = (sp.artists || []).map((a) => a.name).filter(Boolean);
    return {
        spotifyId: track?.id || sp.id || null,
        isrc: sp.external_ids?.isrc || track?.isrc || null,
        title: track?.title || sp.name || null,
        artist: track?.artist || artists.join(', ') || null,
    };
}
