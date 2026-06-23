import { useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSpotifyAuth } from '../contexts/SpotifyAuthContext';
import { useSoundCloudAuth } from '../contexts/SoundCloudAuthContext';
import { initiateLogin as initiateTuneTribesLogin } from '../utils/Auth';
import { PLAYER_AUTH, PLAYER_AUTH_LABELS } from '../utils/playerAuthConfig';

/**
 * Auth readiness for a player route's required provider.
 */
export function usePlayerAuthStatus(authType) {
    const { idToken, isAuthInitializing } = useAuth();
    const {
        isAuthenticated: spotifyAuthenticated,
        isLoading: spotifyLoading,
        initiateLogin: initiateSpotifyLogin,
    } = useSpotifyAuth();
    const {
        isAuthenticated: soundCloudAuthenticated,
        isLoading: soundCloudLoading,
        initiateLogin: initiateSoundCloudLogin,
    } = useSoundCloudAuth();

    const loginTuneTribes = useCallback(() => {
        initiateTuneTribesLogin();
    }, []);

    const loginSpotify = useCallback(() => {
        void initiateSpotifyLogin();
    }, [initiateSpotifyLogin]);

    const loginSoundCloud = useCallback(() => {
        void initiateSoundCloudLogin();
    }, [initiateSoundCloudLogin]);

    return useMemo(() => {
        const providerLabel = PLAYER_AUTH_LABELS[authType] || 'your account';

        if (authType === PLAYER_AUTH.TUNETRIBES) {
            return {
                providerLabel,
                isAuthenticated: Boolean(idToken),
                isLoading: isAuthInitializing,
                initiateLogin: loginTuneTribes,
            };
        }

        if (authType === PLAYER_AUTH.SPOTIFY) {
            return {
                providerLabel,
                isAuthenticated: spotifyAuthenticated,
                isLoading: spotifyLoading,
                initiateLogin: loginSpotify,
            };
        }

        if (authType === PLAYER_AUTH.SOUNDCLOUD) {
            return {
                providerLabel,
                isAuthenticated: soundCloudAuthenticated,
                isLoading: soundCloudLoading,
                initiateLogin: loginSoundCloud,
            };
        }

        return {
            providerLabel,
            isAuthenticated: false,
            isLoading: false,
            initiateLogin: () => {},
        };
    }, [
        authType,
        idToken,
        isAuthInitializing,
        spotifyAuthenticated,
        spotifyLoading,
        soundCloudAuthenticated,
        soundCloudLoading,
        loginTuneTribes,
        loginSpotify,
        loginSoundCloud,
    ]);
}
