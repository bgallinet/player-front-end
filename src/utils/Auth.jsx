import EnvironmentVariables from './EnvironmentVariables';

// PKCE helper functions for prod and test environments
const generateCodeVerifier = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

const generateCodeChallenge = async (verifier) => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

// Generate PKCE challenge and redirect to Cognito (PROD and TEST)
export const initiateLogin = async () => {
    try {
        console.log('🔍 initiateLogin called');
        console.log('🔍 Environment flag:', EnvironmentVariables.environment_flag);
        console.log('🔍 Base AuthURL:', EnvironmentVariables.AuthURL);
        
        // Check if we're in prod or test environment (both use PKCE with client secret)
        if (EnvironmentVariables.environment_flag !== 'prod' && EnvironmentVariables.environment_flag !== 'test') {
            console.log('🔍 Non-prod/test environment, using simple redirect');
            // For non-prod/test environments, use simple redirect
            window.location.href = EnvironmentVariables.AuthURL;
            return;
        }

        console.log(`🔍 ${EnvironmentVariables.environment_flag.toUpperCase()} environment detected, generating PKCE`);
        
        // PROD/TEST: Generate PKCE code verifier and challenge
        const codeVerifier = generateCodeVerifier();
        console.log('🔍 Code verifier generated:', codeVerifier);
        
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        console.log('🔍 Code challenge generated:', codeChallenge);
        
        // Store code verifier in MULTIPLE storages for maximum persistence across redirects
        // Use setItem with try-catch to handle any storage errors
        try {
            localStorage.setItem('code_verifier', codeVerifier); // Primary storage
            sessionStorage.setItem('code_verifier', codeVerifier); // Session backup
            localStorage.setItem('code_verifier_backup', codeVerifier); // Explicit backup
            localStorage.setItem('code_verifier_timestamp', Date.now().toString()); // Timestamp for debugging
            
            // Cookie backup for maximum persistence across cross-domain redirects
            document.cookie = `code_verifier=${codeVerifier}; path=/; max-age=300; SameSite=Lax`;
            
            // Verify storage was successful
            console.log('🔍 Storage verification:');
            console.log('🔍 - localStorage set:', localStorage.getItem('code_verifier') === codeVerifier);
            console.log('🔍 - sessionStorage set:', sessionStorage.getItem('code_verifier') === codeVerifier);
            console.log('🔍 - localStorage backup set:', localStorage.getItem('code_verifier_backup') === codeVerifier);
            console.log('🔍 - cookie set:', document.cookie.includes(codeVerifier));
        } catch (storageError) {
            console.error('🔍 Storage error:', storageError);
            // Fallback: at least ensure backup is stored
            try {
                localStorage.setItem('code_verifier_backup', codeVerifier);
                console.log('🔍 Fallback: stored in localStorage backup only');
            } catch (fallbackError) {
                console.error('🔍 Critical: Could not store code verifier anywhere!', fallbackError);
            }
        }
        
        console.log('🔍 Code verifier stored in multiple locations:');
        console.log('🔍 - localStorage:', localStorage.getItem('code_verifier'));
        console.log('🔍 - sessionStorage:', sessionStorage.getItem('code_verifier'));
        console.log('🔍 - localStorage backup:', localStorage.getItem('code_verifier_backup'));
        console.log('🔍 - cookie:', document.cookie.includes('code_verifier'));
        console.log('🔍 All localStorage keys:', Object.keys(localStorage));
        
        // Build AuthURL with PKCE challenge - FIXED: Add &code_challenge= parameter
        const authUrl = EnvironmentVariables.AuthURL + '&code_challenge=' + codeChallenge;
        console.log('🔍 Final AuthURL:', authUrl);
        
        // SIMPLE STANDARD APPROACH: Store in sessionStorage (survives redirects)
        sessionStorage.setItem('code_verifier', codeVerifier);
        console.log('🔍 Code verifier stored in sessionStorage:', codeVerifier);
        
        // Redirect to Cognito with challenge
        console.log('🔍 Redirecting to Cognito...');
        window.location.href = authUrl;
    } catch (error) {
        console.error('❌ Login initiation error:', error);
        throw error;
    }
};

