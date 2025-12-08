/**
 * Session utility functions for frontend
 * Handles session context extraction and management
 */

import { getDemoUsername, isDemoSession } from './demoUserManager';

/**
 * Extract session name from URL path
 * @returns {string|null} Session name from URL or null if not found
 */
export const getSessionNameFromUrl = () => {
    const pathSegments = window.location.pathname.split('/');
    const sessionFromUrl = pathSegments[pathSegments.length - 1];
    return sessionFromUrl || null;
};


/**
 * Create request body for API calls with proper authentication
 * @param {Object} baseData - Base request data
 * @param {boolean} isDemo - Whether this is a demo session
 * @param {boolean} includeSessionName - Whether to include session_name in the request body
 * @returns {Object} Request body with proper authentication
 */
export const createAuthenticatedRequestBody = (baseData, isDemo = false, includeSessionName = true) => {
    if (isDemo) {
        const body = {
            ...baseData,
            user_name: getDemoUsername()
        };
        if (includeSessionName) {
            body.session_name = getSessionNameFromUrl();  // Session context (public)
        }
        return body;
    } else {
        // For authenticated users:
        // - session_name stays in body (it's public browsing context) - only if requested
        // - idToken is removed (handled via Authorization header)
        // - user authentication via JWT in header
        const body = { ...baseData };
        if (includeSessionName) {
            body.session_name = getSessionNameFromUrl();  // Session context (public)
        }
        return body;
    }
};
