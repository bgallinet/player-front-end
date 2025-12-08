/**
 * Configuration for anonymous user access
 * Defines limits and restrictions for unregistered users
 */

export const ANONYMOUS_CONFIG = {
    // Rate limiting
    RATE_LIMIT: {
        WINDOW_MS: 60000,        // 1 minute window
        MAX_REQUESTS: 500,       // 500 requests per minute (increased for body pose + landmarks)
        BURST_LIMIT: 100         // 100 requests in 10 seconds (increased for multiple simultaneous loads)
    },
    
    // Request size limits
    REQUEST_LIMITS: {
        MAX_BODY_SIZE: 1024 * 1024,  // 1MB max request body
        MAX_EMOTION_ARRAY: 100,       // Max 100 emotions per request
        MAX_TIMESTAMP_ARRAY: 100      // Max 100 timestamps per request
    },
    
    // Allowed request types for anonymous users
    ALLOWED_REQUEST_TYPES: [
        'info',           // Public information
        'analytics',      // Analytics (limited)
        'impression'      // Impressions (limited)
    ],
    
    // Restricted request types (require authentication)
    RESTRICTED_REQUEST_TYPES: [
        'user',           // User management
        'transaction',    // Transactions
        'administration', // Admin functions
        'songs'          // Song management
    ],
    
    // Session management
    SESSION: {
        MAX_DURATION_MS: 30 * 60 * 1000,  // 30 minutes max session
        CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // Cleanup every 5 minutes
        MAX_SESSIONS_PER_IP: 5             // Max 5 anonymous sessions per IP
    },
    
    // Feature restrictions
    FEATURES: {
        MAX_EMOTION_DETECTIONS: 50,     // Max emotion detections per session
        MAX_IMPRESSIONS: 20,            // Max impressions per session
        READ_ONLY_MODE: true,           // Anonymous users can only read
        NO_DATA_PERSISTENCE: true       // No data saved for anonymous users
    }
};

/**
 * Check if a request type is allowed for anonymous users
 * @param {string} requestType - The request type to check
 * @returns {boolean} - True if allowed, false otherwise
 */
export const isRequestTypeAllowed = (requestType) => {
    return ANONYMOUS_CONFIG.ALLOWED_REQUEST_TYPES.includes(requestType);
};

/**
 * Get rate limit configuration
 * @returns {Object} - Rate limit configuration
 */
export const getRateLimitConfig = () => {
    return ANONYMOUS_CONFIG.RATE_LIMIT;
};

/**
 * Get request size limits
 * @returns {Object} - Request size limits
 */
export const getRequestLimits = () => {
    return ANONYMOUS_CONFIG.REQUEST_LIMITS;
};
