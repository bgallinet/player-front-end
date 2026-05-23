import { getRateLimitConfig } from '../hooks/anonymousConfig';

const rateLimitStore = new Map();
const { WINDOW_MS: RATE_LIMIT_WINDOW, MAX_REQUESTS: RATE_LIMIT_MAX_REQUESTS } = getRateLimitConfig();

const getAnonymousSessionId = () => {
    let sessionId = sessionStorage.getItem('anonymous_session_id');
    if (!sessionId) {
        sessionId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('anonymous_session_id', sessionId);
    }
    return sessionId;
};

const checkRateLimit = (sessionId) => {
    const now = Date.now();
    const userRequests = rateLimitStore.get(sessionId) || [];
    const validRequests = userRequests.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW);

    if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
        return false;
    }

    validRequests.push(now);
    rateLimitStore.set(sessionId, validRequests);
    return true;
};

const PublicAPICall = async (requestBody, url, useAuth = false) => {
    try {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (useAuth) {
            const idToken = localStorage.getItem('idToken');
            if (idToken) {
                headers.Authorization = `Bearer ${idToken}`;
            }
        } else {
            const sessionId = getAnonymousSessionId();
            headers['X-Anonymous-Session'] = sessionId;

            if (!checkRateLimit(sessionId)) {
                throw new Error('Rate limit exceeded. Please register for unlimited access.');
            }
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: requestBody,
        });

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }
            console.error(`HTTP error! status: ${response.status}`);
            return {
                body: JSON.stringify({
                    status: 'error',
                    message: `HTTP error: ${response.status}`,
                    statusCode: response.status,
                }),
            };
        }

        const data = await response.json();
        return {
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error('Error calling API ' + url + ':', error);
        return {
            body: JSON.stringify({
                error: error.message,
                statusCode: error.message.includes('Rate limit') ? 429 : 400,
            }),
        };
    }
};

export default PublicAPICall;
