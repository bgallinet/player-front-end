/**
 * Aggregate channel statistics from row-major cue tensors.
 */

/**
 * @param {import('../debug/cueTensorSnapshot').CueTensorLike} tensor
 * @param {readonly string[]} channelNames
 */
export function tensorMeanByChannel(tensor, channelNames) {
    const F = channelNames.length;
    const n = tensor.frameCount;
    /** @type {Record<string, number>} */
    const out = {};
    if (n <= 0) {
        channelNames.forEach((id) => {
            out[id] = 0;
        });
        return out;
    }
    const sums = new Float32Array(F);
    for (let i = 0; i < n; i++) {
        const off = i * F;
        for (let j = 0; j < F; j++) {
            sums[j] += tensor.frames[off + j];
        }
    }
    for (let j = 0; j < F; j++) {
        out[channelNames[j]] = sums[j] / n;
    }
    return out;
}

/**
 * Latest frame as channel → value map.
 *
 * @param {import('../debug/cueTensorSnapshot').CueTensorLike} tensor
 * @param {readonly string[]} channelNames
 */
export function tensorLatestRowRecord(tensor, channelNames) {
    const F = channelNames.length;
    /** @type {Record<string, number>} */
    const out = {};
    if (tensor.frameCount <= 0) {
        channelNames.forEach((id) => {
            out[id] = 0;
        });
        return out;
    }
    const off = (tensor.frameCount - 1) * F;
    for (let j = 0; j < F; j++) {
        out[channelNames[j]] = tensor.frames[off + j];
    }
    return out;
}