export const fetchTokens = async (code) => {
    if (!code) {
        throw new Error('No code provided');
    }

    try {
        // Check if we're in prod or test environment (both use PKCE with client secret)
        if (EnvironmentVariables.environment_flag !== 'prod' && EnvironmentVariables.environment_flag !== 'test') {
            // For non-prod/test environments, use simple token exchange
            const params = new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: EnvironmentVariables.ClientID,
                code: code,
                redirect_uri: EnvironmentVariables.RedirectURI
            });

            const response = await fetch(EnvironmentVariables.CognitoURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });

            const data = await response.json();

            if (data.error) {
                console.log('Token error:', data.error);
                return null;
            }
            
            if (data.id_token && data.access_token) {
                localStorage.setItem('idToken', data.id_token);
                localStorage.setItem('accessToken', data.access_token);
                
                return {
                    idToken: data.id_token,
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token
                };
            }
            
            return null;
        }

        // SIMPLE STANDARD APPROACH: Get code verifier from sessionStorage
        console.log('🔍 fetchTokens: Getting code verifier from sessionStorage');
        const codeVerifier = sessionStorage.getItem('code_verifier');
        
        if (!codeVerifier) {
            console.error('🔍 fetchTokens: Code verifier not found in sessionStorage');
            throw new Error('Code verifier not found. Please try logging in again.');
        }
        
        console.log('🔍 fetchTokens: Found code verifier:', codeVerifier);
        
        if (!codeVerifier) {
            console.error('🔍 fetchTokens: Code verifier not found in localStorage');
            console.error('🔍 fetchTokens: localStorage keys:', Object.keys(localStorage));
            throw new Error('Code verifier not found. Please try logging in again.');
        }

        // Build params for prod/test environment (with client secret)
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: EnvironmentVariables.ClientID,
            code: code,
            redirect_uri: EnvironmentVariables.RedirectURI,
            code_verifier: codeVerifier // PKCE code verifier
        });

        // Add client secret for prod and test environments
        if (EnvironmentVariables.environment_flag === 'prod') {
            params.append('client_secret', '1kpm2jfmlh6aunhk07bd6qmovmfvjvdfahtq4m1fucsruv7p9mvv');
            console.log('🔍 fetchTokens: Added client secret for prod environment');
        } else if (EnvironmentVariables.environment_flag === 'test') {
            // TODO: Replace with actual test client secret
            params.append('client_secret', '338ljs5vkn841u2alf47shutdnfb4067eisgnnoifa6bvqgvbnp');
            console.log('🔍 fetchTokens: Added client secret for test environment');
        }

        console.log('🔍 fetchTokens: Final params for token exchange:', params.toString());
        console.log('🔍 fetchTokens: Making request to:', EnvironmentVariables.CognitoURL);

        const response = await fetch(EnvironmentVariables.CognitoURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        console.log('🔍 fetchTokens: Response status:', response.status);
        console.log('🔍 fetchTokens: Response headers:', Object.fromEntries(response.headers.entries()));

        const data = await response.json();
        console.log('🔍 fetchTokens: Response data:', data);

        // Check if we got an error response
        if (data.error) {
            console.log('Token error:', data.error);
            console.log('🔍 fetchTokens: Token exchange failed with error:', data);
            return null;
        }
        
        if (data.id_token && data.access_token) {
            console.log('🔍 fetchTokens: Token exchange successful!');
            console.log('🔍 fetchTokens: id_token length:', data.id_token.length);
            console.log('🔍 fetchTokens: access_token length:', data.access_token.length);
            console.log('🔍 fetchTokens: refresh_token present:', !!data.refresh_token);
            
            localStorage.setItem('idToken', data.id_token);
            localStorage.setItem('accessToken', data.access_token);
            console.log('🔍 fetchTokens: Tokens stored in localStorage');
            
            // Clean up code verifier from sessionStorage
            sessionStorage.removeItem('code_verifier');
            console.log('🔍 fetchTokens: Code verifier cleaned up from sessionStorage');
            
            return {
                idToken: data.id_token,
                accessToken: data.access_token,
                refreshToken: data.refresh_token
            };
        }
        
        console.log('🔍 fetchTokens: Token exchange succeeded but missing required tokens');
        console.log('🔍 fetchTokens: Available data keys:', Object.keys(data));
        return null;

    } catch (error) {
        console.error('Error fetching tokens:', error);
        // Clean up code verifier from sessionStorage on error (PROD/TEST only)
        if (EnvironmentVariables.environment_flag === 'prod' || EnvironmentVariables.environment_flag === 'test') {
            sessionStorage.removeItem('code_verifier');
        }
        return null;
    }
};

export const checkAuthStatus = () => {
    const idToken = localStorage.getItem('idToken');
    return idToken ? true : false;
};

// Debug function to check PKCE debug info
export const checkPKCEDebug = () => {
    console.log('🔍 PKCE Debug Info:');
    console.log('🔍 pkce_debug:', localStorage.getItem('pkce_debug'));
    console.log('🔍 pkce_callback_debug:', localStorage.getItem('pkce_callback_debug'));
    console.log('🔍 pkce_failure_debug:', localStorage.getItem('pkce_failure_debug'));
    console.log('🔍 code_verifier_backup:', localStorage.getItem('code_verifier_backup'));
    console.log('🔍 Current sessionStorage keys:', Object.keys(sessionStorage));
    console.log('🔍 Current localStorage keys:', Object.keys(localStorage));
};
