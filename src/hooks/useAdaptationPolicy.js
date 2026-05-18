import { useEffect, useState } from 'react';
import { fetchAdaptationPolicy } from '../utils/fetchAdaptationPolicy';
import { buildReactionPolicyInstanceFromApi } from '../utils/buildReactionPolicyInstanceFromApi';
import { createBuiltinStaticReactionPolicyInstance } from '../music_adaptation/policy/reactionPolicyInstances.v1';

/**
 * Load server adaptation policy for experiment + variant.
 *
 * @param {{ experimentId: string, variantId: string, idToken?: string|null, enabled?: boolean }} args
 */
export function useAdaptationPolicy({
    experimentId,
    variantId,
    idToken = null,
    enabled = true,
}) {
    const [policyInstance, setPolicyInstance] = useState(null);
    const [loading, setLoading] = useState(Boolean(enabled));
    const [error, setError] = useState('');

    useEffect(() => {
        if (!enabled || !experimentId || !variantId) {
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        setLoading(true);
        setError('');

        void fetchAdaptationPolicy({ experimentId, variantId, idToken })
            .then((payload) => {
                if (cancelled) return;
                setPolicyInstance(buildReactionPolicyInstanceFromApi(payload));
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('[useAdaptationPolicy]', err);
                setError(err?.message || 'Failed to load adaptation policy');
                setPolicyInstance(createBuiltinStaticReactionPolicyInstance());
                setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [experimentId, variantId, idToken, enabled]);

    return { policyInstance, loading, error };
}
