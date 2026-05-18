import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSpotifyPlaybackSdk } from '../utils/spotifyPlayback';
import {
    playTrackOnDevice,
    pausePlayback,
    resumePlayback,
    seekPlayback,
} from '../utils/spotifyService';

/**
 * Spotify Web Playback SDK — one device per page.
 */
export function useSpotifyWebPlayback(accessToken) {
    const playerRef = useRef(null);
    const deviceIdRef = useRef(null);
    const [deviceId, setDeviceId] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const [isPaused, setIsPaused] = useState(true);
    const [error, setError] = useState(null);
    const [activeTrackUri, setActiveTrackUri] = useState(null);

    const getToken = useCallback(
        (cb) => {
            if (accessToken) {
                cb(accessToken);
            }
        },
        [accessToken],
    );

    useEffect(() => {
        if (!accessToken) {
            setIsReady(false);
            setDeviceId(null);
            deviceIdRef.current = null;
            return undefined;
        }

        let cancelled = false;
        let player = null;

        const init = async () => {
            try {
                setError(null);
                const Spotify = await loadSpotifyPlaybackSdk();
                if (cancelled) {
                    return;
                }

                player = new Spotify.Player({
                    name: 'Soundbloom Spotify Player',
                    getOAuthToken: getToken,
                    volume: 1,
                });
                playerRef.current = player;

                player.addListener('ready', ({ device_id }) => {
                    if (cancelled) {
                        return;
                    }
                    deviceIdRef.current = device_id;
                    setDeviceId(device_id);
                    setIsReady(true);
                });

                player.addListener('not_ready', ({ device_id }) => {
                    if (cancelled) {
                        return;
                    }
                    if (!device_id || device_id === deviceIdRef.current) {
                        deviceIdRef.current = null;
                        setDeviceId(null);
                        setIsReady(false);
                    }
                });

                player.addListener('player_state_changed', (state) => {
                    if (!state) {
                        return;
                    }
                    setIsPaused(state.paused);
                    const uri = state.track_window?.current_track?.uri;
                    if (uri) {
                        setActiveTrackUri(uri);
                    }
                });

                player.addListener('initialization_error', ({ message }) => {
                    setError(message || 'Spotify player initialization failed');
                });
                player.addListener('authentication_error', ({ message }) => {
                    setError(message || 'Spotify authentication failed');
                });
                player.addListener('account_error', ({ message }) => {
                    setError(
                        message || 'Spotify Premium is required for playback in the browser.',
                    );
                });
                player.addListener('playback_error', ({ message }) => {
                    setError(message || 'Spotify playback error');
                });

                const connected = await player.connect();
                if (!connected && !cancelled) {
                    setError('Could not connect to Spotify playback device.');
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.message || 'Failed to load Spotify playback SDK');
                }
            }
        };

        void init();

        return () => {
            cancelled = true;
            if (player) {
                player.disconnect();
            }
            playerRef.current = null;
            deviceIdRef.current = null;
        };
    }, [accessToken, getToken]);

    const playUri = useCallback(
        async (uri) => {
            const id = deviceIdRef.current;
            const player = playerRef.current;
            if (!accessToken || !id || !uri) {
                throw new Error('Spotify player is not ready');
            }

            if (player?.activateElement) {
                try {
                    await player.activateElement();
                } catch {
                    // Browser may block until a later gesture
                }
            }

            await playTrackOnDevice(id, uri, accessToken);
            setActiveTrackUri(uri);
            setIsPaused(false);
        },
        [accessToken],
    );

    const pause = useCallback(async () => {
        if (playerRef.current) {
            await playerRef.current.pause();
        } else if (accessToken) {
            await pausePlayback(accessToken);
        }
        setIsPaused(true);
    }, [accessToken]);

    const resume = useCallback(async () => {
        const player = playerRef.current;
        if (player?.activateElement) {
            try {
                await player.activateElement();
            } catch {
                // ignore
            }
        }
        if (player) {
            await player.resume();
        } else if (accessToken) {
            await resumePlayback(accessToken);
        }
        setIsPaused(false);
    }, [accessToken]);

    const seek = useCallback(
        async (positionMs) => {
            if (playerRef.current?.seek) {
                await playerRef.current.seek(positionMs);
            } else if (accessToken) {
                await seekPlayback(positionMs, accessToken);
            }
        },
        [accessToken],
    );

    const getCurrentState = useCallback(async () => {
        if (!playerRef.current) {
            return null;
        }
        return playerRef.current.getCurrentState();
    }, []);

    const playbackReady = isReady && !!deviceId;

    return {
        deviceId,
        isReady: playbackReady,
        isPaused,
        error,
        activeTrackUri,
        playUri,
        pause,
        resume,
        seek,
        getCurrentState,
        player: playerRef.current,
    };
}

export default useSpotifyWebPlayback;
