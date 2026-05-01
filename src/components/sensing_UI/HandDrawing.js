/** Canvas utilities for MediaPipe hand skeleton drawing (static methods on HandDrawing). */

// MediaPipe Hand landmark edge pairs (same topology as holistic preview overlay)
const HAND_CONNECTIONS = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [5, 9],
    [9, 10],
    [10, 11],
    [11, 12],
    [9, 13],
    [13, 14],
    [14, 15],
    [15, 16],
    [13, 17],
    [17, 18],
    [18, 19],
    [19, 20],
    [0, 17],
];

/**
 * HandDrawing utility class
 * Provides static methods for drawing hand landmarks on canvas
 */
class HandDrawing {
    /**
     * Draw hand skeleton segments in normalized landmark space.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array<{ x: number, y: number }>|null|undefined} landmarks
     * @param {number} scaleX
     * @param {number} scaleY
     * @param {string} strokeCss
     * @param {number} lineWidth
     * @param {number} offsetX
     * @param {number} offsetY
     */
    static drawAllHandLandmarks(
        ctx,
        landmarks,
        scaleX,
        scaleY,
        strokeCss,
        lineWidth = 2,
        offsetX = 0,
        offsetY = 0,
    ) {
        if (!landmarks || landmarks.length < 2) return;

        ctx.strokeStyle = strokeCss;
        ctx.lineWidth = lineWidth;

        for (const [a, b] of HAND_CONNECTIONS) {
            if (!landmarks[a] || !landmarks[b]) continue;
            ctx.beginPath();
            ctx.moveTo(offsetX + landmarks[a].x * scaleX, offsetY + landmarks[a].y * scaleY);
            ctx.lineTo(offsetX + landmarks[b].x * scaleX, offsetY + landmarks[b].y * scaleY);
            ctx.stroke();
        }
    }

    /**
     * Hand edge index pairs for external use
     */
    static getHandConnections() {
        return HAND_CONNECTIONS;
    }
}

export default HandDrawing;
export { HAND_CONNECTIONS };
