/**
 * Select track_ids from the songs catalog per server adaptation policy.
 */

function catalogRowId(row) {
    return String(row?.id ?? row?.track_id ?? row?.trackId ?? '').trim();
}

function catalogRowBpm(row) {
    const n = Number(row?.bpm ?? row?.BPM);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param {object[]} catalogTracks
 * @param {{ strategy?: string, energyThreshold?: number }|null|undefined} catalogTrackSelection
 * @param {number} songCount
 * @param {{ energySurvey?: number|null }} [options]
 * @returns {string[]}
 */
export function selectCatalogTrackIds(
    catalogTracks,
    catalogTrackSelection,
    songCount,
    { energySurvey } = {},
) {
    const count = Math.max(1, Math.floor(Number(songCount)) || 3);
    const rows = (catalogTracks || []).filter((row) => catalogRowId(row));
    if (rows.length < count) {
        throw new Error(
            `Song database has ${rows.length} track(s); this session needs ${count}. Sync songs to the server.`,
        );
    }

    const strategy = String(catalogTrackSelection?.strategy || 'random').trim();

    if (strategy === 'random') {
        const shuffled = [...rows];
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, count).map(catalogRowId);
    }

    if (strategy === 'energy_bpm_rank') {
        const threshold = Number(catalogTrackSelection?.energyThreshold ?? 5);
        const energy = Number(energySurvey);
        const withBpm = rows.filter((row) => catalogRowBpm(row) != null);
        const pool = withBpm.length >= count ? withBpm : rows;
        const sorted = [...pool].sort((a, b) => (catalogRowBpm(a) ?? 0) - (catalogRowBpm(b) ?? 0));
        const pickLowest = Number.isFinite(energy) && energy < threshold;
        const selected = pickLowest ? sorted.slice(0, count) : sorted.slice(-count);
        return selected.map(catalogRowId);
    }

    throw new Error(`Unknown catalog track selection strategy: ${strategy}`);
}
