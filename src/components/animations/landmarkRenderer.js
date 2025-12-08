import LandmarkDrawing from './LandmarkDrawing';
import { thresholdForVisualizationOfNodding, thresholdForVisualizationOfSmiling, thresholdForVisualizationOfJawOpen } from '../../utils/DisplaySettings';

/**
 * Determine status from reaction data (smiling, nodding, jawOpen)
 * Returns status string for color coding
 */
export const determineStatus = (frameData) => {
    if (!frameData) return null;
    
    const isNodding = (frameData.amplitude || 0) > thresholdForVisualizationOfNodding;
    const isSmiling = (frameData.smiling || 0) > thresholdForVisualizationOfSmiling;
    const isJawOpen = (frameData.jaw_open || 0) > thresholdForVisualizationOfJawOpen;
    
    // Check combinations first, then individual states
    if (isNodding && isSmiling) return 'noddingSmiling';  // Magenta
    if (isNodding && isJawOpen) return 'noddingJawOpen';  // Orange
    if (isNodding) return 'nodding';                       // Red
    if (isJawOpen) return 'jawOpen';                       // Yellow
    if (isSmiling) return 'smiling';                       // Blue
    return null;
};

/**
 * Draw landmarks on canvas
 * Shared function used by both FacialLandmarkUserUI and Cell components
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} landmarks - Array of landmark objects
 * @param {Object} frameData - Frame data containing reactions (amplitude, smiling, jaw_open)
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} lineWidthMultiplier - Line width multiplier (default 1)
 */
export const drawLandmarksOnCanvas = (ctx, landmarks, frameData, width, height, lineWidthMultiplier = 1) => {
    if (!ctx || !landmarks || landmarks.length === 0) return;
    
    // Determine status for color coding
    const status = determineStatus(frameData);
    
    // Accept both legacy object array and compact flat array [x0,y0,...]
    let normalizedLandmarks = landmarks;
    if (Array.isArray(landmarks) && typeof landmarks[0] === 'number') {
        // Convert flat array to minimal object array expected by drawer
        const arr = landmarks;
        const out = new Array(Math.floor(arr.length / 2));
        for (let i = 0, j = 0; i < arr.length - 1; i += 2, j += 1) {
            out[j] = { x: arr[i], y: arr[i + 1] };
        }
        normalizedLandmarks = out;
    }
    
    // Draw landmarks using LandmarkDrawing component
    LandmarkDrawing.drawAllLandmarks(
        ctx, 
        normalizedLandmarks, 
        width,              // scaleX
        height,             // scaleY
        0,                  // offsetX
        0,                  // offsetY
        lineWidthMultiplier, // lineWidthMultiplier
        false,              // autoCrop
        0.1,                // cropPadding
        status              // status for color determination
    );
};

