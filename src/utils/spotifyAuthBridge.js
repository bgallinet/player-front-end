/** Spotify OAuth bridge: app on localhost, callback on 127.0.0.1 (Spotify rejects "localhost"). */

export const SPOTIFY_AUTH_MESSAGE = 'SPOTIFY_AUTH_COMPLETE';

/** After OAuth redirect, React Router path to restore (e.g. /testplayer). */
export const SPOTIFY_RETURN_PATH_KEY = 'sp_return_path';

/** Parent window origin before OAuth (localhost) for popup postMessage. */
export const SPOTIFY_RETURN_ORIGIN_KEY = 'sp_return_origin';

export const isSpotifyLocalhostDev = () => {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    return host === 'localhost' || host === '[::1]';
};

export const getSpotifyLoopbackOrigin = () => {
    if (typeof window === 'undefined') return 'http://127.0.0.1:3000';
    const port = window.location.port ? `:${window.location.port}` : '';
    return `http://127.0.0.1${port}`;
};

export const getSpotifyConnectUrl = (returnOrigin) => {
    const base = `${getSpotifyLoopbackOrigin()}/spotify/connect`;
    if (!returnOrigin) return base;
    return `${base}?return_origin=${encodeURIComponent(returnOrigin)}`;
};

/** Dev loopback hosts that may send/receive Spotify OAuth postMessage. */
export const getSpotifyDevOrigins = () => {
    if (typeof window === 'undefined') return [];
    const port = window.location.port ? `:${window.location.port}` : '';
    return [`http://127.0.0.1${port}`, `http://localhost${port}`, `http://[::1]${port}`];
};

export const isTrustedSpotifyAuthMessageOrigin = (origin) => {
    if (!origin) return false;
    return getSpotifyDevOrigins().includes(origin);
};
