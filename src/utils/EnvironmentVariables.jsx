// API Gateway URL - using custom domain for stable endpoint
const API_gateway_url = "https://9ic2sonafk.execute-api.eu-west-3.amazonaws.com/player-test-stage-yf4kl6vh";

// WebSocket URLs (without protocol - will be auto-detected based on page protocol)
const WebSocketURL = "ws-player-test.crowd-sensor.com"; // Domain endpoint (HTTPS pages → wss://)
const WebSocketTestURL = "player-test-websocket-alb-620473978.eu-west-3.elb.amazonaws.com"; // ALB direct URL (HTTP pages → ws://)

const environment_flag = "prod"

// PKCE helper functions for prod environment
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

// Prod environment configuration only
const ClientID = '13042d8nu2ed805be955pnhu0i';
const RedirectURI = 'https://soundbloom-player.com/callback';

// AuthURL with PKCE for prod (confidential client) - WITHOUT empty code_challenge
const AuthURL = `https://d3o5hrtbl653it.auth.eu-west-3.amazoncognito.com/oauth2/authorize?client_id=${ClientID}&response_type=code&scope=email+openid&redirect_uri=${encodeURIComponent(RedirectURI)}&code_challenge_method=S256`;

const CognitoURL = 'https://d3o5hrtbl653it.auth.eu-west-3.amazoncognito.com/oauth2/token';


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
    environment_flag: environment_flag,
    generateCodeVerifier: generateCodeVerifier,
    generateCodeChallenge: generateCodeChallenge
};

export default EnvironmentVariables;

// Export individual values for convenience
export const AnalyticsAPI_URL = EnvironmentVariables.AnalyticsAPI_URL;
export { WebSocketURL, WebSocketTestURL }; // Re-export WebSocket URLs