import EnvironmentVariables from '../EnvironmentVariables';

const COGNITO_HOSTED_UI = 'https://d3o5hrtbl653it.auth.eu-west-3.amazoncognito.com';

function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

async function generateCodeChallenge(verifier) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function buildPkceAuthorizeUrl(clientId, redirectUri, codeChallenge) {
    const url = new URL(`${COGNITO_HOSTED_UI}/oauth2/authorize`);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'email openid');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('code_challenge', codeChallenge);
    return url.toString();
}

/**
 * Dev: redirect using static AuthURL (no PKCE).
 * Prod/test: PKCE — store code_verifier in sessionStorage, then redirect to Cognito hosted UI.
 */
export async function initiateLogin() {
    const flag = EnvironmentVariables.environment_flag;

    if (flag !== 'prod' && flag !== 'test') {
        window.location.href = EnvironmentVariables.AuthURL;
        return;
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    try {
        sessionStorage.setItem('code_verifier', codeVerifier);
        localStorage.setItem('code_verifier_backup', codeVerifier);
    } catch (e) {
        console.error('Auth: could not store PKCE code_verifier', e);
        throw e;
    }

    window.location.href = buildPkceAuthorizeUrl(
        EnvironmentVariables.ClientID,
        EnvironmentVariables.RedirectURI,
        codeChallenge
    );
}

async function exchangeAuthorizationCode(params) {
    const response = await fetch(EnvironmentVariables.CognitoURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });
    return response.json();
}

function persistTokens(data) {
    localStorage.setItem('idToken', data.id_token);
    localStorage.setItem('accessToken', data.access_token);
}

/**
 * OAuth2 authorization_code exchange.
 * - Dev: no PKCE, no client_secret (public client).
 * - Prod/test: PKCE + client_secret from Amplify (REACT_APP_COGNITO_CLIENT_SECRET_* or fallback
 *   REACT_APP_COGNITO_CLIENT_SECRET on EnvironmentVariables).
 */
export async function fetchTokens(code) {
    if (!code) {
        throw new Error('No code provided');
    }

    const flag = EnvironmentVariables.environment_flag;

    try {
        if (flag !== 'prod' && flag !== 'test') {
            const params = new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: EnvironmentVariables.ClientID,
                code,
                redirect_uri: EnvironmentVariables.RedirectURI,
            });

            const data = await exchangeAuthorizationCode(params);
            if (data.error) {
                console.warn('Auth token error:', data.error, data.error_description);
                return null;
            }
            if (data.id_token && data.access_token) {
                persistTokens(data);
                return {
                    idToken: data.id_token,
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                };
            }
            return null;
        }

        const codeVerifier = sessionStorage.getItem('code_verifier');
        if (!codeVerifier) {
            throw new Error('Code verifier not found. Please sign in again.');
        }

        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: EnvironmentVariables.ClientID,
            code,
            redirect_uri: EnvironmentVariables.RedirectURI,
            code_verifier: codeVerifier,
        });

        const clientSecret = (EnvironmentVariables.CognitoClientSecret || '').trim();
        if (!clientSecret) {
            throw new Error(
                'Missing Cognito client secret. In Amplify set REACT_APP_COGNITO_CLIENT_SECRET_TEST (test app) or REACT_APP_COGNITO_CLIENT_SECRET_PROD (prod app), or REACT_APP_COGNITO_CLIENT_SECRET as a single fallback — then rebuild.'
            );
        }
        params.append('client_secret', clientSecret);

        const data = await exchangeAuthorizationCode(params);

        if (data.error) {
            console.warn('Auth token error:', data.error, data.error_description);
            return null;
        }

        if (data.id_token && data.access_token) {
            persistTokens(data);
            sessionStorage.removeItem('code_verifier');
            return {
                idToken: data.id_token,
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
            };
        }

        return null;
    } catch (error) {
        console.error('Auth fetchTokens:', error);
        if (flag === 'prod' || flag === 'test') {
            sessionStorage.removeItem('code_verifier');
        }
        return null;
    }
}

export function checkAuthStatus() {
    return Boolean(localStorage.getItem('idToken'));
}

export function checkPKCEDebug() {
    console.log('[PKCE debug]', {
        sessionKeys: typeof sessionStorage !== 'undefined' ? Object.keys(sessionStorage) : [],
        code_verifier_backup: localStorage.getItem('code_verifier_backup'),
    });
}
