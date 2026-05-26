/**
 * SoundCloud API Service
 * 
 * Handles all SoundCloud API interactions including:
 * - OAuth 2.1 with PKCE authentication
 * - Track search and browsing
 * - User library access (tracks, likes, playlists)
 * - HLS stream URL resolution
 * 
 * SETUP:
 * Credentials are loaded from EnvironmentVariables (per-environment config).
 * Register a separate SoundCloud app per environment at https://soundcloud.com/you/apps
 * and set SC_ClientID / SC_ClientSecret in the corresponding EnvironmentVariables file.
 */

import EnvironmentVariables from '../EnvironmentVariables';
import { soundCloudTrackIdForApi, unwrapLikedTrackRow } from './soundcloudTrackId';

export { soundCloudTrackIdForApi };

// ============================================================
// CONFIGURATION - Loaded from per-environment EnvironmentVariables
// ============================================================
const SC_CONFIG = {
    clientId: EnvironmentVariables.SC_ClientID,
    clientSecret: EnvironmentVariables.SC_ClientSecret,
    redirectUri: `${window.location.origin}/soundcloud/callback`,
    authEndpoint: 'https://secure.soundcloud.com/authorize',
    tokenEndpoint: 'https://secure.soundcloud.com/oauth/token',
    apiBaseUrl: 'https://api.soundcloud.com',
};

// ============================================================
// PKCE Helpers
// ============================================================

export const generateCodeVerifier = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

export const generateCodeChallenge = async (verifier) => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

// ============================================================
// Auth Methods
// ============================================================

/**
 * Generate a random state string for CSRF protection
 */
export const generateState = () => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Build the SoundCloud authorization URL with PKCE and state.
 * See: https://developers.soundcloud.com/docs/api/guide#authorization-code-flow
 */
export const getAuthUrl = (codeChallenge, state) => {
    const params = new URLSearchParams({
        client_id: SC_CONFIG.clientId,
        redirect_uri: SC_CONFIG.redirectUri,
        response_type: 'code',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: state,
    });
    return `${SC_CONFIG.authEndpoint}?${params.toString()}`;
};

/**
 * Exchange authorization code for access token
 */
export const exchangeCodeForToken = async (code, codeVerifier) => {
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: SC_CONFIG.clientId,
        client_secret: SC_CONFIG.clientSecret,
        redirect_uri: SC_CONFIG.redirectUri,
        code: code,
        code_verifier: codeVerifier,
    });

    const response = await fetch(SC_CONFIG.tokenEndpoint, {
        method: 'POST',
        headers: {
            'accept': 'application/json; charset=utf-8',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error_description || 'Token exchange failed');
    }

    return response.json();
};

/**
 * Refresh an expired access token.
 * See: https://developers.soundcloud.com/docs/api/guide#refreshing-tokens
 */
export const refreshAccessToken = async (refreshToken) => {
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: SC_CONFIG.clientId,
        client_secret: SC_CONFIG.clientSecret,
        refresh_token: refreshToken,
    });

    const response = await fetch(SC_CONFIG.tokenEndpoint, {
        method: 'POST',
        headers: {
            'accept': 'application/json; charset=utf-8',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
    });

    if (!response.ok) {
        throw new Error('Token refresh failed');
    }

    return response.json();
};

// ============================================================
// API Helper
// ============================================================

/**
 * All SoundCloud API requests require an Authorization header.
 * See: https://developers.soundcloud.com/docs/api/guide#accessing-resources
 */
