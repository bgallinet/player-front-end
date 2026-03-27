import { useCallback, useEffect, useRef } from 'react';
import { getHorizontalSlideFraction } from '../utils/pointerSlide';

/**
 * Horizontal pointer slide/scrub on a bounds element: tap sets value; drag updates while pressed.
 * Attaches move/up/cancel to `window` so dragging stays correct when the pointer leaves the
 * bounds (same idea as classic seek bars; avoids preventDefault issues with click).
 *
 * Put this on the element that should receive pointers. Decorative children on top of the
 * bounds (e.g. a filled progress indicator) should use `pointer-events: none` so hits reach
 * the bounds element.
 *
 * @param {Object} options
 * @param {(fraction: number) => void} options.onFractionChange - 0…1 along width
 * @param {boolean} [options.enabled=true]
 * @returns {{ boundsRef: React.RefObject<HTMLElement | null>, onPointerDown: (e: React.PointerEvent) => void }}
 */
export function usePointerSlide1D({ onFractionChange, enabled = true }) {
    const boundsRef = useRef(null);
    const onFractionChangeRef = useRef(onFractionChange);
    onFractionChangeRef.current = onFractionChange;

    /** @type {React.MutableRefObject<(() => void) | null>} */
    const detachWindowListenersRef = useRef(null);

    useEffect(() => {
        return () => {
            const detach = detachWindowListenersRef.current;
            if (detach) detach();
        };
    }, []);

    const onPointerDown = useCallback(
        (e) => {
            if (!enabled) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;

            const el = boundsRef.current;
            if (!el) return;

            if (detachWindowListenersRef.current) {
                detachWindowListenersRef.current();
            }

            const notify = (clientX) => {
                const fraction = getHorizontalSlideFraction(clientX, el);
                if (fraction != null) {
                    onFractionChangeRef.current(fraction);
                }
            };

            notify(e.clientX);

            const onMove = (ev) => notify(ev.clientX);
            const onUpOrCancel = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUpOrCancel);
                window.removeEventListener('pointercancel', onUpOrCancel);
                detachWindowListenersRef.current = null;
            };

            detachWindowListenersRef.current = onUpOrCancel;
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUpOrCancel);
            window.addEventListener('pointercancel', onUpOrCancel);
        },
        [enabled]
    );

    return { boundsRef, onPointerDown };
}
