import UserAPI from '../utils/UserAPI';
import { createAuthenticatedRequestBody } from '../hooks/sessionUtils';

/**
 * POST one reaction analytics batch via authenticated process-data → analytics handler.
 * @param {object} payload
 * @param {string} payload.session_name
 * @param {number} payload.unixTime - batch start (epoch seconds)
 * @param {number} payload.sample_rate_hz
 * @param {number} payload.sample_count
 * @param {number[]} payload.smiling
 * @param {number[]} payload.jaw_open
 * @param {number[][]} payload.landmark_vectors - five arrays, each flat [x,y,z,...] length sample_count*3
 */
export async function sendReactionAnalyticsBatch(payload) {
    if (typeof window === 'undefined' || !localStorage.getItem('idToken')) {
        return { ok: false, skipped: true };
    }

    const requestBody = createAuthenticatedRequestBody(
        {
            request_type: 'analytics',
            interaction_type: 'reaction_analytics_batch',
            page_url: typeof window !== 'undefined' ? window.location.href : '',
            ...payload,
        },
        true,
    );

    try {
        const response = await UserAPI(JSON.stringify(requestBody));
        const raw = response && response.body;
        let parsed = null;
        if (typeof raw === 'string') {
            try {
                parsed = JSON.parse(raw);
            } catch {
                parsed = null;
            }
        }
        const status = parsed?.statusCode ?? response?.statusCode ?? 200;
        const ok = status >= 200 && status < 300;
        if (!ok) {
            console.warn('[reaction_analytics] batch upload failed', status, parsed);
        }
        return { ok, status, parsed };
    } catch (e) {
        console.warn('[reaction_analytics] batch upload error', e);
        return { ok: false, error: e };
    }
}
