import AnalyticsAPI from '../utils/AnalyticsAPI';
import UserAPI from '../utils/UserAPI';
import { createAuthenticatedRequestBody } from './sessionUtils';
import { isDemoSession, getDemoUsername } from './demoUserManager';

/**
 * Simple event tracking utility without experiment dependencies
 * Provides direct tracking to analytics API for authenticated and anonymous users
 */
export const trackSimpleEvent = async (eventData) => {
    try {
        console.log('📊 Tracking simple event:', eventData);
        
        const requestBody = {
            request_type: 'analytics',
            interaction_type: eventData.interaction_type,
            session_name: eventData.session_name || 'default',
            element_id: eventData.element_id,
            page_url: eventData.page_url || window.location.href,
            duration_ms: eventData.detection_duration || eventData.duration_ms,
            // Add user_name for demo sessions
            ...(isDemoSession() && { user_name: getDemoUsername() }),
            ...eventData // Include any additional data
        };

        // Check if user is authenticated (not demo session)
        const isAuthenticated = !isDemoSession();
        
        if (isAuthenticated) {
            const authenticatedBody = createAuthenticatedRequestBody(requestBody, false, true);
            await UserAPI(JSON.stringify(authenticatedBody));
        } else {
            await AnalyticsAPI(JSON.stringify(requestBody), false);
        }
        
        console.log('✅ Simple event tracked successfully');
        return true;
    } catch (error) {
        console.error('❌ Simple tracking error:', error);
        return false;
    }
};

/**
 * Track music style selection events
 */
export const trackMusicStyleSelection = async (style) => {
    return await trackSimpleEvent({
        'interaction_type': 'music_style_selected',
        'element_id': `music_style_${style.id}`,
        'page_url': window.location.href,
        'music_style': style.id,
        'music_style_name': style.name,
        'session_name': style.session
    });
};

/**
 * Track button click events
 */
export const trackButtonClick = async (buttonId, pageUrl = null, additionalData = {}) => {
    return await trackSimpleEvent({
        'interaction_type': 'button_click',
        'element_id': buttonId,
        'page_url': pageUrl || window.location.href,
        ...additionalData
    });
};

/**
 * Track page navigation events
 */
export const trackPageNavigation = async (fromPage, toPage, additionalData = {}) => {
    return await trackSimpleEvent({
        'interaction_type': 'page_navigation',
        'element_id': 'page_navigation',
        'page_url': window.location.href,
        'from_page': fromPage,
        'to_page': toPage,
        ...additionalData
    });
};

export default {
    trackSimpleEvent,
    trackMusicStyleSelection,
    trackButtonClick,
    trackPageNavigation
};
