import { useCallback } from 'react';

/**
 * Applies compile output to the deck: `SoundConsole.applyRecommendation` uses the recommendation object
 * from the reaction compile step (v0 contract).
 *
 * @param {React.RefObject<HTMLAudioElement & { soundConsoleMethods?: { applyRecommendation?: (rec: unknown) => void } }|null>} audioRef
 */
export function useAudioGraphCompiler(audioRef) {
    return useCallback(
        ({ recommendation }) => {
            const methods = audioRef.current?.soundConsoleMethods;
            if (methods?.applyRecommendation) {
                methods.applyRecommendation(recommendation);
            }
        },
        [audioRef],
    );
}
