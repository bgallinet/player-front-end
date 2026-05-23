/**
 * Spotify API service — OAuth 2.0 PKCE, Web API, and track normalization.
 *
 * SETUP:
 * Register an app at https://developer.spotify.com/dashboard
 * Dev redirect: http://127.0.0.1:3000/spotify/callback (Spotify rejects localhost)
 * Set REACT_APP_SPOTIFY_CLIENT_ID (and optional REACT_APP_SPOTIFY_CLIENT_SECRET) in .env.local
 */

import EnvironmentVariables from '../EnvironmentVariables';

import { getSpotifyLoopbackOrigin, isSpotifyLocalhostDev } from './spotifyAuthBridge';

/** Redirect URI registered in Spotify Dashboard (loopback for local dev). */
export const resolveSpotifyRedirectUri = () => {
    if (typeof window === 'undefined') return '';
    if (isSpotifyLocalhostDev() || window.location.hostname === '127.0.0.1') {
        return `${getSpotifyLoopbackOrigin()}/spotify/callback`;
    }
    return `${window.location.origin}/spotify/callback`;
};

const SP_CONFIG = {
    clientId: EnvironmentVariables.SP_ClientID,
    clientSecret: EnvironmentVariables.SP_ClientSecret,
    authEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
    apiBaseUrl: 'https://api.spotify.com/v1',
};

export const SPOTIFY_SCOPES = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-library-read',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-read-playback-state',
    'user-modify-playback-state',
].join(' ');

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

export const generateState = () => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
};

export const getAuthUrl = (codeChallenge, state) => {
    const params = new URLSearchParams({
        client_id: SP_CONFIG.clientId,
        response_type: 'code',
        redirect_uri: resolveSpotifyRedirectUri(),
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        state,
        scope: SPOTIFY_SCOPES,
    });
    return `${SP_CONFIG.authEndpoint}?${params.toString()}`;
};

const tokenRequestBody = (params) => {
    const body = new URLSearchParams(params);
    if (SP_CONFIG.clientSecret) {
        body.set('client_secret', SP_CONFIG.clientSecret);
    }
    return body;
};

export const exchangeCodeForToken = async (code, codeVerifier) => {
    const body = tokenRequestBody({
        grant_type: 'authorization_code',
        code,
        redirect_uri: resolveSpotifyRedirectUri(),
        client_id: SP_CONFIG.clientId,
        code_verifier: codeVerifier,
    });

    const response = await fetch(SP_CONFIG.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error_description || errorData.error || 'Token exchange failed');
    }

    return response.json();
};

export const refreshAccessToken = async (refreshToken) => {
    const body = tokenRequestBody({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: SP_CONFIG.clientId,
    });

    const response = await fetch(SP_CONFIG.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!response.ok) {
        throw new Error('Token refresh failed');
    }

    return response.json();
};

// ============================================================
// API Helper
// ============================================================

const apiRequest = async (endpoint, accessToken, params = {}) => {
    const url = new URL(`${SP_CONFIG.apiBaseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, value);
        }
    });

    const response = await fetch(url.toString(), {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            accept: 'application/json',
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error?.message || `Spotify API request failed: ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        throw err;
    }

    return response.json();
};

/** Spotify blocks audio-features for new Development-mode apps (Nov 2024). */
export const AUDIO_FEATURES_FORBIDDEN_MSG =
    'Audio features (tempo, danceability, energy, etc.) are not available for this Spotify app. ' +
    'Spotify restricts the /audio-features endpoint for apps in Development mode. ' +
    'Track details below are still shown from the library response.';

export const isAudioFeaturesForbidden = (err) =>
    err?.status === 403 || /403|forbidden/i.test(String(err?.message || ''));

const fetchAllPages = async (firstPath, accessToken, { limit = 50, maxItems = 500 } = {}) => {
    const items = [];
    let path = firstPath;
    let query = { limit };

    while (path && items.length < maxItems) {
        const data = await apiRequest(path, accessToken, query);
        const chunk = data.items || [];
        items.push(...chunk);
        if (!data.next) break;
        const nextUrl = new URL(data.next);
        path = nextUrl.pathname.replace('/v1', '') + nextUrl.search;
        query = {};
    }

    return items.slice(0, maxItems);
};

// ============================================================
// User API
// ============================================================

export const getMe = async (accessToken) => apiRequest('/me', accessToken);

export const getMySavedTracks = async (accessToken, limit = 50) => {
    const data = await apiRequest('/me/tracks', accessToken, { limit, offset: 0 });
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map((row) => row.track).filter(Boolean);
};

export const getMyPlaylists = async (accessToken, limit = 50) => {
    return fetchAllPages('/me/playlists', accessToken, { limit, maxItems: 200 });
};

