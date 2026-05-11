/**
 * Unwraps POST /process-data responses (API may return { statusCode, body: JSON string }).
 * @param {{ body?: string }|null} apiResult - Return value from UserAPI / APICall
 * @returns {{ statusCode: number, payload: object }|null}
 */
export function parseProcessDataResponse(apiResult) {
    if (!apiResult || typeof apiResult.body !== 'string') {
        return null;
    }
    let outer;
    try {
        outer = JSON.parse(apiResult.body);
    } catch {
        return null;
    }
    const statusCode = typeof outer.statusCode === 'number' ? outer.statusCode : 200;
    let payload = outer;
    if (outer && typeof outer.body === 'string') {
        try {
            payload = JSON.parse(outer.body);
        } catch {
            payload = { raw: outer.body };
        }
    }
    return { statusCode, payload };
}
