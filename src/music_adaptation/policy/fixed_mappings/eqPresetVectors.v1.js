/**
 * Named EQ curves (6-band dB offsets) and resolution for policy `eqMappings` cells.
 * Values may be stored as vectors or preset keywords — {@link resolveEqVector} feeds the compiler / audio graph.
 */

export const EQ_PRESETS = Object.freeze({
    flat: [0, 0, 0, 0, 0, 0],
    'bass-boost': [8, 6, 3, 0, -2, -3],
    'hands-raised': [11, 9, 4, 0, -2, -3],
    'treble-boost': [-3, -2, 0, 3, 6, 8],
    vocal: [-4, -3, 5, 8, 7, 3],
    warm: [3, 6, 3, 0, 0, 0],
    bright: [0, 0, 0, 0, 6, 9],
    muddy: [-3, -6, -3, 0, 0, 0],
    harsh: [0, 0, 0, -3, -6, -3],
    'mouth-open': [0, 0, -14, -15, -15, -12],
});

/**
 * @param {number[]|string} eqMapping
 * @returns {number[]}
 */
export function resolveEqVector(eqMapping) {
    if (Array.isArray(eqMapping) && eqMapping.length === 6) {
        return eqMapping;
    }
    if (typeof eqMapping === 'string') {
        const v = EQ_PRESETS[eqMapping] || EQ_PRESETS.flat;
        return [...v];
    }
    return [...EQ_PRESETS.flat];
}