/** Playlists whose tracks the Web API allows (owned by user; followed playlists return 403). */
export const getMyBrowsablePlaylists = async (accessToken) => {
    const [me, playlists] = await Promise.all([getMe(accessToken), getMyPlaylists(accessToken)]);
    const userId = me?.id;
    const browsable = (playlists || []).filter((pl) => pl?.owner?.id && pl.owner.id === userId);
    return { playlists: browsable, userId, allCount: playlists?.length ?? 0 };
};

function unwrapPlaylistTrackRow(row) {
    if (!row) return null;
    const item = row.item ?? row.track;
    if (!item || typeof item !== 'object') return null;
    if (item.type === 'episode') return null;
    if (item.type === 'track' || item.id) return item;
    return null;
}

export const getPlaylistTracks = async (playlistId, accessToken) => {
    const pid = encodeURIComponent(playlistId);
    const rows = await fetchAllPages(`/playlists/${pid}/items`, accessToken, {
        limit: 50,
        maxItems: 2000,
    });
    return rows.map(unwrapPlaylistTrackRow).filter(Boolean);
};

export const searchTracks = async (query, accessToken, limit = 50) => {
    const data = await apiRequest('/search', accessToken, {
        q: query,
        type: 'track',
        limit,
    });
    return data.tracks?.items || [];
};

export const getTrack = async (trackId, accessToken, market) => {
    const id = encodeURIComponent(trackId);
    const params = market ? { market } : {};
    return apiRequest(`/tracks/${id}`, accessToken, params);
};

// ============================================================
// Audio features
// ============================================================

const PITCH_CLASS_NAMES = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];

export const getTrackAudioFeatures = async (trackId, accessToken) => {
    const id = encodeURIComponent(trackId);
    return apiRequest(`/audio-features/${id}`, accessToken);
};

const formatPercent = (n) => (Number.isFinite(n) ? `${Math.round(n * 100)}%` : '—');

const formatKeyMode = (key, mode) => {
    if (!Number.isFinite(key) || key < 0 || key > 11) return '—';
    const name = PITCH_CLASS_NAMES[Math.floor(key)] || '—';
    if (mode === 1) return `${name} major`;
    if (mode === 0) return `${name} minor`;
    return name;
};

/** Rows from track object (no audio-features API). */
export const formatTrackMetadataDisplay = (track) => {
    const sp = track?.spTrack || {};
    const rows = [];

    const title = track?.title || sp.name;
    if (title) rows.push({ label: 'Title', value: title });

    const artists = (sp.artists || []).map((a) => a.name).filter(Boolean).join(', ') || track?.artist;
    if (artists) rows.push({ label: 'Artist', value: artists });

    if (sp.album?.name) rows.push({ label: 'Album', value: sp.album.name });
    if (sp.album?.release_date) rows.push({ label: 'Release date', value: sp.album.release_date });

    const durationMs = sp.duration_ms ?? (track?.duration ? Math.round(track.duration * 1000) : null);
    if (durationMs) rows.push({ label: 'Duration', value: formatDuration(durationMs) });

    const bpm = Number(track?.bpm ?? track?.track_bpm);
    if (Number.isFinite(bpm) && bpm > 0) {
        const sourceLabels = {
            spotify_audio_features: 'Tempo (Spotify)',
            preview: 'Estimated tempo (preview)',
            acousticbrainz: 'Tempo (MusicBrainz)',
            getsongbpm: 'Tempo (GetSongBPM)',
            catalog: 'Tempo (catalog)',
        };
        const bpmLabel = sourceLabels[track?.bpmSource] || 'Tempo';
        rows.push({ label: bpmLabel, value: `${bpm} BPM` });
    }

    if (Number.isFinite(sp.popularity)) {
        rows.push({ label: 'Popularity', value: `${sp.popularity}/100` });
    }
    if (sp.explicit != null) {
        rows.push({ label: 'Explicit', value: sp.explicit ? 'Yes' : 'No' });
    }
    if (sp.external_ids?.isrc) rows.push({ label: 'ISRC', value: sp.external_ids.isrc });
    if (sp.disc_number != null) rows.push({ label: 'Disc', value: String(sp.disc_number) });
    if (sp.track_number != null) rows.push({ label: 'Track #', value: String(sp.track_number) });
    if (track?.id || sp.id) rows.push({ label: 'Spotify ID', value: track?.id || sp.id });
    if (sp.uri || track?.uri) rows.push({ label: 'URI', value: sp.uri || track.uri });

    const spotifyUrl = sp.external_urls?.spotify;
    if (spotifyUrl) {
        rows.push({
            label: 'Open in Spotify',
            value: spotifyUrl,
            href: spotifyUrl,
        });
    }

    return rows;
};

