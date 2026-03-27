/**
 * Map a screen X coordinate to a 0…1 fraction along `boundsElement`'s width.
 * Useful for horizontal scrub/slider tracks; works for any bounding rect from `getBoundingClientRect`.
 *
 * @param {number} clientX - Pointer/mouse `clientX`
 * @param {HTMLElement} boundsElement - Region whose left edge is 0 and right edge is 1
 * @returns {number | null} Clamped fraction, or null if bounds are unusable
 */
export function getHorizontalSlideFraction(clientX, boundsElement) {
    if (!boundsElement || typeof clientX !== 'number' || Number.isNaN(clientX)) {
        return null;
    }
    const rect = boundsElement.getBoundingClientRect();
    if (!(rect.width > 0)) return null;
    const x = clientX - rect.left;
    return Math.min(1, Math.max(0, x / rect.width));
}
