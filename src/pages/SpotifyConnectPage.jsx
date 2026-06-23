import React, { useEffect, useRef } from 'react';
import {
    generateCodeVerifier,
    generateCodeChallenge,
    generateState,
    getAuthUrl,
} from '../utils/spotifyService';

import { SPOTIFY_RETURN_ORIGIN_KEY } from '../utils/spotifyAuthBridge';

export const RETURN_ORIGIN_KEY = SPOTIFY_RETURN_ORIGIN_KEY;

const SpotifyConnectPage = () => {
    const startedRef = useRef(false);

    useEffect(() => {
        const run = async () => {
            if (startedRef.current) return;
            startedRef.current = true;

            const params = new URLSearchParams(window.location.search);
            const returnOrigin = params.get('return_origin');
            if (returnOrigin) {
                sessionStorage.setItem(SPOTIFY_RETURN_ORIGIN_KEY, returnOrigin);
            }

            const codeVerifier = generateCodeVerifier();
            const codeChallenge = await generateCodeChallenge(codeVerifier);
            const state = generateState();

            sessionStorage.setItem('sp_code_verifier', codeVerifier);
            sessionStorage.setItem('sp_state', state);

            window.location.href = getAuthUrl(codeChallenge, state);
        };

        void run();
    }, []);

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
            Redirecting to Spotify...
        </div>
    );
};

export default SpotifyConnectPage;
