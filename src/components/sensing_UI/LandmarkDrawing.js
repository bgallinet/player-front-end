import {
    secondaryColor,
    thresholdForVisualizationOfNodding,
    thresholdForVisualizationOfSmiling,
    thresholdForVisualizationOfJawOpen,
} from '../../utils/DisplaySettings';
import {
    FACE_ANALYTICS_INDICES,
    FACE_LANDMARKS_FACE_OVAL,
    FACE_MOUTH_ANALYTICS_SET,
    FACE_OVAL_ANALYTICS_SET,
    LEFT_EYE,
    LEFT_EYEBROW,
    MOUTH_INNER,
    MOUTH_OUTER,
    NOSE_BRIDGE,
    NOSE_EXTRA_POINTS,
    NOSE_TIP,
    RIGHT_EYE,
    RIGHT_EYEBROW,
} from '../../reaction_analytics/reactionAnalyticsLandmarkConfig';

/**
 * Lightweight face overlay: every segment uses **both** endpoints in `FACE_ANALYTICS_INDICES`
 * (same set as reaction `FACE_*` upload). The head outline is the full archived oval chain;
 * eyes, nose, brows, and mouth use every vertex on their polylines (same as reaction `FACE_*`).
 * Full mesh lives in `LandmarkDrawing.full.archive.jsx` (not bundled).
 */

/** @type {ReadonlySet<number>} */
const _analyticsSet = new Set(FACE_ANALYTICS_INDICES);

/**
 * Edge list: face oval + inner chains (all edges analytics-backed).
 * @returns {ReadonlyArray<readonly [number, number]>}
 */
function buildFaceAnalyticsEdges() {
    /** @type {Array<[number, number]>} */
    const out = [];
    const seen = new Set();

    const edgeKey = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);

    const addEdge = (a, b) => {
        if (a === b) return;
        if (!_analyticsSet.has(a) || !_analyticsSet.has(b)) return;
        const key = edgeKey(a, b);
        if (seen.has(key)) return;
        seen.add(key);
        out.push([a, b]);
    };

    const chain = (indices, closed) => {
        if (!indices?.length) return;
        for (let i = 0; i < indices.length - 1; i += 1) {
            addEdge(indices[i], indices[i + 1]);
        }
        if (closed && indices.length > 1) {
            addEdge(indices[indices.length - 1], indices[0]);
        }
    };

    chain(FACE_LANDMARKS_FACE_OVAL, true);
    chain(LEFT_EYE, true);
    chain(RIGHT_EYE, true);
    chain(LEFT_EYEBROW, false);
    chain(RIGHT_EYEBROW, false);
    chain(NOSE_BRIDGE, false);
    chain(NOSE_TIP, false);
    chain(NOSE_EXTRA_POINTS, false);
    chain(MOUTH_OUTER, true);
    chain(MOUTH_INNER, true);

    return Object.freeze(out);
}

const FACE_ANALYTICS_EDGES = buildFaceAnalyticsEdges();

/**
 * @param {{ amplitude?: number, smiling?: number, jaw_open?: number }|null|undefined} frameData
 * @returns {'noddingSmiling'|'noddingJawOpen'|'nodding'|'jawOpen'|'smiling'|null}
 */
function determineStatusFromFrameData(frameData) {
    if (!frameData) return null;
    const isNodding = (frameData.amplitude || 0) > thresholdForVisualizationOfNodding;
    const isSmiling = (frameData.smiling || 0) > thresholdForVisualizationOfSmiling;
    const isJawOpen = (frameData.jaw_open || 0) > thresholdForVisualizationOfJawOpen;
    if (isNodding && isSmiling) return 'noddingSmiling';
    if (isNodding && isJawOpen) return 'noddingJawOpen';
    if (isNodding) return 'nodding';
    if (isJawOpen) return 'jawOpen';
    if (isSmiling) return 'smiling';
    return null;
}

/**
 * @param {number} a
 * @param {number} b
 * @param {'noddingSmiling'|'noddingJawOpen'|'nodding'|'jawOpen'|'smiling'|null} status
 */
function strokeColorForSegment(a, b, status) {
    const touchesMouth = FACE_MOUTH_ANALYTICS_SET.has(a) || FACE_MOUTH_ANALYTICS_SET.has(b);
    const touchesOval = FACE_OVAL_ANALYTICS_SET.has(a) || FACE_OVAL_ANALYTICS_SET.has(b);
    if (!status) return secondaryColor;
    if (status === 'smiling' && touchesMouth) return '#00FF00';
    if (status === 'jawOpen' && touchesMouth) return '#FFFF00';
    if (status === 'nodding' && touchesOval) return '#FF0000';
    if (status === 'noddingSmiling') {
        if (touchesOval) return '#FF0000';
        if (touchesMouth) return '#00FF00';
        return secondaryColor;
    }
    if (status === 'noddingJawOpen') {
        if (touchesOval) return '#FF0000';
        if (touchesMouth) return '#FFFF00';
        return secondaryColor;
    }
    return secondaryColor;
}

function screenPoint(landmarks, index, width, height) {
    if (index >= landmarks.length) return null;
    const p = landmarks[index];
    if (!p || p.x == null || p.y == null) return null;
    return { x: p.x * width, y: p.y * height };
}

class LandmarkDrawing {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array<{x:number,y:number}>|null|undefined} landmarks
     * @param {number[]} landmarkIndices
     * @param {string} color
     * @param {number} radius
     * @param {number} scaleX
     * @param {number} scaleY
     * @param {number} offsetX
     * @param {number} offsetY
     */
    static drawLandmarkPoints(ctx, landmarks, landmarkIndices, color, radius = 2, scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0) {
        if (!landmarks || !landmarkIndices?.length) return;
        ctx.fillStyle = color;
        landmarkIndices.forEach((index) => {
            if (index >= landmarks.length) return;
            const landmark = landmarks[index];
            if (!landmark) return;
            const x = offsetX + landmark.x * scaleX;
            const y = offsetY + landmark.y * scaleY;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fill();
        });
    }
}

/**
 * Draw face geometry as line segments (oval + inner chains; keys match reaction analytics).
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array|undefined|null} landmarks
 * @param {{ amplitude?: number, smiling?: number, jaw_open?: number }} frameData
 * @param {number} width
 * @param {number} height
 * @param {number} [lineWidthMultiplier]
 */
export function drawLandmarksOnCanvas(ctx, landmarks, frameData, width, height, lineWidthMultiplier = 1) {
    if (!ctx || !landmarks || landmarks.length === 0) return;

    let normalizedLandmarks = landmarks;
    if (Array.isArray(landmarks) && typeof landmarks[0] === 'number') {
        const arr = landmarks;
        const out = new Array(Math.floor(arr.length / 2));
        for (let i = 0, j = 0; i < arr.length - 1; i += 2, j += 1) {
            out[j] = { x: arr[i], y: arr[i + 1] };
        }
        normalizedLandmarks = out;
    }

    const status = determineStatusFromFrameData(frameData);
    const lineWidth = Math.max(1, 2.5 * lineWidthMultiplier);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const [a, b] of FACE_ANALYTICS_EDGES) {
        const pa = screenPoint(normalizedLandmarks, a, width, height);
        const pb = screenPoint(normalizedLandmarks, b, width, height);
        if (!pa || !pb) continue;
        ctx.strokeStyle = strokeColorForSegment(a, b, status);
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
    }
}

export default LandmarkDrawing;
