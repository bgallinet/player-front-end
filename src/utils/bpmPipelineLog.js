const PREFIX = '[BPM]';

/** @param {string} trackLabel */
export function bpmTrackLabel(track) {
    const title = track?.title || track?.name || track?.spTrack?.name || '?';
    const artist = track?.artist || track?.spTrack?.artists?.[0]?.name || '';
    const id = track?.id || track?.spTrack?.id || '';
    return artist ? `${title} — ${artist}${id ? ` (${id})` : ''}` : `${title}${id ? ` (${id})` : ''}`;
}

/**
 * @param {'info'|'warn'|'error'} level
 * @param {string} step
 * @param {string} message
 * @param {Record<string, unknown>} [data]
 */
export function bpmLog(level, step, message, data) {
    const payload = data !== undefined ? { step, ...data } : { step };
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
    fn(`${PREFIX} ${message}`, payload);
}

/** @param {Array<{ step?: string, success?: boolean, message?: string }>} attempts */
export function formatAttemptsSummary(attempts) {
    if (!Array.isArray(attempts) || attempts.length === 0) return '(no server attempts)';
    return attempts
        .map((a) => {
            const ok = a.success ?? a.ok;
            const tag = ok ? 'ok' : 'miss';
            const msg = a.message ? `: ${a.message}` : '';
            return `${a.step || '?'}=${tag}${msg}`;
        })
        .join(' | ');
}

export function bpmLogAttempts(trackLabel, attempts) {
    if (!Array.isArray(attempts) || attempts.length === 0) return;

    const summary = formatAttemptsSummary(attempts);
    console.info(`${PREFIX} ${trackLabel} — server: ${summary}`);

    console.groupCollapsed(`${PREFIX} ${trackLabel} — server attempts (detail)`);
    attempts.forEach((a) => {
        const ok = a.success ?? a.ok;
        const line = `${a.step}: ${ok ? 'OK' : 'miss'}${a.message ? ` — ${a.message}` : ''}`;
        if (ok) console.info(line, a);
        else console.warn(line, a);
    });
    console.groupEnd();
}
