import EnvironmentVariables from './EnvironmentVariables';

/**
 * Load adaptation policy bundle for an experiment variant from `/info`.
 *
 * @param {{ experimentId: string, variantId: string, idToken?: string | null }} args
 * @returns {Promise<{
 *   policy_id: string,
 *   kind: string,
 *   version: string,
 *   bundle: Record<string, unknown>,
 * }>}
 */
export async function fetchAdaptationPolicy({ experimentId, variantId, idToken = null }) {
    const headers = { 'Content-Type': 'application/json' };
    if (idToken) {
        headers.Authorization = `Bearer ${idToken}`;
    }
    const response = await fetch(EnvironmentVariables.InfoAPI_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            info_type: 'adaptation_policy',
            experiment_id: experimentId,
            variant_id: variantId,
        }),
    });
    if (!response.ok) {
        throw new Error(`adaptation_policy HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (payload?.error) {
        throw new Error(String(payload.error));
    }
    if (!payload?.bundle || typeof payload.bundle !== 'object') {
        throw new Error('adaptation_policy response missing bundle');
    }
    return payload;
}
