import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpotifyAuth } from '../contexts/SpotifyAuthContext';
import {
    SPOTIFY_AUTH_MESSAGE,
    SPOTIFY_RETURN_ORIGIN_KEY,
    SPOTIFY_RETURN_PATH_KEY,
    getSpotifyDevOrigins,
    getSpotifyLoopbackOrigin,
} from '../utils/spotifyAuthBridge';

const SpotifyCallbackPage = () => {
    const { handleCallback } = useSpotifyAuth();
    const navigate = useNavigate();
    const processedRef = useRef(false);

    useEffect(() => {
        const processAuth = async () => {
            if (processedRef.current) return;
            processedRef.current = true;

            try {
                const params = new URLSearchParams(window.location.search);
                const code = params.get('code');
                const error = params.get('error');

                if (error) {
                    throw new Error(`Spotify authorization denied: ${error}`);
                }

                if (!code) {
                    throw new Error('No authorization code found');
                }

                const state = params.get('state');
                const result = await handleCallback(code, state);

                if (result?.success) {
                    const returnOrigin =
                        sessionStorage.getItem(SPOTIFY_RETURN_ORIGIN_KEY) || getSpotifyLoopbackOrigin();
                    const returnPath = sessionStorage.getItem(SPOTIFY_RETURN_PATH_KEY);
                    const message = {
                        type: SPOTIFY_AUTH_MESSAGE,
                        tokens: result.tokens,
                        user: result.user,
                    };

                    const postToOpener = () => {
                        if (!window.opener || window.opener.closed) return false;
                        const targets = new Set([
                            returnOrigin,
                            ...getSpotifyDevOrigins(),
                            getSpotifyLoopbackOrigin(),
                        ]);
                        for (const target of targets) {
                            try {
                                window.opener.postMessage(message, target);
                                return true;
                            } catch {
                                // try next origin
                            }
                        }
                        return false;
                    };

                    if (postToOpener()) {
                        sessionStorage.removeItem(SPOTIFY_RETURN_ORIGIN_KEY);
                        sessionStorage.removeItem(SPOTIFY_RETURN_PATH_KEY);
                        window.close();
                        return;
                    }

                    sessionStorage.removeItem(SPOTIFY_RETURN_ORIGIN_KEY);
                    sessionStorage.removeItem(SPOTIFY_RETURN_PATH_KEY);
                    navigate(returnPath || '/', { replace: true });
                    return;
                } else {
                    navigate('/', {
                        state: { error: 'Spotify authentication failed. Please try again.' },
                    });
                }
            } catch (err) {
                console.error('Spotify callback error:', err);
                if (window.opener && !window.opener.closed) {
                    const returnOrigin =
                        sessionStorage.getItem(SPOTIFY_RETURN_ORIGIN_KEY) || getSpotifyLoopbackOrigin();
                    const targets = new Set([returnOrigin, ...getSpotifyDevOrigins(), getSpotifyLoopbackOrigin()]);
                    for (const target of targets) {
                        try {
                            window.opener.postMessage(
                                {
                                    type: SPOTIFY_AUTH_MESSAGE,
                                    error: err.message || 'Spotify authentication failed.',
                                },
                                target,
                            );
                            break;
                        } catch {
                            // try next origin
                        }
                    }
                    window.close();
                    return;
                }
                navigate('/', {
                    state: { error: err.message || 'Spotify authentication failed.' },
                });
            }
        };

        void processAuth();
    }, [handleCallback, navigate]);

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                color: 'white',
                backgroundColor: '#1a1a1a',
            }}
        >
            Connecting to Spotify...
        </div>
    );
};

export default SpotifyCallbackPage;
