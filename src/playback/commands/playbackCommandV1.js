/**
 * @typedef {{
 *   schemaVersion: string,
 *   kind: string,
 *   payload: Record<string, unknown>,
 * }} PlaybackCommandV1
 */

/**
 * @param {PlaybackCommandV1[]|null|undefined} a
 * @param {PlaybackCommandV1[]|null|undefined} b
 */
export function playbackCommandsSequencesDiffer(a, b) {
    return JSON.stringify(a ?? []) !== JSON.stringify(b ?? []);
}
