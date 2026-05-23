/**
 * Experiment 20260504 — fixed catalog sequence (CloudFront test tracks).
 * Metadata: `test_sequence.tracks[]` with `track_id`, `duration_seconds`.
 */

export const EXPERIMENT_ID = '20260504';

const DEFAULT_SEGMENT_SECONDS = 60;

/**
 * @param {object|null|undefined} metadata
 */
export function parseExperimentMetadata(metadata) {
    const seq = metadata?.test_sequence;
    if (!seq || !Array.isArray(seq.tracks) || seq.tracks.length === 0) {
        throw new Error('Experiment 20260504 metadata missing test_sequence.tracks');
    }

    const segments = seq.tracks
        .map((t) => {
            const trackId = String(t.track_id || '').trim();
            const n = Number(t.duration_seconds);
            const durationSeconds =
                Number.isFinite(n) && n > 0 ? n : DEFAULT_SEGMENT_SECONDS;
            return { trackId, durationSeconds };
        })
        .filter((s) => s.trackId);

    if (segments.length === 0) {
        throw new Error('Experiment 20260504 sequence has no track_id entries');
    }

    return {
        trackIds: segments.map((s) => s.trackId),
        durationSecondsByTrack: segments.map((s) => s.durationSeconds),
        songCount: segments.length,
    };
}

/**
 * @param {object} raw — analytics experiment_config inner payload
 */
export function buildSessionConfig(raw) {
    const parsed = parseExperimentMetadata(raw?.metadata);
    return {
        experimentId: EXPERIMENT_ID,
        raw,
        ...parsed,
    };
}
