/**
 * Gate sensing Phase 0 debug (CueTensor snapshots). No UX when disabled.
 *
 * Enable:
 * - `localStorage.setItem('sensing_debug', '1')` then reload, or (legacy)
 * - `localStorage.setItem('multimodal_debug', '1')` then reload, or
 * - build with `REACT_APP_SENSING_DEBUG=true` or `REACT_APP_MULTIMODAL_DEBUG=true`
 */

export function isSensingDebugEnabled() {
    try {
        if (typeof window !== 'undefined') {
            const ls = window.localStorage;
            if (ls?.getItem('sensing_debug') === '1' || ls?.getItem('multimodal_debug') === '1') {
                return true;
            }
        }
    } catch {
        /* ignore */
    }
    return (
        process.env.REACT_APP_SENSING_DEBUG === 'true' ||
        process.env.REACT_APP_MULTIMODAL_DEBUG === 'true'
    );
}

/** @deprecated Prefer {@link isSensingDebugEnabled}. */
export const isMultimodalDebugEnabled = isSensingDebugEnabled;
