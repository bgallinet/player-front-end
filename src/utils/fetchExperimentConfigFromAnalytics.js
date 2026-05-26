import AnalyticsAPI from './AnalyticsAPI';
import { getExperimentModule } from '../experiments/registry';

/**
 * Fetch raw experiment row from analytics (`interaction_type: experiment_config`).
 *
 * @param {string} experimentId
 * @returns {Promise<object>} inner payload (id, name, description, metadata, …)
 */
export async function fetchExperimentRowFromAnalytics(experimentId) {
    const id = String(experimentId || '').trim();
    if (!id) {
        throw new Error('experiment_id is required');
    }

    const bodyStr = JSON.stringify({
        request_type: 'analytics',
        interaction_type: 'experiment_config',
        experiment_id: id,
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

    return inner;
}

/**
 * Load experiment session config: shared fetch + experiment-specific metadata parsing.
 *
 * @param {string} experimentId — DB `experiments.id`
 * @returns {Promise<object>} session config from `experiments/<id>.js` `buildSessionConfig`
 */
export async function fetchExperimentConfigFromAnalytics(experimentId) {
    const raw = await fetchExperimentRowFromAnalytics(experimentId);
    const mod = getExperimentModule(experimentId);
    return mod.buildSessionConfig(raw);
}

// Re-export shared playlist/catalog helpers (used by multiple experiment pages).
export {
    buildSequencePlaylist,
    matchSpotifyTracksToSequence,
    resolveCatalogTrackId,
} from '../experiments/playlistCatalogMatch';
