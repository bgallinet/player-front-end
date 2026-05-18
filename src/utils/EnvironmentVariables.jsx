//Powershell command for getting the API gateway URL:
// aws apigateway get-rest-apis --query "items[*].[id,name]" --output text | ForEach-Object { $parts = $_ -split '\s+'; $apiId = $parts[0]; $apiName = $parts[1]; $stages = aws apigateway get-stages --rest-api-id $apiId --query "item[*].stageName" --output text; $stages -split '\s+' | ForEach-Object { Write-Output "$apiName - https://$apiId.execute-api.us-east-1.amazonaws.com/$_" } }

const API_gateway_url = "https://s70no2w5sg.execute-api.eu-west-3.amazonaws.com/player-dev-stage-hjkl1qok"; // To be changed


// WebSocket URLs (without protocol - will be auto-detected based on page protocol)
const WebSocketURL = "ws-player-dev.crowd-sensor.com"; // Domain endpoint (HTTPS pages → wss://)
const WebSocketTestURL = "ws://player-dev-websocket-alb-383665997.eu-west-3.elb.amazonaws.com"; // ALB direct URL (HTTP pages → ws://)

const environment_flag = "dev"

// Dynamically detect protocol (http or https) based on current page
const getCurrentProtocol = () => {
    if (typeof window !== 'undefined') {
        return window.location.protocol; // 'http:' or 'https:'
    }
    return 'http:'; // Default fallback
};

const getCurrentHost = () => {
    if (typeof window !== 'undefined') {
        return window.location.host; // 'localhost:3000' or whatever
    }
    return 'localhost:3000'; // Default fallback
};

// Build redirect URI dynamically based on current page protocol
const RedirectURI = `${getCurrentProtocol()}//${getCurrentHost()}/callback`;

// Build AuthURL with dynamically detected redirect URI
const AuthURL = `https://d3o5hrtbl653it.auth.eu-west-3.amazoncognito.com/oauth2/authorize?client_id=3ng1jhbo6oemarms0uc9mhadak&response_type=code&scope=email+openid&redirect_uri=${encodeURIComponent(RedirectURI)}`;

const CognitoURL = 'https://d3o5hrtbl653it.auth.eu-west-3.amazoncognito.com/oauth2/token';

const ClientID = '3ng1jhbo6oemarms0uc9mhadak';

// SoundCloud API credentials loaded from .env.local (gitignored, never committed)
// Create web-app-front-end/.env.local with:
//   REACT_APP_SC_CLIENT_ID=your_client_id
//   REACT_APP_SC_CLIENT_SECRET=your_client_secret
const SC_ClientID = process.env.REACT_APP_SC_CLIENT_ID || '';
const SC_ClientSecret = process.env.REACT_APP_SC_CLIENT_SECRET || '';

// Spotify API credentials loaded from .env.local (gitignored, never committed)
// Create web-app-front-end/.env.local with:
//   REACT_APP_SPOTIFY_CLIENT_ID=your_client_id
//   REACT_APP_SPOTIFY_CLIENT_SECRET=your_client_secret  (optional for PKCE public client)
const SP_ClientID = process.env.REACT_APP_SPOTIFY_CLIENT_ID || '';
const SP_ClientSecret = process.env.REACT_APP_SPOTIFY_CLIENT_SECRET || '';

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
    SC_ClientID: SC_ClientID,
    SC_ClientSecret: SC_ClientSecret,
    SP_ClientID: SP_ClientID,
    SP_ClientSecret: SP_ClientSecret,
};

export default EnvironmentVariables;

// Export individual values for convenience
export const AnalyticsAPI_URL = EnvironmentVariables.AnalyticsAPI_URL;
export { WebSocketURL, WebSocketTestURL }; // Re-export WebSocket URLs