/** Rows for metadata UI: { label, value } */
export const formatAudioFeaturesDisplay = (features) => {
    if (!features) return [];
    const tempo = features.tempo;
    const bpm =
        Number.isFinite(tempo) && tempo > 0 ? `${Math.round(tempo * 10) / 10} BPM` : '—';

    return [
        { label: 'Tempo', value: bpm },
        { label: 'Key', value: formatKeyMode(features.key, features.mode) },
        { label: 'Time signature', value: Number.isFinite(features.time_signature) ? `${features.time_signature}/4` : '—' },
        { label: 'Danceability', value: formatPercent(features.danceability) },
        { label: 'Energy', value: formatPercent(features.energy) },
        { label: 'Valence', value: formatPercent(features.valence) },
        { label: 'Acousticness', value: formatPercent(features.acousticness) },
        { label: 'Instrumentalness', value: formatPercent(features.instrumentalness) },
        { label: 'Liveness', value: formatPercent(features.liveness) },
        { label: 'Speechiness', value: formatPercent(features.speechiness) },
        {
            label: 'Loudness',
            value: Number.isFinite(features.loudness) ? `${features.loudness.toFixed(1)} dB` : '—',
        },
    ];
};

// ============================================================
// Playback (Web API — requires active Web Playback SDK device)
// ============================================================

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const getAvailableDevices = async (accessToken) => {
    const data = await apiRequest('/me/player/devices', accessToken);
    return Array.isArray(data?.devices) ? data.devices : [];
};

/** SDK `ready` can fire before the device appears on the Web API — wait before play. */
export const waitUntilDeviceRegistered = async (deviceId, accessToken, { timeoutMs = 10000 } = {}) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const devices = await getAvailableDevices(accessToken);
        if (devices.some((d) => d.id === deviceId)) {
            return true;
        }
        await delay(300);
    }
    return false;
};

export const transferPlaybackToDevice = async (deviceId, accessToken, play = false) => {
    const response = await fetch(`${SP_CONFIG.apiBaseUrl}/me/player`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ device_ids: [deviceId], play: !!play }),
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to transfer playback');
    }
};

export const playUrisOnDevice = async (deviceId, uris, accessToken, positionMs = 0) => {
    const response = await fetch(
        `${SP_CONFIG.apiBaseUrl}/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
        {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                uris,
                position_ms: positionMs,
            }),
        },
    );
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to start playback');
    }
};

/** Play on Web Playback SDK device (play endpoint transfers implicitly). */
export const playTrackOnDevice = async (deviceId, uri, accessToken) => {
    const registered = await waitUntilDeviceRegistered(deviceId, accessToken);
    if (!registered) {
        throw new Error('Spotify player is still connecting. Wait a moment and try again.');
    }

    const uris = [uri];
    const maxAttempts = 4;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
            await playUrisOnDevice(deviceId, uris, accessToken);
            return;
        } catch (err) {
            const msg = err?.message || '';
            const retryable = /device not found/i.test(msg) && attempt < maxAttempts - 1;
            if (!retryable) {
                throw err;
            }
            await delay(400 * (attempt + 1));
            try {
                await transferPlaybackToDevice(deviceId, accessToken, false);
            } catch {
                // transfer optional; play with device_id is enough when device exists
            }
        }
    }
};

export const pausePlayback = async (accessToken) => {
    const response = await fetch(`${SP_CONFIG.apiBaseUrl}/me/player/pause`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to pause playback');
    }
};

export const resumePlayback = async (accessToken) => {
    const response = await fetch(`${SP_CONFIG.apiBaseUrl}/me/player/play`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to resume playback');
    }
};

export const seekPlayback = async (positionMs, accessToken) => {
    const response = await fetch(
        `${SP_CONFIG.apiBaseUrl}/me/player/seek?position_ms=${Math.max(0, Math.floor(positionMs))}`,
        {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}` },
        },
    );
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to seek');
    }
};

// ============================================================
// Track normalization
// ============================================================

export const normalizeTrack = (spTrack) => {
    const artists = (spTrack.artists || []).map((a) => a.name).filter(Boolean);
    return {
        id: spTrack.id,
        uri: spTrack.uri,
        name: artists.length ? `${artists.join(', ')} - ${spTrack.name}` : spTrack.name,
        title: spTrack.name,
        artist: artists.join(', ') || 'Unknown Artist',
        duration: (spTrack.duration_ms || 0) / 1000,
        artwork_url: spTrack.album?.images?.[0]?.url || null,
        preview_url: spTrack.preview_url || null,
        file: null,
        spTrack,
    };
};

export const formatDuration = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export { SP_CONFIG };
export default SP_CONFIG;
