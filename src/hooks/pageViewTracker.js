/**
 * Page View Tracking Utility
 * 
 * Automatically tracks page views and sends them to the analytics backend.
 * Tracks:
 * - Page URL
 * - Referrer
 * - Viewport dimensions
 * - User identification (authenticated or demo)
 * - Session information
 */

import React from 'react';
import { getDemoUsername, isDemoSession } from './demoUserManager';
import AnalyticsAPI from '../utils/AnalyticsAPI';
import UserAPI from '../utils/UserAPI';

/**
 * Track a page view
 * @param {Object} options - Page view options
 * @param {string} options.pageName - Name of the page (e.g., 'player', 'session', 'profile')
 * @param {string} options.pageUrl - Full URL of the page
 * @param {string} options.referrer - Referrer URL (optional)
 * @param {Object} options.additionalData - Additional data to track (optional)
 */
export const trackPageView = async (options = {}) => {
    try {
        const {
            pageName,
            pageUrl = window.location.href,
            referrer = document.referrer || null,
            additionalData = {}
        } = options;

        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Determine if this is a demo session
        const isDemo = isDemoSession();

        // Prepare the page view data
        const pageViewData = {
            request_type: 'analytics',
            interaction_type: 'page_view',
            page_name: pageName,
            page_url: pageUrl,
            referrer: referrer,
            viewport_width: viewportWidth,
            viewport_height: viewportHeight,
            ...additionalData
        };

        // Add user identification
        if (isDemo) {
            pageViewData.user_name = getDemoUsername();
            pageViewData.session_name = 'demo-session';
        }

        console.log('Tracking page view:', pageViewData);

        // Send to appropriate API based on authentication status
        if (isDemo) {
            await AnalyticsAPI(JSON.stringify(pageViewData));
        } else {
            await UserAPI(JSON.stringify(pageViewData));
        }

        // Store page entry time for time_on_page calculation
        sessionStorage.setItem('page_entry_time', Date.now().toString());

    } catch (error) {
        console.error('Error tracking page view:', error);
    }
};

/**
 * Track page exit (for time_on_page calculation)
 * This should be called when the user navigates away from the page
 */
export const trackPageExit = () => {
    try {
        const entryTime = sessionStorage.getItem('page_entry_time');
        if (entryTime) {
            const timeOnPage = Date.now() - parseInt(entryTime);
            sessionStorage.setItem('last_page_time', timeOnPage.toString());
        }
    } catch (error) {
        console.error('Error tracking page exit:', error);
    }
};

/**
 * Track scroll depth
 * @param {number} scrollDepth - Scroll depth percentage (0-100)
 */
export const trackScrollDepth = async (scrollDepth) => {
    try {
        const isDemo = isDemoSession();
        
        const scrollData = {
            request_type: 'analytics',
            interaction_type: 'scroll_tracking',
            page_url: window.location.href,
            scroll_depth: scrollDepth,
            timestamp: Date.now()
        };

        if (isDemo) {
            scrollData.user_name = getDemoUsername();
            scrollData.session_name = 'demo-session';
        }

        // Send scroll tracking data
        if (isDemo) {
            await AnalyticsAPI(JSON.stringify(scrollData));
        } else {
            await UserAPI(JSON.stringify(scrollData));
        }
    } catch (error) {
        console.error('Error tracking scroll depth:', error);
    }
};

/**
 * Setup automatic scroll tracking for a page
 * @param {string} pageName - Name of the page
 */
export const setupScrollTracking = (pageName) => {
    let maxScrollDepth = 0;
    let scrollTrackingSent = false;

    const handleScroll = () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollDepth = documentHeight > 0 ? (scrollTop / documentHeight) * 100 : 0;

        // Update max scroll depth
        maxScrollDepth = Math.max(maxScrollDepth, scrollDepth);

        // Send scroll tracking at 25%, 50%, 75%, and 100%
        if (!scrollTrackingSent && maxScrollDepth >= 25) {
            trackScrollDepth(maxScrollDepth);
            scrollTrackingSent = true;
        } else if (maxScrollDepth >= 50 && maxScrollDepth < 51) {
            trackScrollDepth(maxScrollDepth);
        } else if (maxScrollDepth >= 75 && maxScrollDepth < 76) {
            trackScrollDepth(maxScrollDepth);
        } else if (maxScrollDepth >= 95 && maxScrollDepth < 96) {
            trackScrollDepth(maxScrollDepth);
        }
    };

    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup function
    return () => {
        window.removeEventListener('scroll', handleScroll);
    };
};

/**
 * Setup automatic page view tracking for React components
 * @param {string} pageName - Name of the page
 * @param {Object} additionalData - Additional data to track
 */
export const usePageTracking = (pageName, additionalData = {}) => {
    React.useEffect(() => {
        // Track page view on mount
        trackPageView({
            pageName,
            additionalData
        });

        // Setup scroll tracking
        const cleanupScrollTracking = setupScrollTracking(pageName);

        // Track page exit on unmount
        const handleBeforeUnload = () => {
            trackPageExit();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        // Cleanup
        return () => {
            cleanupScrollTracking();
            window.removeEventListener('beforeunload', handleBeforeUnload);
            trackPageExit();
        };
    }, [pageName]);
};

export default {
    trackPageView,
    trackPageExit,
    trackScrollDepth,
    setupScrollTracking,
    usePageTracking
};
