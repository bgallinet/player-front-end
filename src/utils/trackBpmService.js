import EnvironmentVariables from '../EnvironmentVariables';
import { bpmLog, bpmLogAttempts } from './bpmPipelineLog';

/**
 * Resolve track BPM from backend (MusicBrainz + GetSongBPM, cached in DB).
 * @returns {Promise<{ bpm: number|null, bpmSource: string|null, cached: boolean, attempts?: object[] }>}
 */
export async function fetchTrackBpmFromCatalog({
    spotifyId,
    isrc,
    title,
    artist,
    signal,
    trackLabel,
} = {}) {
    const label = trackLabel || title || spotifyId || 'unknown track';
    const hasIsrc = Boolean(isrc);
    const hasTitleArtist = Boolean(title && artist);

    if (!hasIsrc && !hasTitleArtist) {
        bpmLog('warn', 'catalog', `${label}: skipped backend — need ISRC or title+artist`, {
            spotifyId,
            isrc: isrc || null,
            title: title || null,
            artist: artist || null,
        });
        return { bpm: null, bpmSource: null, cached: false, attempts: [] };
    }

    bpmLog('info', 'catalog', `${label}: POST /info track_bpm`, {
        spotifyId: spotifyId || null,
        isrc: isrc || null,
        title: title || null,
        artist: artist || null,
    });

    let response;
    try {
        response = await fetch(EnvironmentVariables.InfoAPI_URL, {
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
    } catch (err) {
        bpmLog('error', 'catalog', `${label}: /info request failed`, {
            error: err?.message || String(err),
        });
        return { bpm: null, bpmSource: null, cached: false, attempts: [] };
    }

    if (!response.ok) {
        let body = '';
        try {
            body = await response.text();
        } catch {
            // ignore
        }
        bpmLog('warn', 'catalog', `${label}: /info HTTP ${response.status}`, { body: body.slice(0, 200) });
        return { bpm: null, bpmSource: null, cached: false, attempts: [] };
    }

    const payload = await response.json().catch(() => ({}));
    const attempts = Array.isArray(payload?.attempts) ? payload.attempts : [];
    bpmLogAttempts(label, attempts);

    const bpm = Number(payload?.bpm);
    const resolved = Number.isFinite(bpm) && bpm > 0 ? Math.round(bpm) : null;

    if (resolved) {
        bpmLog('info', 'catalog', `${label}: catalog hit → ${resolved} BPM (${payload?.bpm_source || '?'})`, {
            cached: Boolean(payload?.cached),
            bpmSource: payload?.bpm_source,
        });
    } else {
        bpmLog('warn', 'catalog', `${label}: catalog miss — will try preview fallback if available`, {
            cached: Boolean(payload?.cached),
        });
    }

    return {
        bpm: resolved,
        bpmSource: payload?.bpm_source || null,
        cached: Boolean(payload?.cached),
        attempts,
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
