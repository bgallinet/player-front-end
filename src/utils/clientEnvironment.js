/**
 * Client OS / browser snapshot for analytics.
 * Parsed once per tab session and cached in sessionStorage (not on every page view).
 */

import EnvironmentVariables from '../EnvironmentVariables';
import { createAuthenticatedRequestBody, getSessionNameFromUrl } from '../hooks/sessionUtils';

const STORAGE_KEY = 'analytics_client_environment_v1';

function truncate(str, maxLen) {
    if (str == null || typeof str !== 'string') return '';
    return str.length <= maxLen ? str : str.slice(0, maxLen);
}

function inferFromUserAgent(ua) {
    const s = ua || '';
    let os = 'unknown';
    if (/Windows NT 10\.0/i.test(s)) os = 'Windows 10/11';
    else if (/Windows NT 6\.3/i.test(s)) os = 'Windows 8.1';
    else if (/Windows NT 6\.2/i.test(s)) os = 'Windows 8';
    else if (/Windows NT 6\.1/i.test(s)) os = 'Windows 7';
    else if (/Windows/i.test(s)) os = 'Windows';
    else if (/Mac OS X ([\d_]+)/i.test(s)) {
        const m = s.match(/Mac OS X ([\d_]+)/i);
        os = m ? `macOS ${m[1].replace(/_/g, '.')}` : 'macOS';
    } else if (/Android/i.test(s)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(s)) os = 'iOS';
    else if (/Linux/i.test(s)) os = 'Linux';

    let browser = 'unknown';
    let browser_version = '';
    if (/Edg\/([\d.]+)/i.test(s)) {
        browser = 'Edge';
        const m = s.match(/Edg\/([\d.]+)/i);
        browser_version = m ? m[1] : '';
    } else if (/OPR\/([\d.]+)|Opera\/[\d.]+/i.test(s)) {
        browser = 'Opera';
        const m = s.match(/OPR\/([\d.]+)/i);
        browser_version = m ? m[1] : '';
    } else if (/Chrome\/([\d.]+)/i.test(s) && !/Edg/i.test(s)) {
        browser = 'Chrome';
        const m = s.match(/Chrome\/([\d.]+)/i);
        browser_version = m ? m[1] : '';
    } else if (/Safari\/[\d.]+/i.test(s) && /Version\/([\d.]+)/i.test(s)) {
        browser = 'Safari';
        const m = s.match(/Version\/([\d.]+)/i);
        browser_version = m ? m[1] : '';
    } else if (/Firefox\/([\d.]+)/i.test(s)) {
        browser = 'Firefox';
        const m = s.match(/Firefox\/([\d.]+)/i);
        browser_version = m ? m[1] : '';
    }

    return {
        os,
        browser,
        browser_version,
        user_agent: truncate(s, 400),
    };
}

/**
 * Returns a stable { os, browser, browser_version, user_agent } for this tab session.
 */
export function getClientEnvironment() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return null;
    }
    try {
        const cached = sessionStorage.getItem(STORAGE_KEY);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch {
        // fall through to recompute
    }

    const env = inferFromUserAgent(navigator.userAgent || '');
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(env));
    } catch {
        // ignore quota / privacy mode
    }
    return env;
}

/**
 * If the payload is an analytics event, attach client_environment when absent.
 * @param {string} requestBodyString - JSON body as sent to the API
 * @returns {string}
 */
export function enrichAnalyticsRequestBody(requestBodyString) {
    if (typeof requestBodyString !== 'string' || requestBodyString.length === 0) {
        return requestBodyString;
    }
    try {
        const data = JSON.parse(requestBodyString);
        if (!data || data.request_type !== 'analytics') {
            return requestBodyString;
        }
        if (data.client_environment != null) {
            return requestBodyString;
        }
        const clientEnv = getClientEnvironment();
        if (clientEnv) {
            data.client_environment = clientEnv;
        }
        return JSON.stringify(data);
    } catch {
        return requestBodyString;
    }
}

let lastErrorFingerprint = '';
let lastErrorTime = 0;
const ERROR_DEDUP_MS = 3000;

function shouldSkipDuplicateError(fingerprint) {
    const now = Date.now();
    if (fingerprint === lastErrorFingerprint && now - lastErrorTime < ERROR_DEDUP_MS) {
        return true;
    }
    lastErrorFingerprint = fingerprint;
    lastErrorTime = now;
    return false;
}

function buildClientErrorPayload({ error_type, error_message, stack_trace, page_url }) {
    const client_environment = getClientEnvironment();
    const ua = typeof navigator !== 'undefined' ? truncate(navigator.userAgent || '', 500) : '';
    return {
        request_type: 'analytics',
        interaction_type: 'client_error',
        session_name: getSessionNameFromUrl() || 'default_session',
        error_type: error_type || 'client_error',
        error_message: truncate(error_message || '', 2000),
        stack_trace: stack_trace ? truncate(stack_trace, 8000) : null,
        page_url: page_url || (typeof window !== 'undefined' ? window.location.href : null),
        user_agent: ua || null,
        client_environment: client_environment || undefined,
    };
}

/**
 * Registers global error / unhandledrejection handlers (once per app load).
 * Sends to the same analytics pipeline as other events; uses keepalive fetch.
 */
export function installClientErrorReporting() {
    if (typeof window === 'undefined') return;

    const send = (partial) => {
        const payload = buildClientErrorPayload(partial);
        const fingerprint = `${payload.error_type}|${payload.error_message}`;
        if (shouldSkipDuplicateError(fingerprint)) {
            return;
        }

        const isAuthenticated = Boolean(localStorage.getItem('idToken'));
        const url = isAuthenticated
            ? EnvironmentVariables.UserAPI_URL
            : EnvironmentVariables.AnalyticsAPI_URL;

        let bodyString;
        if (isAuthenticated) {
            bodyString = JSON.stringify(createAuthenticatedRequestBody(payload, true));
        } else {
            bodyString = JSON.stringify(payload);
        }
        bodyString = enrichAnalyticsRequestBody(bodyString);

        const headers = {
            'Content-Type': 'application/json',
        };
        if (isAuthenticated) {
            const idToken = localStorage.getItem('idToken');
            if (idToken) {
                headers.Authorization = `Bearer ${idToken}`;
            }
        } else {
            try {
                const anonymousSessionId = sessionStorage.getItem('anonymous_session_id');
                if (anonymousSessionId) {
                    headers['X-Anonymous-Session'] = anonymousSessionId;
                }
            } catch {
                // ignore
            }
        }

        void fetch(url, {
            method: 'POST',
            headers,
            body: bodyString,
            keepalive: true,
        }).catch(() => {});
    };

    window.addEventListener('error', (ev) => {
        send({
            error_type: 'javascript_error',
            error_message: ev.message || 'Script error',
            stack_trace: ev.error && ev.error.stack ? ev.error.stack : `${ev.filename}:${ev.lineno}:${ev.colno}`,
            page_url: window.location.href,
        });
    });

    window.addEventListener('unhandledrejection', (ev) => {
        const reason = ev.reason;
        const message = reason instanceof Error ? reason.message : String(reason);
        const stack = reason instanceof Error && reason.stack ? reason.stack : null;
        send({
            error_type: 'unhandled_rejection',
            error_message: message,
            stack_trace: stack,
            page_url: window.location.href,
        });
    });
}
