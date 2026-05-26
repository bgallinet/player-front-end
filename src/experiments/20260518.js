/**
 * Experiment 20260518 — user Spotify playlist only (no catalog title matching).
 * Metadata: `Number of songs` (how many tracks to play per sequence).
 * Mode A: playlist order; Mode B: BPM vs energy survey; Mode C: random from playlist.
 */

export const EXPERIMENT_ID = '20260518';

const DEFAULT_SEGMENT_SECONDS = 60;
const DEFAULT_SONG_COUNT = 3;

/**
 * @param {object|null|undefined} metadata
 */
export function parseSongCount(metadata) {
    if (!metadata || typeof metadata !== 'object') {
        return DEFAULT_SONG_COUNT;
    }
    const keys = ['Number of songs', 'number_of_songs', 'song_count', 'songCount'];
    for (const key of keys) {
        const n = Number(metadata[key]);
        if (Number.isFinite(n) && n > 0) {
            return Math.floor(n);
        }
    }
    return DEFAULT_SONG_COUNT;
}

/**
 * @param {object|null|undefined} metadata
 */
export function parseExperimentMetadata(metadata) {
    const songCount = parseSongCount(metadata);
    return {
        trackIds: [],
        durationSecondsByTrack: Array.from({ length: songCount }, () => DEFAULT_SEGMENT_SECONDS),
        songCount,
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
