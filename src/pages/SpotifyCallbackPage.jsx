import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpotifyAuth } from '../contexts/SpotifyAuthContext';
import { RETURN_ORIGIN_KEY } from './SpotifyConnectPage';
import { SPOTIFY_AUTH_MESSAGE } from '../utils/spotifyAuthBridge';

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

                if (result?.success && window.opener) {
                    const returnOrigin =
                        sessionStorage.getItem(RETURN_ORIGIN_KEY) || 'http://localhost:3000';
                    sessionStorage.removeItem(RETURN_ORIGIN_KEY);
                    window.opener.postMessage(
                        {
                            type: SPOTIFY_AUTH_MESSAGE,
                            tokens: result.tokens,
                            user: result.user,
                        },
                        returnOrigin,
                    );
                    window.close();
                    return;
                }

                if (result?.success) {
                    navigate('/spotifyplayer');
                } else {
                    navigate('/', {
                        state: { error: 'Spotify authentication failed. Please try again.' },
                    });
                }
            } catch (err) {
                console.error('Spotify callback error:', err);
                if (window.opener) {
                    const returnOrigin =
                        sessionStorage.getItem(RETURN_ORIGIN_KEY) || 'http://localhost:3000';
                    window.opener.postMessage(
                        { type: SPOTIFY_AUTH_MESSAGE, error: err.message || 'Spotify authentication failed.' },
                        returnOrigin,
                    );
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