const apiRequest = async (endpoint, accessToken, params = {}) => {
    const url = new URL(`${SC_CONFIG.apiBaseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, value);
        }
    });

    const headers = {
        'accept': 'application/json; charset=utf-8',
    };

    if (!accessToken) {
        throw new Error('Access token is required for all SoundCloud API requests');
    }
    headers['Authorization'] = `OAuth ${accessToken}`;

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error_description || errorData.message || `API request failed: ${response.status}`);
    }

    return response.json();
};

/**
 * GET any SoundCloud API URL (e.g. `next_href` pagination) with OAuth header.
 */
const fetchSoundCloudUrl = async (urlString, accessToken) => {
    if (!accessToken) {
        throw new Error('Access token is required for all SoundCloud API requests');
    }
    const response = await fetch(urlString, {
        headers: {
            accept: 'application/json; charset=utf-8',
            Authorization: `OAuth ${accessToken}`,
        },
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error_description || errorData.message || `API request failed: ${response.status}`
        );
    }
    return response.json();
};

const MAX_PLAYLIST_TRACKS = 10000;

/**
 * Opt-in playlist diagnostics (fetch vs UI).
 * In DevTools console: localStorage.setItem('DEBUG_SC_PLAYLIST', '1') then reload.
 * Turn off: localStorage.removeItem('DEBUG_SC_PLAYLIST')
 */
export const isSoundCloudPlaylistDebug = () => {
    if (typeof window === 'undefined') return false;
    if (window.__DEBUG_SC_PLAYLIST__ === true) return true;
    const v = window.localStorage?.getItem('DEBUG_SC_PLAYLIST');
    if (v == null) return false;
    const s = String(v).trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
};

const scPlaylistLog = (...args) => {
    if (isSoundCloudPlaylistDebug()) {
        console.info('[SoundCloud playlist]', ...args);
    }
};

/**
 * Playlist /tracks pages often return the same shape as likes: `{ track: { ... } }` per row.
 */
function normalizePlaylistTrackChunk(rawChunk) {
    if (!Array.isArray(rawChunk)) return [];
    return rawChunk
        .map((item) => {
            if (item == null) return null;
            if (typeof item === 'object' && item.track != null && typeof item.track === 'object') {
                return item.track;
            }
            return item;
        })
        .filter((t) => t != null && typeof t === 'object');
}

// ============================================================
// User API Methods
// ============================================================

/**
 * Get the authenticated user's profile
 */
export const getMe = async (accessToken) => {
    return apiRequest('/me', accessToken);
};

/**
 * Get the authenticated user's tracks
 */
export const getMyTracks = async (accessToken, limit = 50, offset = 0) => {
    return apiRequest('/me/tracks', accessToken, { limit, offset });
};

/**
 * Get the authenticated user's liked tracks.
 * Use GET /me/likes/tracks — GET /me/likes responds 405 Method Not Allowed on the current API.
 */
export const getMyLikes = async (accessToken, limit = 50, offset = 0) => {
    const data = await apiRequest('/me/likes/tracks', accessToken, {
        limit,
        offset,
        linked_partitioning: true,
    });
    const raw = Array.isArray(data) ? data : data?.collection;
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => unwrapLikedTrackRow(item))
        .filter((t) => t != null && typeof t === 'object');
};

/**
 * Get the authenticated user's playlists
 */
export const getMyPlaylists = async (accessToken, limit = 50, offset = 0) => {
    return apiRequest('/me/playlists', accessToken, { limit, offset });
};

function parsePlaylistTracksResponse(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.collection)) return data.collection;
    if (data && Array.isArray(data.tracks)) return data.tracks;
    return [];
}

function extractPlaylistTracksNextHref(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return (
        data.next_href ||
        data.next ||
        (data.paging && (data.paging.next || data.paging.next_href)) ||
        null
    );
}

/** Stable map key for a track or raw id (numbers and numeric strings collapse to Number). */
function normalizeTrackMergeKey(idOrTrack) {
    if (idOrTrack == null) return null;
    const t = idOrTrack;
    let id = typeof t === 'object' ? (t.id ?? t.urn) : t;
    if (id == null) return typeof t === 'object' ? t.permalink_url ?? null : null;
    if (typeof id === 'string' && id.includes(':')) {
        const tail = id.split(':').pop();
        id = /^\d+$/.test(tail || '') ? Number(tail) : tail;
    }
    if (typeof id === 'string' && /^\d+$/.test(id)) return Number(id);
    return id;
}

function mergeTracksIntoMap(mergedMap, rawChunk) {
    let fallbackKey = 0;
    for (const t of normalizePlaylistTrackChunk(rawChunk)) {
        const k = normalizeTrackMergeKey(t);
        if (k != null) mergedMap.set(k, t);
        else mergedMap.set(`__nf_${fallbackKey++}`, t);
    }
}

/** Track ids in order from `GET /playlists/:id?representation=id` (uses null slots for removed tracks). */
function extractOrderedTrackIdsFromIdRepresentation(idRep) {
    let tracks = idRep?.tracks;
    if (tracks && typeof tracks === 'object' && !Array.isArray(tracks)) {
        if (Array.isArray(tracks.collection)) tracks = tracks.collection;
        else if (Array.isArray(tracks.items)) tracks = tracks.items;
        else tracks = null;
    }
    if (!Array.isArray(tracks)) return [];
    const out = [];
    for (const item of tracks) {
        if (item == null) {
            out.push(null);
            continue;
        }
        if (typeof item === 'number') {
            out.push(item);
            continue;
        }
        if (typeof item === 'string') {
            const k = normalizeTrackMergeKey(item);
            out.push(k != null ? k : null);
            continue;
        }
        if (typeof item === 'object') {
            const raw = item.id ?? item.urn ?? null;
            const k = raw != null ? normalizeTrackMergeKey(raw) : null;
            if (k != null) {
                out.push(k);
                continue;
            }
        }
        out.push(null);
    }
    return out;
}

/** One row per playlist slot; duplicate track ids appear multiple times (matches `track_count`). */
function playlistTracksMapToOrderedList(merged, orderedIds) {
    const list = [];
    for (const tid of orderedIds) {
        if (tid == null) continue;
        const k = normalizeTrackMergeKey(tid);
        let t = merged.get(k);
        if (t == null && typeof k === 'number') t = merged.get(String(k));
        if (t == null && k != null) t = merged.get(Number(k));
        if (t != null) list.push(t);
    }
    return list;
}

/**
 * Get all tracks from a playlist. SoundCloud often returns only a small hydrated window in `tracks`
 * (e.g. 4 objects) while `track_count` is higher — use `representation=id` for the full id list,
 * hydrate via `/tracks/:id`, then merge paginated `/playlists/:id/tracks` + default representation.
 */
export const getPlaylistTracks = async (playlistId, accessToken) => {
    const pid = String(playlistId);
    /** @type {Map<number|string, object>} */
    const merged = new Map();
    const limit = 200;

    scPlaylistLog('fetch start playlistId=', pid);

    /** @type {Array<number|string|null>} */
    let orderedIdsFromIdRep = [];

    // 0) representation=id — authoritative ordered ids (see SoundCloud "New playlist representations")
    try {
        const idRep = await apiRequest(`/playlists/${pid}`, accessToken, { representation: 'id' });
        orderedIdsFromIdRep = extractOrderedTrackIdsFromIdRepresentation(idRep);
        const toHydrate = [...new Set(orderedIdsFromIdRep.filter((x) => x != null))];
        scPlaylistLog(
            'representation=id slots=',
            orderedIdsFromIdRep.length,
            'uniqueIds=',
            toHydrate.length,
            'track_count=',
            idRep?.track_count
        );

        const batchSize = 6;
        for (let i = 0; i < toHydrate.length; i += batchSize) {
            const batch = toHydrate.slice(i, i + batchSize);
            const results = await Promise.all(
                batch.map((trackId) =>
                    getTrackDetails(trackId, accessToken).catch((e) => {
                        scPlaylistLog('getTrackDetails failed', trackId, e?.message || e);
                        return null;
                    })
                )
            );
            for (const full of results) {
                if (full) mergeTracksIntoMap(merged, [full]);
            }
        }
    } catch (err) {
        scPlaylistLog('representation=id pipeline failed (will use /tracks paging)', err?.message || err);
        orderedIdsFromIdRep = [];
    }

    // 1) Offset paging on /playlists/:id/tracks
    try {
        let offset = 0;
        let page = 0;
        let stallRounds = 0;
        while (offset < MAX_PLAYLIST_TRACKS && stallRounds < 4) {
            page += 1;
            const sizeBefore = merged.size;
            const data = await apiRequest(`/playlists/${pid}/tracks`, accessToken, {
                limit,
                offset,
            });
            const chunk = parsePlaylistTracksResponse(data);
            if (chunk.length === 0) {
                stallRounds++;
                offset += limit;
                continue;
            }
            mergeTracksIntoMap(merged, chunk);
            scPlaylistLog(
                `offset page ${page}: offset=${offset} raw=${chunk.length} uniqueTotal=${merged.size}`
            );
            if (merged.size === sizeBefore) {
                stallRounds++;
                offset += limit;
                continue;
            }
            stallRounds = 0;
            offset += chunk.length;
            if (chunk.length < limit) break;
        }
    } catch (err) {
        scPlaylistLog('offset /playlists/.../tracks failed', err?.message || err);
    }

    // 2) Linked partitioning
    let nextUrl = `${SC_CONFIG.apiBaseUrl}/playlists/${encodeURIComponent(pid)}/tracks?limit=${limit}&linked_partitioning=true`;
    try {
        let page = 0;
        while (nextUrl && merged.size < MAX_PLAYLIST_TRACKS) {
            page += 1;
            const data = await fetchSoundCloudUrl(nextUrl, accessToken);
            const chunk = parsePlaylistTracksResponse(data);
            const nextFromData = extractPlaylistTracksNextHref(data);

            if (chunk.length === 0 && !nextFromData) break;

            if (chunk.length > 0) {
                const norm = normalizePlaylistTrackChunk(chunk);
                if (norm.length === 0) {
                    scPlaylistLog(
                        `linked page ${page}: normalized 0 but raw ${chunk.length} — sample`,
                        chunk[0] && typeof chunk[0] === 'object' ? Object.keys(chunk[0]) : chunk[0]
                    );
                }
                mergeTracksIntoMap(merged, chunk);
            }

            scPlaylistLog(
                `linked page ${page}: raw=${chunk.length} uniqueTotal=${merged.size} next=${nextFromData ? 'yes' : 'no'}`
            );

            nextUrl = nextFromData || null;
            if (nextUrl && !/^https?:\/\//i.test(nextUrl)) {
                nextUrl = nextUrl.startsWith('/')
                    ? `${SC_CONFIG.apiBaseUrl}${nextUrl}`
                    : `${SC_CONFIG.apiBaseUrl}/${nextUrl}`;
            }
        }
    } catch (err) {
        console.warn('[SoundCloud] Playlist tracks linked_partitioning failed:', err);
        scPlaylistLog('linked path error', err?.message || err);
    }

    // 3) Default playlist representation (full embedded tracks)
    try {
        const data = await apiRequest(`/playlists/${pid}`, accessToken);
        const before = merged.size;
        mergeTracksIntoMap(merged, data.tracks || []);
        scPlaylistLog(
            'GET /playlists/:id (default) merged; was',
            before,
            'now',
            merged.size,
            'track_count=',
            data.track_count
        );
    } catch (err) {
        scPlaylistLog('GET /playlists/:id merge failed', err?.message || err);
    }

    scPlaylistLog('final unique track count=', merged.size);

    if (orderedIdsFromIdRep.length > 0) {
        const ordered = playlistTracksMapToOrderedList(merged, orderedIdsFromIdRep);
        if (ordered.length > 0) return ordered;
    }

    return Array.from(merged.values());
};

// ============================================================
// Search
// ============================================================

/**
 * Search for tracks on SoundCloud
 */
export const searchTracks = async (query, accessToken, limit = 50, offset = 0) => {
    const data = await apiRequest('/tracks', accessToken, { q: query, limit, offset });
    if (Array.isArray(data)) return data;
    if (data.collection) return data.collection;
    return [];
};

// ============================================================
// Track Details
// ============================================================

/**
 * Fetch the full track details by ID. Summary results from search/playlists
 * often lack the `media.transcodings` field required for streaming.
 */
export const getTrackDetails = async (trackId, accessToken) => {
    return apiRequest(`/tracks/${trackId}`, accessToken);
};

/**
 * Fetch direct stream URLs for a track via the /streams endpoint.
 * Returns an object with keys like hls_mp3_128_url, http_mp3_128_url, etc.
 * See: https://developers.soundcloud.com/docs/api/guide#streaming-tracks
 */
export const getTrackStreams = async (trackId, accessToken) => {
    return apiRequest(`/tracks/${trackId}/streams`, accessToken);
};

// ============================================================
// Streaming
// ============================================================

/**
 * Resolve a SoundCloud API stream URL to a direct CDN URL.
 * SoundCloud's /streams endpoint returns API URLs that require auth and redirect
 * to CDN URLs. The <audio> element can't pass auth headers, so we follow the
 * redirect ourselves and return the final CDN URL.
 */
const resolveStreamRedirect = async (apiUrl, accessToken) => {
    const headers = {};
    if (accessToken) {
        headers['Authorization'] = `OAuth ${accessToken}`;
    }

    const response = await fetch(apiUrl, {
        headers,
        redirect: 'follow',
    });

    if (!response.ok) {
        throw new Error(`Stream URL resolution failed: ${response.status} ${response.statusText}`);
    }

    // If the fetch followed a redirect, response.url is the final CDN URL
    if (response.url && response.url !== apiUrl) {
        console.log('[SC Stream] Redirected to CDN URL');
        return response.url;
    }

    // If no redirect, check if response is JSON with a url field
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data.url) {
            return data.url;
        }
    }

    // If response is the actual audio data, create a blob URL
    console.log('[SC Stream] Creating blob URL from audio response');
    const blob = await response.blob();
    return URL.createObjectURL(blob);
};

/**
 * Resolve the actual HLS streaming URL for a track.
 * 
 * SoundCloud tracks have a `media.transcodings` array with different formats.
 * We prefer AAC HLS (audio/mp4 + hls) and fall back to MP3 HLS.
 * 
 * If the track object lacks transcodings (common for search/playlist results),
 * we fetch the full track details first.
 */
export const getStreamUrl = async (track, accessToken) => {
    let working = track;
    let trackId = soundCloudTrackIdForApi(working);

    // Likes (and some list views) may return only a permalink or a thin object — resolve to a full track + id.
    if (!trackId && accessToken) {
        const permalink =
            (typeof working.permalink_url === 'string' && working.permalink_url.trim().length > 0
                ? working.permalink_url.trim()
                : null) ||
            (typeof working.permalink === 'string' && working.permalink.trim().length > 0
                ? working.permalink.trim()
                : null);
        if (permalink) {
            try {
                const resolved = await apiRequest('/resolve', accessToken, { url: permalink });
                if (resolved && typeof resolved === 'object' && resolved.id != null) {
                    working = { ...working, ...resolved };
                    trackId = soundCloudTrackIdForApi(working);
                }
            } catch (err) {
                console.warn('[SC Stream] /resolve for permalink failed:', err.message);
            }
        }
    }

    if (!trackId) {
        throw new Error('No track ID available');
    }

    // Strategy 1: Use the /tracks/{id}/streams endpoint (most reliable)
    try {
        console.log('[SC Stream] Trying /streams endpoint for track:', trackId);
        const streams = await getTrackStreams(trackId, accessToken);
        console.log('[SC Stream] Available stream formats:', Object.keys(streams));

        // Prefer progressive MP3 (simpler, no manifest fetching, works with Web Audio API)
        // Fall back to HLS only if progressive is unavailable
        const progressiveUrl = streams.http_mp3_128_url;
        const hlsUrl = streams.hls_mp3_128_url || streams.hls_opus_64_url;
        const chosenUrl = progressiveUrl || hlsUrl ||
            Object.values(streams).find(v => typeof v === 'string' && v.startsWith('http'));
        const isHls = chosenUrl && !progressiveUrl && (chosenUrl === hlsUrl || chosenUrl.includes('/hls'));

        if (chosenUrl) {
            // Stream URLs from /streams are API URLs that require auth.
            // Fetch with auth header to follow the redirect and get the direct CDN URL.
            console.log('[SC Stream] Resolving stream URL:', chosenUrl.substring(0, 80) + '...');
            const resolvedUrl = await resolveStreamRedirect(chosenUrl, accessToken);
            console.log('[SC Stream] Resolved to CDN URL, isHls:', !!isHls);
            return { url: resolvedUrl, isHls: !!isHls };
        }
    } catch (streamsErr) {
        console.warn('[SC Stream] /streams endpoint failed:', streamsErr.message);
    }

    // Strategy 2: Fall back to media.transcodings if available
    let transcodings = working?.media?.transcodings;
    if (!transcodings || transcodings.length === 0) {
        console.log('[SC Stream] Fetching full track details for transcodings...');
        const fullTrack = await getTrackDetails(trackId, accessToken);

        if (fullTrack?.access === 'blocked') {
            throw new Error(`Track "${fullTrack.title}" is blocked and cannot be streamed.`);
        }

        transcodings = fullTrack?.media?.transcodings;
        if (!transcodings || transcodings.length === 0) {
            throw new Error(
                `Track is not streamable (access: ${fullTrack?.access || 'unknown'}). ` +
                'It may be restricted by the uploader or geo-blocked.'
            );
        }

        // Use track_authorization from full track
        if (fullTrack?.track_authorization) {
            working = { ...working, track_authorization: fullTrack.track_authorization };
        }
    }

    // Pick the best transcoding
    const hlsAac = transcodings.find(
        t => t.format?.protocol === 'hls' && t.format?.mime_type === 'audio/mp4'
    );
    const hlsMp3 = transcodings.find(
        t => t.format?.protocol === 'hls' && t.format?.mime_type === 'audio/mpeg'
    );
    const anyHls = transcodings.find(t => t.format?.protocol === 'hls');
    const progressive = transcodings.find(t => t.format?.protocol === 'progressive');

    const transcoding = hlsAac || hlsMp3 || anyHls || progressive;
    if (!transcoding) {
        throw new Error('No suitable transcoding found for this track');
    }

    // Resolve the transcoding URL to get the actual stream
    const resolveUrl = new URL(transcoding.url);
    if (working.track_authorization) {
        resolveUrl.searchParams.set('track_authorization', working.track_authorization);
    }

    const headers = {};
    if (accessToken) {
        headers['Authorization'] = `OAuth ${accessToken}`;
    }

    const response = await fetch(resolveUrl.toString(), { headers });
    if (!response.ok) {
        throw new Error('Failed to resolve stream URL');
    }

    const data = await response.json();
    return {
        url: data.url,
        isHls: transcoding.format?.protocol === 'hls',
    };
};

// ============================================================
// Track Normalization
// ============================================================

/**
 * Normalize a SoundCloud track into the format used by PlaylistCard.
 * This ensures compatibility with existing playlist components.
 */
export const normalizeTrack = (scTrack) => ({
    id: soundCloudTrackIdForApi(scTrack) ?? scTrack.urn ?? scTrack.id ?? `sc-${Date.now()}-${Math.random()}`,
    name: scTrack.user
        ? `${scTrack.user.username} - ${scTrack.title}`
        : scTrack.title,
    title: scTrack.title,
    artist: scTrack.user?.username || 'Unknown Artist',
    duration: (scTrack.duration || 0) / 1000, // Convert ms to seconds
    artwork_url: scTrack.artwork_url,
    file: null, // SoundCloud tracks don't have local files
    scTrack: scTrack, // Keep original SC track data for streaming
});

/**
 * Format duration in mm:ss
 */
export const formatDuration = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export { SC_CONFIG };
export default SC_CONFIG;
