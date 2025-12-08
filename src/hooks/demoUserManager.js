/**
 * Centralized demo user management utility
 * Handles generation and persistence of demo usernames across sessions
 */

const DEMO_USER_KEY = 'crowd_sensor_demo_username';
const DEMO_USER_PREFIX = 'demo_user';

/**
 * Generate a random demo username
 * @returns {string} Random demo username
 */
const generateDemoUsername = () => {
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `${DEMO_USER_PREFIX}_${randomStr}`;
};

/**
 * Get or create a demo username stored in localStorage
 * If no username exists, creates one and stores it
 * @returns {string} Demo username
 */
export const getDemoUsername = () => {
    try {
        let demoUsername = localStorage.getItem(DEMO_USER_KEY);
        
        if (!demoUsername) {
            demoUsername = generateDemoUsername();
            localStorage.setItem(DEMO_USER_KEY, demoUsername);
            console.log('Created new demo username:', demoUsername);
        }
        
        return demoUsername;
    } catch (error) {
        console.warn('Error accessing localStorage for demo username:', error);
        // Fallback to session-based username if localStorage fails
        return generateDemoUsername();
    }
};

/**
 * Clear the stored demo username (useful for testing or reset)
 */
export const clearDemoUsername = () => {
    try {
        localStorage.removeItem(DEMO_USER_KEY);
        console.log('Demo username cleared from localStorage');
    } catch (error) {
        console.warn('Error clearing demo username from localStorage:', error);
    }
};

/**
 * Check if user is in demo mode (not logged in)
 * @returns {boolean} True if user is in demo mode
 */
export const isDemoSession = () => {
    const token = localStorage.getItem('idToken');
    return !token || token.trim() === '';
};

/**
 * Get appropriate username for current session
 * Returns JWT token for authenticated users, demo username for non-authenticated
 * @returns {string} Username or token
 */
export const getCurrentUsername = () => {
    const token = localStorage.getItem('idToken');
    return token || getDemoUsername();
};

/**
 * Get user ID for analytics purposes
 * Returns JWT token for authenticated users, demo username for non-authenticated
 * @returns {string} User ID for analytics
 */
export const getUserIdForAnalytics = () => {
    const token = localStorage.getItem('idToken');
    return token || getDemoUsername();
};
