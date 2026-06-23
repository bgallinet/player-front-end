/**
 * Session utility functions for frontend
 * Handles session context extraction and management
 */

export const ANALYTICS_SESSION_OVERRIDE_KEY = 'analytics_session_name_override';

/**
 * Extract session name from URL path
 * @returns {string|null} Session name from URL or null if not found
 */
export const getSessionNameFromUrl = () => {
    try {
        const overrideSessionName = sessionStorage.getItem(ANALYTICS_SESSION_OVERRIDE_KEY);
        if (overrideSessionName && overrideSessionName.trim().length > 0) {
            return overrideSessionName;
        }
    } catch {
        // Ignore storage access failures and fall back to URL-derived session.
    }

    const pathSegments = window.location.pathname.split('/');
    const sessionFromUrl = pathSegments[pathSegments.length - 1];
    return sessionFromUrl || null;
};


/**
 * Create request body for API calls with proper authentication
 * @param {Object} baseData - Base request data
 * @param {boolean} includeSessionName - Whether to include session_name in the request body
 * @returns {Object} Request body with proper authentication
 */
export const createAuthenticatedRequestBody = (baseData, includeSessionName = true) => {
    const body = { ...baseData };
    if (includeSessionName) {
        body.session_name = getSessionNameFromUrl();
    }
    return body;
};
