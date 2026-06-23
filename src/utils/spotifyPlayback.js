/**
 * Spotify Web Playback SDK loader and Web API transport helpers.
 */

import {
    playUrisOnDevice,
    transferPlaybackToDevice,
    pausePlayback,
    resumePlayback,
    seekPlayback,
} from './spotifyService';

export {
    playUrisOnDevice,
    transferPlaybackToDevice,
    pausePlayback,
    resumePlayback,
    seekPlayback,
};

let sdkLoadPromise = null;

export function loadSpotifyPlaybackSdk() {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('Spotify SDK requires a browser environment'));
    }
    if (window.Spotify) {
        return Promise.resolve(window.Spotify);
    }
    if (sdkLoadPromise) {
        return sdkLoadPromise;
    }

    sdkLoadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-spotify-sdk="true"]');
        if (existing) {
            window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify);
            return;
        }

        window.onSpotifyWebPlaybackSDKReady = () => {
            if (window.Spotify) resolve(window.Spotify);
            else reject(new Error('Spotify SDK loaded but Spotify global is missing'));
        };

        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        script.dataset.spotifySdk = 'true';
        script.onerror = () => reject(new Error('Failed to load Spotify Web Playback SDK'));
        document.body.appendChild(script);
    });

    return sdkLoadPromise;
}

/** Attach Spotify transport to an HTMLAudioElement for Player / useDeckTransport compatibility. */
export function bridgeAudioElementToSpotify(audioEl, spotifyTransport) {
    if (!audioEl || !spotifyTransport || audioEl._spotifyBridgeAttached) {
        return () => {};
    }

    audioEl._spotifyBridgeAttached = true;
    const SPOTIFY_SRC = 'spotify://playback';

    const syncFromState = async () => {
        const state = await spotifyTransport.getCurrentState?.();
        if (!state || !state.track_window?.current_track) return;
        const track = state.track_window.current_track;
        const durationSec = (track.duration_ms || 0) / 1000;
        const positionSec = (state.position || 0) / 1000;
        if (Number.isFinite(durationSec) && durationSec > 0) {
            try {
                Object.defineProperty(audioEl, 'duration', {
                    configurable: true,
                    get: () => durationSec,
                });
            } catch {
                // ignore
            }
        }
        if (Number.isFinite(positionSec)) {
            try {
                Object.defineProperty(audioEl, 'currentTime', {
                    configurable: true,
                    get: () => positionSec,
                    set: (v) => {
                        void spotifyTransport.seek(Math.floor(v * 1000));
                    },
                });
            } catch {
                // ignore
            }
        }
    };

    audioEl.play = async () => {
        if (!audioEl._spotifyActiveUri) {
            throw new Error('No Spotify track loaded');
        }
        await spotifyTransport.resume();
        audioEl.dispatchEvent(new Event('play'));
        return undefined;
    };

    audioEl.pause = () => {
        void spotifyTransport.pause();
        audioEl.dispatchEvent(new Event('pause'));
    };

    audioEl._setSpotifyTrack = (uri) => {
        audioEl._spotifyActiveUri = uri || null;
        if (uri) {
            if (!audioEl.src || audioEl.src === '') {
                audioEl.src = SPOTIFY_SRC;
            }
            audioEl.dispatchEvent(new Event('loadedmetadata'));
        }
    };

    const interval = window.setInterval(() => {
        void syncFromState();
    }, 500);

    return () => {
        window.clearInterval(interval);
        audioEl._spotifyBridgeAttached = false;
        audioEl._spotifyActiveUri = null;
    };
}
