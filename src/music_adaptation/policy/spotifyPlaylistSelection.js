/**
 * Build the session playlist from the user's Spotify tracks (experiment 20260518).
 * Not the catalog / title-match flow used by 20260504.
 */

function isPlayableSpotifyTrack(track) {
    return Boolean(track?.uri || track?.spTrack?.uri);
}

function trackBpm(track) {
    const n = Number(track?.bpm ?? track?.track_bpm);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Map adaptation mode label to playlist selection (see variants.csv for 20260518).
 *
 * @param {string} modeName — e.g. Mode A, Mode B, Mode C
 * @param {{ energyThreshold?: number }|null|undefined} [policyHints]
 */
export function getSpotifyPlaylistSelectionForMode(modeName, policyHints = null) {
    const mode = String(modeName || '').trim();
    if (mode === 'Mode B') {
        return {
            strategy: 'energy_bpm_rank',
            energyThreshold: Number(policyHints?.energyThreshold ?? 5),
        };
    }
    if (mode === 'Mode C') {
        return { strategy: 'random' };
    }
    // Mode A (default): keep Spotify playlist order
    return { strategy: 'playlist_order' };
}

/**
 * @param {object[]} spotifyTracks
 * @param {{ strategy?: string, energyThreshold?: number }} selection
 * @param {number} songCount
 * @param {{ energySurvey?: number|null }} [options]
 * @returns {object[]}
 */
export function selectSpotifyPlaylistTracks(
    spotifyTracks,
    selection,
    songCount,
    { energySurvey } = {},
) {
    const count = Math.max(1, Math.floor(Number(songCount)) || 3);
    const rows = (spotifyTracks || []).filter(isPlayableSpotifyTrack);
    if (rows.length === 0) {
        return [];
    }

    const strategy = String(selection?.strategy || 'playlist_order').trim();

    if (strategy === 'playlist_order') {
        return rows.slice(0, count);
    }

    if (strategy === 'random') {
        const shuffled = [...rows];
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, count);
    }

    if (strategy === 'energy_bpm_rank') {
        const threshold = Number(selection?.energyThreshold ?? 5);
        const energy = Number(energySurvey);
        const withBpm = rows.filter((row) => trackBpm(row) != null);
        const withoutBpm = rows.filter((row) => trackBpm(row) == null);
        const pool = withBpm.length >= count ? withBpm : [...withBpm, ...withoutBpm];
        const sorted = [...pool].sort((a, b) => (trackBpm(a) ?? 0) - (trackBpm(b) ?? 0));
        const pickLowest = Number.isFinite(energy) && energy < threshold;
        return pickLowest ? sorted.slice(0, count) : sorted.slice(-count);
    }

    throw new Error(`Unknown Spotify playlist selection strategy: ${strategy}`);
}
