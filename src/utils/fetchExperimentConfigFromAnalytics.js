import AnalyticsAPI from './AnalyticsAPI.jsx';

/**
 * Loads experiment row + metadata via analytics API (`interaction_type: 'experiment_config'`).
 * Expects `metadata.test_sequence` with `tracks[]` (`track_id`, `start_time`, `duration_seconds`).
 *
 * @param {string} experimentId — DB `experiments.id` (e.g. from controlled_experiments.csv)
 * @returns {Promise<{ trackIds: string[], durationSecondsByTrack: number[], raw: object }>}
 */
export async function fetchExperimentConfigFromAnalytics(experimentId) {
    const bodyStr = JSON.stringify({
        request_type: 'analytics',
        interaction_type: 'experiment_config',
        experiment_id: experimentId,
    });
    const apiResult = await AnalyticsAPI(bodyStr, false);
    let envelope;
    try {
        envelope = JSON.parse(apiResult.body);
    } catch {
        throw new Error('Invalid analytics response envelope');
    }
    const statusCode = envelope.statusCode ?? 500;
    const innerRaw = envelope.body;
    const inner = typeof innerRaw === 'string' ? JSON.parse(innerRaw) : innerRaw;
    if (statusCode !== 200) {
        throw new Error(inner?.error || `Experiment config request failed (${statusCode})`);
    }
    const seq = inner?.metadata?.test_sequence;
    if (!seq || !Array.isArray(seq.tracks) || seq.tracks.length === 0) {
        throw new Error('Experiment metadata missing test_sequence.tracks');
    }
    const segments = seq.tracks
        .map((t) => {
            const trackId = String(t.track_id || '').trim();
            const n = Number(t.duration_seconds);
            const durationSeconds = Number.isFinite(n) && n > 0 ? n : 60;
            return { trackId, durationSeconds };
        })
        .filter((s) => s.trackId);
    if (segments.length === 0) {
        throw new Error('Experiment sequence has no track_id entries');
    }
    return {
        trackIds: segments.map((s) => s.trackId),
        durationSecondsByTrack: segments.map((s) => s.durationSeconds),
        raw: inner,
    };
}
