import { detectBpmFromPreviewUrl } from './detectBpmFromUrl';
import { getTrack, getTrackAudioFeatures } from './spotifyService';
import { extractTrackBpmLookupFields, fetchTrackBpmFromCatalog } from './trackBpmService';
import { bpmLog, bpmTrackLabel } from './bpmPipelineLog';
import { reportTrackBpmToAnalytics } from './reportTrackBpmToAnalytics';

export const TRACK_BPM_DETECTED_EVENT = 'trackbpm-detected';

export function getTrackPreviewUrl(track) {
    return track?.preview_url || track?.spTrack?.preview_url || null;
}

export function dispatchTrackBpmDetected(audioEl, bpm) {
    if (!audioEl || !Number.isFinite(bpm) || bpm <= 0) return;
    audioEl.detectedTrackBpm = bpm;
    audioEl.dispatchEvent(new CustomEvent(TRACK_BPM_DETECTED_EVENT, { detail: { bpm } }));
}

async function resolvePreviewUrl(track, accessToken, market, label) {
    let previewUrl = getTrackPreviewUrl(track);
    let spTrack = track?.spTrack;

    if (previewUrl) {
        bpmLog('info', 'preview_url', `${label}: using preview_url on track`, { previewUrl });
        return { previewUrl, spTrack };
    }

    if (!accessToken || !track?.id) {
        bpmLog('warn', 'preview_url', `${label}: no preview_url and cannot fetch track from Spotify API`, {
            hasAccessToken: Boolean(accessToken),
            trackId: track?.id || null,
        });
        return { previewUrl: null, spTrack };
    }

    const marketsToTry = [market, undefined].filter((m, i, arr) => m !== arr[i - 1]);
    for (const m of marketsToTry) {
        try {
            bpmLog('info', 'preview_url', `${label}: fetching Spotify track for preview`, {
                market: m || '(default)',
            });
            const full = await getTrack(track.id, accessToken, m);
            if (full?.preview_url) {
                previewUrl = full.preview_url;
                spTrack = full;
                bpmLog('info', 'preview_url', `${label}: got preview_url from Spotify API`, { previewUrl });
                break;
            }
            if (!spTrack && full) spTrack = full;
            bpmLog('warn', 'preview_url', `${label}: Spotify track has no preview_url`, {
                market: m || '(default)',
            });
        } catch (err) {
            bpmLog('warn', 'preview_url', `${label}: Spotify getTrack failed`, {
                market: m || '(default)',
                error: err?.message || String(err),
            });
        }
    }

    return { previewUrl, spTrack };
}

function resolveCatalogTrackId(track) {
    return track?.songId ?? track?.track_id ?? track?.trackId ?? null;
}

function applyBpmFields(track, bpm, bpmSource, spTrack, previewUrl, analyticsContext) {
    const result = {
        ...track,
        spTrack: spTrack || track.spTrack,
        preview_url: previewUrl ?? track.preview_url ?? null,
        bpm,
        track_bpm: bpm,
        bpmSource,
        bpmPending: false,
    };
    const lookup = extractTrackBpmLookupFields(result);
    const sp = result.spTrack || {};
    void reportTrackBpmToAnalytics({
        title: lookup.title,
        artist: lookup.artist,
        bpm,
        bpmSource,
        spotifyId: lookup.spotifyId,
        isrc: lookup.isrc,
        trackId: resolveCatalogTrackId(track),
        sessionName: analyticsContext?.sessionName,
        playlistId: analyticsContext?.playlistId,
        playlistName: analyticsContext?.playlistName,
        positionIndex: analyticsContext?.positionIndex,
        albumName: sp.album?.name,
        durationMs: sp.duration_ms ?? (track.duration ? Math.round(track.duration * 1000) : undefined),
        metadata: analyticsContext?.metadata,
    });
    return result;
}

function mergePipelineFields(track, { spTrack, previewUrl } = {}) {
    return {
        ...track,
        spTrack: spTrack || track.spTrack,
        preview_url: previewUrl ?? track.preview_url ?? null,
    };
}

async function trySpotifyAudioFeaturesBpm(track, accessToken, label) {
    const trackId = track?.id || track?.spTrack?.id;
    if (!accessToken || !trackId) {
        return null;
    }
    try {
        const features = await getTrackAudioFeatures(trackId, accessToken);
        const tempo = Number(features?.tempo);
        if (Number.isFinite(tempo) && tempo > 0) {
            bpmLog('info', 'spotify_features', `${label}: ${Math.round(tempo)} BPM from audio-features`);
            return Math.round(tempo);
        }
        bpmLog('warn', 'spotify_features', `${label}: audio-features has no tempo`);
    } catch (err) {
        bpmLog('warn', 'spotify_features', `${label}: audio-features failed`, {
            error: err?.message || String(err),
        });
    }
    return null;
}

