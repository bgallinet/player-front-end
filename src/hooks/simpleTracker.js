import AnalyticsAPI from '../utils/AnalyticsAPI';
import UserAPI from '../utils/UserAPI';
import { createAuthenticatedRequestBody } from './sessionUtils';
import EnvironmentVariables from '../utils/EnvironmentVariables';
import { enrichAnalyticsRequestBody } from '../utils/clientEnvironment';

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
            ...eventData // Include any additional data
        };

        const isAuthenticated = Boolean(localStorage.getItem('idToken'));
        
        if (isAuthenticated) {
            const authenticatedBody = createAuthenticatedRequestBody(requestBody, true);
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
 * Best-effort event tracking for unload scenarios.
 * Uses fetch keepalive so requests can outlive page teardown.
 */
export const trackSimpleEventOnUnload = (eventData) => {
    try {
        const requestBody = {
            request_type: 'analytics',
            interaction_type: eventData.interaction_type,
            session_name: eventData.session_name || 'default',
            element_id: eventData.element_id,
            page_url: eventData.page_url || window.location.href,
            duration_ms: eventData.detection_duration || eventData.duration_ms,
            ...eventData
        };

        const isAuthenticated = Boolean(localStorage.getItem('idToken'));
        const url = isAuthenticated
            ? EnvironmentVariables.UserAPI_URL
            : EnvironmentVariables.AnalyticsAPI_URL;

        let body = isAuthenticated
            ? JSON.stringify(createAuthenticatedRequestBody(requestBody, true))
            : JSON.stringify(requestBody);
        body = enrichAnalyticsRequestBody(body);

        const headers = {
            'Content-Type': 'application/json'
        };

        if (isAuthenticated) {
            const idToken = localStorage.getItem('idToken');
            if (idToken) {
                headers.Authorization = `Bearer ${idToken}`;
            }
        } else {
            const anonymousSessionId = sessionStorage.getItem('anonymous_session_id');
            if (anonymousSessionId) {
                headers['X-Anonymous-Session'] = anonymousSessionId;
            }
        }

        void fetch(url, {
            method: 'POST',
            headers,
            body,
            keepalive: true
        });

        return true;
    } catch (error) {
        console.error('❌ Unload tracking error:', error);
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
    trackSimpleEventOnUnload,
    trackMusicStyleSelection,
    trackButtonClick,
    trackPageNavigation
};
