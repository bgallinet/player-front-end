import { useRef } from 'react';
import { CueRingBuffer } from '../music_adaptation/timeline/CueRingBuffer';

/**
 * Phase 3 — single {@link CueRingBuffer} instance for multimodal cue resampling.
 *
 * @param {{ retentionMs: number }} opts
 * @returns {{ bufferRef: React.MutableRefObject<InstanceType<typeof CueRingBuffer>|null> }}
 */
export function useCueTimeline({ retentionMs }) {
    const bufferRef = useRef(null);
    if (!bufferRef.current) {
        bufferRef.current = new CueRingBuffer({ retentionMs });
    }
    return { bufferRef };
}
