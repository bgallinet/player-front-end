import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
    generateCodeVerifier,
    generateCodeChallenge,
    generateState,
    getAuthUrl,
    exchangeCodeForToken,
    refreshAccessToken,
    getMe,
} from '../utils/spotifyService';
import {
    SPOTIFY_AUTH_MESSAGE,
    SPOTIFY_RETURN_PATH_KEY,
    SPOTIFY_RETURN_ORIGIN_KEY,
    getSpotifyConnectUrl,
    isSpotifyLocalhostDev,
    isTrustedSpotifyAuthMessageOrigin,
} from '../utils/spotifyAuthBridge';

const SpotifyAuthContext = React.createContext(null);

export function useSpotifyAuth() {
    const context = useContext(SpotifyAuthContext);
    if (!context) {
        throw new Error('useSpotifyAuth must be used within a SpotifyAuthProvider');
    }
    return context;
}

export function SpotifyAuthProvider({ children }) {
    const [accessToken, setAccessToken] = useState(null);
    const [, setRefreshToken] = useState(null);
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const spotifyPopupPollRef = useRef(null);

    const isAuthenticated = !!accessToken;

    const clearError = useCallback(() => setError(null), []);

    const saveTokens = useCallback((tokens) => {
        if (tokens.access_token) {
            localStorage.setItem('sp_access_token', tokens.access_token);
            setAccessToken(tokens.access_token);
        }
        if (tokens.refresh_token) {
            localStorage.setItem('sp_refresh_token', tokens.refresh_token);
            setRefreshToken(tokens.refresh_token);
        }
        if (tokens.expires_in) {
            const expiresAt = Date.now() + tokens.expires_in * 1000;
            localStorage.setItem('sp_token_expires_at', expiresAt.toString());
        }
    }, []);

    const loadUserProfile = useCallback(async (token) => {
        try {
            const profile = await getMe(token);
            setUser(profile);
            localStorage.setItem('sp_user', JSON.stringify(profile));
        } catch (err) {
            console.error('Failed to load Spotify user profile:', err);
        }
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('sp_access_token');
        localStorage.removeItem('sp_refresh_token');
        localStorage.removeItem('sp_token_expires_at');
        localStorage.removeItem('sp_user');
        sessionStorage.removeItem('sp_code_verifier');
        sessionStorage.removeItem('sp_state');
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
        setError(null);
    }, []);

    useEffect(() => {
        const restoreSession = async () => {
            try {
                const storedToken = localStorage.getItem('sp_access_token');
                const storedRefresh = localStorage.getItem('sp_refresh_token');
                const storedUser = localStorage.getItem('sp_user');
                const expiresAt = localStorage.getItem('sp_token_expires_at');

                if (!storedToken) {
                    setIsLoading(false);
                    return;
                }

                if (expiresAt && Date.now() > parseInt(expiresAt, 10)) {
                    if (storedRefresh) {
                        const tokens = await refreshAccessToken(storedRefresh);
                        saveTokens(tokens);
                        await loadUserProfile(tokens.access_token);
                    } else {
                        logout();
                    }
                } else {
                    setAccessToken(storedToken);
                    setRefreshToken(storedRefresh);
                    if (storedUser) {
                        setUser(JSON.parse(storedUser));
                    } else {
                        await loadUserProfile(storedToken);
                    }
                }
            } catch (err) {
                console.error('Failed to restore Spotify session:', err);
                logout();
            } finally {
                setIsLoading(false);
            }
        };

        void restoreSession();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const clearSpotifyPopupPoll = useCallback(() => {
        if (spotifyPopupPollRef.current) {
            clearInterval(spotifyPopupPollRef.current);
            spotifyPopupPollRef.current = null;
        }
    }, []);

    const completeAuthFromPopup = useCallback(
        async ({ tokens, user: profile }) => {
            clearSpotifyPopupPoll();
            saveTokens(tokens);
            sessionStorage.removeItem('sp_code_verifier');
            sessionStorage.removeItem('sp_state');
            if (profile) {
                setUser(profile);
                localStorage.setItem('sp_user', JSON.stringify(profile));
            } else if (tokens?.access_token) {
                await loadUserProfile(tokens.access_token);
            }
            setIsLoading(false);
        },
        [clearSpotifyPopupPoll, saveTokens, loadUserProfile],
    );

    useEffect(() => {
        if (!isSpotifyLocalhostDev()) return undefined;

        const onMessage = (event) => {
            if (!isTrustedSpotifyAuthMessageOrigin(event.origin)) return;
            if (event.data?.type !== SPOTIFY_AUTH_MESSAGE) return;

            if (event.data.error) {
                clearSpotifyPopupPoll();
                setError(event.data.error);
                setIsLoading(false);
                return;
            }

            void completeAuthFromPopup({
                tokens: event.data.tokens,
                user: event.data.user,
            });
        };

        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [clearSpotifyPopupPoll, completeAuthFromPopup]);

    useEffect(() => () => clearSpotifyPopupPoll(), [clearSpotifyPopupPoll]);

    const initiateLogin = useCallback(async () => {
        try {
            setError(null);
            setIsLoading(true);
            clearSpotifyPopupPoll();

            sessionStorage.setItem(
                SPOTIFY_RETURN_PATH_KEY,
                `${window.location.pathname}${window.location.search}`,
            );

            if (isSpotifyLocalhostDev()) {
                sessionStorage.setItem(SPOTIFY_RETURN_ORIGIN_KEY, window.location.origin);

                const url = getSpotifyConnectUrl(window.location.origin);
                const popup = window.open(url, 'spotify-auth', 'width=520,height=720');
                if (!popup) {
                    setIsLoading(false);
                    setError('Allow pop-ups for this site to connect Spotify.');
                    return;
                }

                spotifyPopupPollRef.current = setInterval(() => {
                    if (!popup.closed) return;
                    clearSpotifyPopupPoll();
                    setIsLoading(false);
                }, 500);
                return;
            }

            const codeVerifier = generateCodeVerifier();
            const codeChallenge = await generateCodeChallenge(codeVerifier);
            const state = generateState();

            sessionStorage.setItem('sp_code_verifier', codeVerifier);
            sessionStorage.setItem('sp_state', state);

            window.location.href = getAuthUrl(codeChallenge, state);
        } catch (err) {
            console.error('Failed to initiate Spotify login:', err);
            clearSpotifyPopupPoll();
            setIsLoading(false);
            setError('Failed to start login. Please try again.');
        }
    }, [clearSpotifyPopupPoll]);

    const handleCallback = useCallback(
        async (code, returnedState) => {
            try {
                setIsLoading(true);
                setError(null);

                const storedState = sessionStorage.getItem('sp_state');
                if (!storedState || storedState !== returnedState) {
                    throw new Error('State mismatch - please try logging in again.');
                }

                const codeVerifier = sessionStorage.getItem('sp_code_verifier');
                if (!codeVerifier) {
                    throw new Error('Code verifier not found. Please try logging in again.');
                }

                const tokens = await exchangeCodeForToken(code, codeVerifier);
                saveTokens(tokens);

                sessionStorage.removeItem('sp_code_verifier');
                sessionStorage.removeItem('sp_state');

                const profile = await getMe(tokens.access_token);
                setUser(profile);
                localStorage.setItem('sp_user', JSON.stringify(profile));
                return { success: true, tokens, user: profile };
            } catch (err) {
                console.error('Spotify callback error:', err);
                setError(err.message || 'Authentication failed. Please try again.');
                sessionStorage.removeItem('sp_code_verifier');
                sessionStorage.removeItem('sp_state');
                return { success: false };
            } finally {
                setIsLoading(false);
            }
        },
        [saveTokens],
    );

    return (
        <SpotifyAuthContext.Provider
            value={{
                accessToken,
                user,
                isAuthenticated,
                isLoading,
                error,
                clearError,
                initiateLogin,
                handleCallback,
                logout,
            }}
        >
            {children}
        </SpotifyAuthContext.Provider>
    );
}

export default SpotifyAuthContext;
