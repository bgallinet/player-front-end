import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    generateCodeVerifier,
    generateCodeChallenge,
    generateState,
    getAuthUrl,
    exchangeCodeForToken,
    refreshAccessToken,
    getMe,
} from '../utils/soundcloudService';

const SoundCloudAuthContext = React.createContext(null);

export function useSoundCloudAuth() {
    const context = useContext(SoundCloudAuthContext);
    if (!context) {
        throw new Error('useSoundCloudAuth must be used within a SoundCloudAuthProvider');
    }
    return context;
}

export function SoundCloudAuthProvider({ children }) {
    const [accessToken, setAccessToken] = useState(null);
    const [refreshToken, setRefreshToken] = useState(null);
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const isAuthenticated = !!accessToken;

    const clearError = useCallback(() => setError(null), []);

    // Persist tokens to localStorage
    const saveTokens = useCallback((tokens) => {
        if (tokens.access_token) {
            localStorage.setItem('sc_access_token', tokens.access_token);
            setAccessToken(tokens.access_token);
        }
        if (tokens.refresh_token) {
            localStorage.setItem('sc_refresh_token', tokens.refresh_token);
            setRefreshToken(tokens.refresh_token);
        }
        if (tokens.expires_in) {
            const expiresAt = Date.now() + tokens.expires_in * 1000;
            localStorage.setItem('sc_token_expires_at', expiresAt.toString());
        }
    }, []);

    // Load user profile after authentication
    const loadUserProfile = useCallback(async (token) => {
        try {
            const profile = await getMe(token);
            setUser(profile);
            localStorage.setItem('sc_user', JSON.stringify(profile));
        } catch (err) {
            console.error('Failed to load SoundCloud user profile:', err);
        }
    }, []);

    // Restore session from localStorage on mount
    useEffect(() => {
        const restoreSession = async () => {
            try {
                const storedToken = localStorage.getItem('sc_access_token');
                const storedRefresh = localStorage.getItem('sc_refresh_token');
                const storedUser = localStorage.getItem('sc_user');
                const expiresAt = localStorage.getItem('sc_token_expires_at');

                if (!storedToken) {
                    setIsLoading(false);
                    return;
                }

                // Check if token is expired
                if (expiresAt && Date.now() > parseInt(expiresAt, 10)) {
                    if (storedRefresh) {
                        const tokens = await refreshAccessToken(storedRefresh);
                        saveTokens(tokens);
                        await loadUserProfile(tokens.access_token);
                    } else {
                        // No refresh token, clear session
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
                console.error('Failed to restore SoundCloud session:', err);
                logout();
            } finally {
                setIsLoading(false);
            }
        };

        restoreSession();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    /**
     * Initiate SoundCloud OAuth login with PKCE + state (CSRF protection).
     * See: https://developers.soundcloud.com/docs/api/guide#authorization-code-flow
     */
    const initiateLogin = useCallback(async () => {
        try {
            setError(null);
            const codeVerifier = generateCodeVerifier();
            const codeChallenge = await generateCodeChallenge(codeVerifier);
            const state = generateState();

            // Store code verifier and state for the callback
            sessionStorage.setItem('sc_code_verifier', codeVerifier);
            sessionStorage.setItem('sc_state', state);

            const authUrl = getAuthUrl(codeChallenge, state);
            window.location.href = authUrl;
        } catch (err) {
            console.error('Failed to initiate SoundCloud login:', err);
            setError('Failed to start login. Please try again.');
        }
    }, []);

    /**
     * Handle the OAuth callback - verify state and exchange code for tokens
     */
    const handleCallback = useCallback(async (code, returnedState) => {
        try {
            setIsLoading(true);
            setError(null);

            // Verify CSRF state parameter
            const storedState = sessionStorage.getItem('sc_state');
            if (!storedState || storedState !== returnedState) {
                throw new Error('State mismatch - possible CSRF attack. Please try logging in again.');
            }

            const codeVerifier = sessionStorage.getItem('sc_code_verifier');
            if (!codeVerifier) {
                throw new Error('Code verifier not found. Please try logging in again.');
            }

            const tokens = await exchangeCodeForToken(code, codeVerifier);
            saveTokens(tokens);

            // Clean up
            sessionStorage.removeItem('sc_code_verifier');
            sessionStorage.removeItem('sc_state');

            // Load user profile
            await loadUserProfile(tokens.access_token);

            return true;
        } catch (err) {
            console.error('SoundCloud callback error:', err);
            setError(err.message || 'Authentication failed. Please try again.');
            sessionStorage.removeItem('sc_code_verifier');
            sessionStorage.removeItem('sc_state');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [saveTokens, loadUserProfile]);

    /**
     * Log out and clear all SoundCloud session data
     */
    const logout = useCallback(() => {
        localStorage.removeItem('sc_access_token');
        localStorage.removeItem('sc_refresh_token');
        localStorage.removeItem('sc_token_expires_at');
        localStorage.removeItem('sc_user');
        sessionStorage.removeItem('sc_code_verifier');
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
        setError(null);
    }, []);

    return (
        <SoundCloudAuthContext.Provider value={{
            accessToken,
            user,
            isAuthenticated,
            isLoading,
            error,
            clearError,
            initiateLogin,
            handleCallback,
            logout,
        }}>
            {children}
        </SoundCloudAuthContext.Provider>
    );
}

export default SoundCloudAuthContext;
