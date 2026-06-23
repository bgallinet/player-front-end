/**
 * @param {unknown[]|null|undefined} a
 * @param {unknown[]|null|undefined} b
 */
export function playbackIntentsSequencesDiffer(a, b) {
    return JSON.stringify(a ?? []) !== JSON.stringify(b ?? []);
}