/**
 * Resolve BPM: Spotify audio-features → catalog (MusicBrainz + GetSongBPM) → preview analysis.
 */
export async function enrichSpotifyTrackWithBpm(
    track,
    { accessToken, market, signal, allowMediaElement = true, analyticsContext } = {},
) {
    if (!track) return track;

    const label = bpmTrackLabel(track);
    const existing = Number(track.bpm ?? track.track_bpm);
    if (Number.isFinite(existing) && existing > 0) {
        bpmLog('info', 'skip', `${label}: already has BPM ${existing} (${track.bpmSource || 'unknown source'})`);
        return track;
    }

    bpmLog('info', 'start', `${label}: pipeline start (Spotify → catalog → preview)`);

    let working = track;

    const spotifyBpm = await trySpotifyAudioFeaturesBpm(working, accessToken, label);
    if (spotifyBpm) {
        bpmLog('info', 'done', `${label}: resolved ${spotifyBpm} BPM via spotify_audio_features`);
        return applyBpmFields(
            working,
            spotifyBpm,
            'spotify_audio_features',
            working.spTrack,
            working.preview_url,
            analyticsContext,
        );
    }

    const lookup = extractTrackBpmLookupFields(working);
    bpmLog('info', 'lookup', `${label}: lookup fields`, lookup);

    const catalog = await fetchTrackBpmFromCatalog({ ...lookup, signal, trackLabel: label });
    if (catalog.bpm) {
        bpmLog('info', 'done', `${label}: resolved ${catalog.bpm} BPM via ${catalog.bpmSource}`, {
            cached: catalog.cached,
        });
        return applyBpmFields(
            working,
            catalog.bpm,
            catalog.bpmSource || 'catalog',
            working.spTrack,
            working.preview_url,
            analyticsContext,
        );
    }

    bpmLog('info', 'fallback', `${label}: falling back to preview beat detection`);
    const previewResult = await enrichSpotifyTrackWithPreviewBpm(working, {
        accessToken,
        market,
        signal,
        allowMediaElement,
        analyticsContext,
        _pipelineLabel: label,
    });
    if (previewResult?.bpm) {
        return previewResult;
    }
    return mergePipelineFields(working, {
        spTrack: previewResult?.spTrack,
        previewUrl: previewResult?.preview_url,
    });
}

/**
 * Add `bpm` / `track_bpm` from Spotify's 30s preview via web-audio-beat-detector.
 */
export async function enrichSpotifyTrackWithPreviewBpm(
    track,
    { accessToken, market, signal, allowMediaElement = true, analyticsContext, _pipelineLabel } = {},
) {
    if (!track) return track;

    const label = _pipelineLabel || bpmTrackLabel(track);
    const existing = Number(track.bpm ?? track.track_bpm);
    if (Number.isFinite(existing) && existing > 0) {
        bpmLog('info', 'skip', `${label}: already has BPM ${existing}`);
        return track;
    }

    const { previewUrl, spTrack } = await resolvePreviewUrl(track, accessToken, market, label);
    const base = {
        ...track,
        spTrack: spTrack || track.spTrack,
        preview_url: previewUrl || track.preview_url || null,
    };

    if (!previewUrl) {
        bpmLog('warn', 'done', `${label}: no BPM — no preview URL for beat detection`);
        return base;
    }

    bpmLog('info', 'preview_detect', `${label}: analyzing preview audio`, {
        allowMediaElement,
        previewUrl,
    });

    let bpm;
    try {
        bpm = await detectBpmFromPreviewUrl(previewUrl, {
            signal,
            allowMediaElement,
        });
    } catch (err) {
        bpmLog('error', 'preview_detect', `${label}: preview analysis threw`, {
            error: err?.message || String(err),
        });
        bpm = null;
    }

    if (!bpm) {
        bpmLog('warn', 'done', `${label}: no BPM — preview analysis returned nothing`);
        return base;
    }

    bpmLog('info', 'done', `${label}: resolved ${bpm} BPM via preview`);
    return applyBpmFields(base, bpm, 'preview', spTrack, previewUrl, analyticsContext);
}
