import AnalyticsAPI from './AnalyticsAPI';
import { getSessionNameFromUrl } from '../hooks/sessionUtils.js';

/**
 * Fire-and-forget: persist analyzed BPM (title, artist, bpm) via analytics API.
 */
export async function reportTrackBpmToAnalytics({
    title,
    artist,
    bpm,
    bpmSource,
    spotifyId,
    isrc,
    trackId,
    sessionName,
    playlistId,
    playlistName,
    positionIndex,
    albumName,
    durationMs,
    metadata,
} = {}) {
    const bpmNum = Number(bpm);
    const titleStr = title != null ? String(title).trim() : '';
    const artistStr = artist != null ? String(artist).trim() : '';
    if (!titleStr || !artistStr || !Number.isFinite(bpmNum) || bpmNum <= 0) {
        return;
    }

    const body = JSON.stringify({
        request_type: 'analytics',
        interaction_type: 'track_bpm_record',
        session_name: sessionName || getSessionNameFromUrl() || 'unknown',
        title: titleStr,
        artist: artistStr,
        bpm: Math.round(bpmNum),
        bpm_source: bpmSource || 'unknown',
        spotify_id: spotifyId || undefined,
        isrc: isrc || undefined,
        track_id: trackId || undefined,
        playlist_id: playlistId || undefined,
        playlist_name: playlistName || undefined,
        position_index: positionIndex != null ? positionIndex : undefined,
        album_name: albumName || undefined,
        duration_ms: durationMs != null ? durationMs : undefined,
        metadata: metadata || undefined,
    });

    try {
        const apiResult = await AnalyticsAPI(body, false);
        const envelope = JSON.parse(apiResult.body);
        const statusCode = envelope.statusCode ?? 500;
        if (statusCode !== 200) {
            const innerRaw = envelope.body;
            const inner =
                typeof innerRaw === 'string' ? JSON.parse(innerRaw) : innerRaw;
            console.warn('[reportTrackBpmToAnalytics] failed', statusCode, inner);
        }
    } catch (err) {
        console.warn('[reportTrackBpmToAnalytics]', err?.message || err);
    }
}
