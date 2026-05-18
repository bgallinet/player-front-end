import { detectBpmFromPreviewUrl } from './detectBpmFromUrl';
import { getTrack } from './spotifyService';
import { extractTrackBpmLookupFields, fetchTrackBpmFromCatalog } from './trackBpmService';

export const TRACK_BPM_DETECTED_EVENT = 'trackbpm-detected';

export function getTrackPreviewUrl(track) {
    return track?.preview_url || track?.spTrack?.preview_url || null;
}

export function dispatchTrackBpmDetected(audioEl, bpm) {
    if (!audioEl || !Number.isFinite(bpm) || bpm <= 0) return;
    audioEl.detectedTrackBpm = bpm;
    audioEl.dispatchEvent(new CustomEvent(TRACK_BPM_DETECTED_EVENT, { detail: { bpm } }));
}

async function resolvePreviewUrl(track, accessToken, market) {
    let previewUrl = getTrackPreviewUrl(track);
    let spTrack = track?.spTrack;

    if (!previewUrl && accessToken && track?.id) {
        const marketsToTry = [market, undefined].filter((m, i, arr) => m !== arr[i - 1]);
        for (const m of marketsToTry) {
            try {
                const full = await getTrack(track.id, accessToken, m);
                if (full?.preview_url) {
                    previewUrl = full.preview_url;
                    spTrack = full;
                    break;
                }
                if (!spTrack && full) spTrack = full;
            } catch {
                // try next market / bare request
            }
        }
    }

    return { previewUrl, spTrack };
}

function applyBpmFields(track, bpm, bpmSource, spTrack, previewUrl) {
    return {
        ...track,
        spTrack: spTrack || track.spTrack,
        preview_url: previewUrl ?? track.preview_url ?? null,
        bpm,
        track_bpm: bpm,
        bpmSource,
        bpmPending: false,
    };
}

/**
 * Resolve BPM: public catalog (MusicBrainz + GetSongBPM) then 30s preview analysis.
 */
export async function enrichSpotifyTrackWithBpm(
    track,
    { accessToken, market, signal, allowMediaElement = true } = {},
) {
    if (!track) return track;

    const existing = Number(track.bpm ?? track.track_bpm);
    if (Number.isFinite(existing) && existing > 0) {
        return track;
    }

    const lookup = extractTrackBpmLookupFields(track);
    const catalog = await fetchTrackBpmFromCatalog({ ...lookup, signal });
    if (catalog.bpm) {
        return applyBpmFields(track, catalog.bpm, catalog.bpmSource || 'catalog', track.spTrack, track.preview_url);
    }

    return enrichSpotifyTrackWithPreviewBpm(track, {
        accessToken,
        market,
        signal,
        allowMediaElement,
    });
}

/**
 * Add `bpm` / `track_bpm` from Spotify's 30s preview via web-audio-beat-detector.
 */
export async function enrichSpotifyTrackWithPreviewBpm(
    track,
    { accessToken, market, signal, allowMediaElement = true } = {},
) {
    if (!track) return track;

    const existing = Number(track.bpm ?? track.track_bpm);
    if (Number.isFinite(existing) && existing > 0) {
        return track;
    }

    const { previewUrl, spTrack } = await resolvePreviewUrl(track, accessToken, market);
    const base = {
        ...track,
        spTrack: spTrack || track.spTrack,
        preview_url: previewUrl || track.preview_url || null,
    };

    if (!previewUrl) {
        return base;
    }

    const bpm = await detectBpmFromPreviewUrl(previewUrl, {
        signal,
        allowMediaElement,
    });

    if (!bpm) {
        return base;
    }

    return applyBpmFields(base, bpm, 'preview', spTrack, previewUrl);
}
