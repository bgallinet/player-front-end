// API Gateway URL - using custom domain for stable endpoint
const API_gateway_url = "https://rgiesci0s7.execute-api.eu-west-3.amazonaws.com/player-test-stage-dsafun3r";
const environment_flag = "test"

// WebSocket URLs
const WebSocketURL = "ws-test.crowd-sensor.com"; // Domain endpoint (HTTPS pages → wss://)
const WebSocketTestURL = "crowd-sensor-test-websocket-alb-293139646.eu-west-3.elb.amazonaws.com"; // ALB direct URL (HTTP pages → ws://)

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

// Test environment configuration
const ClientID = '48mbuimag81pc52odtsight2g5';
const RedirectURI = 'https://test.d22r3tk88qmw9i.amplifyapp.com/callback';

// AuthURL with PKCE for test (confidential client) - WITHOUT empty code_challenge
const AuthURL = `https://d3o5hrtbl653it.auth.eu-west-3.amazoncognito.com/oauth2/authorize?client_id=${ClientID}&response_type=code&scope=email+openid&redirect_uri=${encodeURIComponent(RedirectURI)}&code_challenge_method=S256`;

const CognitoURL = 'https://d3o5hrtbl653it.auth.eu-west-3.amazoncognito.com/oauth2/token'


// SoundCloud API credentials loaded from environment variables (never committed)
// Set REACT_APP_SC_CLIENT_ID and REACT_APP_SC_CLIENT_SECRET in the build environment
const SC_ClientID = process.env.REACT_APP_SC_CLIENT_ID || '';
const SC_ClientSecret = process.env.REACT_APP_SC_CLIENT_SECRET || '';

// Cognito app client secret (never commit). Amplify: set both names at app level if you like; this file picks by environment_flag:
//   test → REACT_APP_COGNITO_CLIENT_SECRET_TEST (or REACT_APP_COGNITO_CLIENT_SECRET)
//   prod → REACT_APP_COGNITO_CLIENT_SECRET_PROD (or REACT_APP_COGNITO_CLIENT_SECRET)
const CognitoClientSecret = (() => {
    const generic = (process.env.REACT_APP_COGNITO_CLIENT_SECRET || '').trim();
    if (environment_flag === 'prod') {
        return (process.env.REACT_APP_COGNITO_CLIENT_SECRET_PROD || generic).trim();
    }
    if (environment_flag === 'test') {
        return (process.env.REACT_APP_COGNITO_CLIENT_SECRET_TEST || generic).trim();
    }
    return '';
})();

const EnvironmentVariables = {
    AuthURL: AuthURL,
    UserAPI_URL: `${API_gateway_url}/process-data`,
    InfoAPI_URL: `${API_gateway_url}/info`,
    AnalyticsAPI_URL: `${API_gateway_url}/analytics`,
    WebSocketURL: WebSocketURL, // Domain endpoint (used for HTTPS pages)
    WebSocketTestURL: WebSocketTestURL, // ALB direct URL (used for HTTP pages)
    RedirectURI: RedirectURI,
    CognitoURL: CognitoURL,
    ClientID: ClientID,
    CognitoClientSecret: CognitoClientSecret,
    environment_flag: environment_flag,
    generateCodeVerifier: generateCodeVerifier,
    generateCodeChallenge: generateCodeChallenge,
    SC_ClientID: SC_ClientID,
    SC_ClientSecret: SC_ClientSecret,
};

export default EnvironmentVariables;

// Export individual values for convenience
export const AnalyticsAPI_URL = EnvironmentVariables.AnalyticsAPI_URL;
export { WebSocketURL, WebSocketTestURL };