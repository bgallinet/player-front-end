import React from 'react';
import { primaryColor, secondaryColor } from '../../utils/DisplaySettings';

/**
 * LandmarkDrawing Component
 * 
 * A reusable component that provides facial landmark drawing functionality.
 * Contains all landmark connection arrays and drawing functions.
 * Can be used by FacialLandmarkUserUI and other components.
 * 
 * Status-based coloring:
 * - null (default): Uses default colors (face oval/nose: blue, eyes: blue, eyebrows: cyan, mouth: pink)
 * - 'smiling': All parts turn blue
 * - 'jawOpen': All parts turn yellow
 * - 'nodding': All parts turn red
 * - 'noddingSmiling': All parts turn magenta (nodding + smiling combination)
 * - 'noddingJawOpen': All parts turn orange (nodding + jawOpen combination)
 * 
 * Example usage:
 *   LandmarkDrawing.drawAllLandmarks(ctx, landmarks, width, height, 0, 0, 2.5, false, 0.1, 'smiling')
 *   LandmarkDrawing.drawAllLandmarks(ctx, landmarks, width, height, 0, 0, 2.5, false, 0.1, 'noddingSmiling')
 */

// Landmark connections for drawing detailed face mesh
const FACE_LANDMARKS_FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400,
  377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
];

// Left eye landmarks (accurate MediaPipe indices)
const LEFT_EYE = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33
];

// Right eye landmarks (accurate MediaPipe indices)
const RIGHT_EYE = [
  362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382, 362
];

// Left eyebrow landmarks - corrected to match right eyebrow structure
const LEFT_EYEBROW = [
  70, 63, 105, 66, 107, 55, 65, 52, 53, 46
];

// Right eyebrow landmarks
const RIGHT_EYEBROW = [
  276, 283, 282, 295, 285, 336, 296, 334, 293, 300
];

// Nose tip landmarks - only actual nose tip points
const NOSE_TIP = [
  1, 2, 5, 4, 6
];

// Mouth outer landmarks (accurate MediaPipe indices)
const MOUTH_OUTER = [
  61, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95
];

// Mouth inner landmarks - simplified to avoid overlaps
const MOUTH_INNER = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415
];

/**
 * LandmarkDrawing utility class
 * Provides static methods for drawing facial landmarks on canvas
 */
class LandmarkDrawing {
  
  /**
   * Draw connected landmarks on canvas
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array} landmarks - Array of landmark objects with x, y properties
   * @param {Array} landmarkIndices - Array of landmark indices to connect
   * @param {string} color - Color for the lines
   * @param {number} lineWidth - Width of the lines
   * @param {boolean} closed - Whether to close the path
   * @param {number} scaleX - X scale factor for positioning
   * @param {number} scaleY - Y scale factor for positioning
   * @param {number} offsetX - X offset for positioning
   * @param {number} offsetY - Y offset for positioning
   */
  static drawConnectedLandmarks(ctx, landmarks, landmarkIndices, color, lineWidth = 1, closed = false, scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0) {
    if (!landmarks || landmarkIndices.length === 0) return;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    
    for (let i = 0; i < landmarkIndices.length; i++) {
      const landmarkIndex = landmarkIndices[i];
      if (landmarkIndex < landmarks.length) {
        const landmark = landmarks[landmarkIndex];
        const x = offsetX + landmark.x * scaleX;
        const y = offsetY + landmark.y * scaleY;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    
    if (closed) {
      ctx.closePath();
    }
    ctx.stroke();
  }

  /**
   * Draw landmark points on canvas
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array} landmarks - Array of landmark objects with x, y properties
   * @param {Array} landmarkIndices - Array of landmark indices to draw
   * @param {string} color - Color for the points
   * @param {number} radius - Radius of the points
   * @param {number} scaleX - X scale factor for positioning
   * @param {number} scaleY - Y scale factor for positioning
   * @param {number} offsetX - X offset for positioning
   * @param {number} offsetY - Y offset for positioning
   */
  static drawLandmarkPoints(ctx, landmarks, landmarkIndices, color, radius = 0.5, scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0) {
    if (!landmarks) return;
    
    ctx.fillStyle = color;
    landmarkIndices.forEach(index => {
      if (index < landmarks.length) {
        const landmark = landmarks[index];
        const x = offsetX + landmark.x * scaleX;
        const y = offsetY + landmark.y * scaleY;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  }

  /**
   * Fill area defined by connected landmarks
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array} landmarks - Array of landmark objects with x, y properties
   * @param {Array} landmarkIndices - Array of landmark indices to connect and fill
   * @param {string} color - Color for the fill
   * @param {number} scaleX - X scale factor for positioning
   * @param {number} scaleY - Y scale factor for positioning
   * @param {number} offsetX - X offset for positioning
   * @param {number} offsetY - Y offset for positioning
   */
  static fillConnectedLandmarks(ctx, landmarks, landmarkIndices, color, scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0) {
    if (!landmarks || landmarkIndices.length === 0) return;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    
    for (let i = 0; i < landmarkIndices.length; i++) {
      const landmarkIndex = landmarkIndices[i];
      if (landmarkIndex < landmarks.length) {
        const landmark = landmarks[landmarkIndex];
        const x = offsetX + landmark.x * scaleX;
        const y = offsetY + landmark.y * scaleY;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw white pupils at the center of each eye
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array} landmarks - Array of landmark objects with x, y properties
   * @param {number} scaleX - X scale factor for positioning
   * @param {number} scaleY - Y scale factor for positioning
   * @param {number} offsetX - X offset for positioning
   * @param {number} offsetY - Y offset for positioning
   * @param {number} lineWidthMultiplier - Multiplier for pupil size
   */
  static drawEyePupils(ctx, landmarks, scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0, lineWidthMultiplier = 1) {
    if (!landmarks) return;
    
    // Calculate center of left eye
    const leftEyeCenter = this.calculateEyeCenter(landmarks, LEFT_EYE);
    if (leftEyeCenter) {
      const x = offsetX + leftEyeCenter.x * scaleX;
      const y = offsetY + leftEyeCenter.y * scaleY;
      const pupilRadius = 2 * lineWidthMultiplier;
      
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, y, pupilRadius, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    // Calculate center of right eye
    const rightEyeCenter = this.calculateEyeCenter(landmarks, RIGHT_EYE);
    if (rightEyeCenter) {
      const x = offsetX + rightEyeCenter.x * scaleX;
      const y = offsetY + rightEyeCenter.y * scaleY;
      const pupilRadius = 2 * lineWidthMultiplier;
      
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, y, pupilRadius, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  /**
   * Calculate the center point of an eye from its landmark array
   * @param {Array} landmarks - Array of landmark objects with x, y properties
   * @param {Array} eyeIndices - Array of eye landmark indices
   * @returns {Object|null} Center point with x, y properties or null if calculation fails
   */
  static calculateEyeCenter(landmarks, eyeIndices) {
    if (!landmarks || !eyeIndices || eyeIndices.length === 0) return null;
    
    let sumX = 0;
    let sumY = 0;
    let validPoints = 0;
    
    eyeIndices.forEach(index => {
      if (index < landmarks.length) {
        sumX += landmarks[index].x;
        sumY += landmarks[index].y;
        validPoints++;
      }
    });
    
    if (validPoints === 0) return null;
    
    return {
      x: sumX / validPoints,
      y: sumY / validPoints
    };
  }

  /**
   * Calculate bounding box of landmarks for auto-cropping
   * @param {Array} landmarks - Array of landmark objects with x, y properties
   * @param {number} padding - Padding factor around landmarks (default 0.1 = 10%)
   * @returns {Object} Bounding box with min/max coordinates and dimensions
   */
  static calculateLandmarkBounds(landmarks, padding = 0.1) {
    if (!landmarks || landmarks.length === 0) {
      return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
    }

    let minX = landmarks[0].x;
    let minY = landmarks[0].y;
    let maxX = landmarks[0].x;
    let maxY = landmarks[0].y;

    // Find the bounding box of all landmarks
    landmarks.forEach(landmark => {
      minX = Math.min(minX, landmark.x);
      minY = Math.min(minY, landmark.y);
      maxX = Math.max(maxX, landmark.x);
      maxY = Math.max(maxY, landmark.y);
    });

    // Add padding around the landmarks
    const width = maxX - minX;
    const height = maxY - minY;
    const paddingX = width * padding;
    const paddingY = height * padding;

    return {
      minX: Math.max(0, minX - paddingX),
      minY: Math.max(0, minY - paddingY),
      maxX: Math.min(1, maxX + paddingX),
      maxY: Math.min(1, maxY + paddingY),
      width: width + 2 * paddingX,
      height: height + 2 * paddingY
    };
  }

  /**
   * Get color based on landmark part and status
   * @param {string} part - The landmark part (faceOval, eyes, eyebrows, nose, mouth, pupils)
   * @param {string} status - Status that determines colors (null, 'smiling', 'jawOpen', 'nodding', 'noddingSmiling', 'noddingJawOpen')
   * @returns {string} Color to use for drawing
   */
  static getColorForStatus(part, status = null) {
    // Default colors per part
    const defaultColors = {
      'faceOval': secondaryColor,
      'eyes': primaryColor,
      'pupils': '#FFFFFF',
      'eyebrows': '#00FFFF',
      'nose': secondaryColor,
      'noseTip': secondaryColor,
      'mouth': '#FF69B4'
    };

    // Special rule: when smiling, only the mouth changes to light blue; others unchanged
    if (status === 'smiling') {
      if (part === 'pupils') return '#FFFFFF';
      if (part === 'mouth') return '#00FF00'; // green when smiling
      return defaultColors[part] || secondaryColor;
    }

    // Special rule: when nodding, only the head border (face oval) turns red; others unchanged
    if (status === 'nodding') {
      if (part === 'pupils') return '#FFFFFF';
      if (part === 'faceOval') return '#FF0000';
      return defaultColors[part] || secondaryColor;
    }

    // Special rule: when jawOpen, only the mouth changes to yellow; others unchanged
    if (status === 'jawOpen') {
      if (part === 'pupils') return '#FFFFFF';
      if (part === 'mouth') return '#FFFF00'; // yellow
      return defaultColors[part] || secondaryColor;
    }

    // Special rule: when noddingSmiling, combine effects: face oval red + mouth light blue; others unchanged
    if (status === 'noddingSmiling') {
      if (part === 'pupils') return '#FFFFFF';
      if (part === 'faceOval') return '#FF0000';
      if (part === 'mouth') return '#00FF00'; // green when smiling
      return defaultColors[part] || secondaryColor;
    }

    // Special rule: when noddingJawOpen, combine effects: face oval red + mouth yellow; others unchanged
    if (status === 'noddingJawOpen') {
      if (part === 'pupils') return '#FFFFFF';
      if (part === 'faceOval') return '#FF0000';
      if (part === 'mouth') return '#FFFF00';
      return defaultColors[part] || secondaryColor;
    }

    // Status-based colors for other reactions
    const statusColors = {
      // 'noddingSmiling' handled above as combined effects
      // 'noddingJawOpen' handled above as combined effects
    };
    
    if (status && statusColors[status]) {
      if (part === 'pupils') return '#FFFFFF';
      return statusColors[status];
    }
    
    return defaultColors[part] || secondaryColor;
  }

  /**
   * Draw all facial landmarks with default styling
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array} landmarks - Array of landmark objects with x, y properties
   * @param {number} scaleX - X scale factor for positioning
   * @param {number} scaleY - Y scale factor for positioning
   * @param {number} offsetX - X offset for positioning
   * @param {number} offsetY - Y offset for positioning
   * @param {number} lineWidthMultiplier - Multiplier for line widths (default 2.5 for better readability)
   * @param {boolean} autoCrop - Whether to auto-crop to landmark bounds (default false)
   * @param {number} cropPadding - Padding for auto-crop (default 0.1)
   * @param {string} status - Status for color determination ('smiling', 'jawOpen', 'nodding', 'noddingSmiling', 'noddingJawOpen', or null for default)
   */
  static drawAllLandmarks(ctx, landmarks, scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0, lineWidthMultiplier = 2.5, autoCrop = false, cropPadding = 0.1, status = null) {
    if (!landmarks || landmarks.length === 0) return;

    let finalScaleX = scaleX;
    let finalScaleY = scaleY;
    let finalOffsetX = offsetX;
    let finalOffsetY = offsetY;

    // Apply auto-cropping if enabled
    if (autoCrop) {
      const bounds = this.calculateLandmarkBounds(landmarks, cropPadding);
      
      // Calculate scale factors to fit the cropped area
      const cropScaleX = scaleX / bounds.width;
      const cropScaleY = scaleY / bounds.height;
      
      // Use the smaller scale to maintain aspect ratio
      const cropScale = Math.min(cropScaleX, cropScaleY);
      
      finalScaleX = cropScale;
      finalScaleY = cropScale;
      
      // Adjust offset to center the cropped landmarks
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      
      finalOffsetX = offsetX + (scaleX / 2) - (centerX * cropScale);
      finalOffsetY = offsetY + (scaleY / 2) - (centerY * cropScale);
    }

    // Get colors based on status
    const faceOvalColor = this.getColorForStatus('faceOval', status);
    const eyeColor = this.getColorForStatus('eyes', status);
    const eyebrowColor = this.getColorForStatus('eyebrows', status);
    const noseColor = this.getColorForStatus('nose', status);
    const mouthColor = this.getColorForStatus('mouth', status);
    
    // Face oval
    this.drawConnectedLandmarks(
      ctx, landmarks, FACE_LANDMARKS_FACE_OVAL, faceOvalColor, 
      2.5 * lineWidthMultiplier, true, finalScaleX, finalScaleY, finalOffsetX, finalOffsetY
    );
    
    // Left eye
    this.drawConnectedLandmarks(
      ctx, landmarks, LEFT_EYE, eyeColor, 
      2.5 * lineWidthMultiplier, true, finalScaleX, finalScaleY, finalOffsetX, finalOffsetY
    );
    
    // Right eye
    this.drawConnectedLandmarks(
      ctx, landmarks, RIGHT_EYE, eyeColor, 
      2.5 * lineWidthMultiplier, true, finalScaleX, finalScaleY, finalOffsetX, finalOffsetY
    );
    
    // Draw white pupils at the center of each eye
    this.drawEyePupils(ctx, landmarks, finalScaleX, finalScaleY, finalOffsetX, finalOffsetY, lineWidthMultiplier);
    
    // Left eyebrow (filled)
    this.fillConnectedLandmarks(
      ctx, landmarks, LEFT_EYEBROW, eyebrowColor, 
      finalScaleX, finalScaleY, finalOffsetX, finalOffsetY
    );
    this.drawConnectedLandmarks(
      ctx, landmarks, LEFT_EYEBROW, eyebrowColor, 
      2.5 * lineWidthMultiplier, false, finalScaleX, finalScaleY, finalOffsetX, finalOffsetY
    );
    
    // Right eyebrow (filled)
    this.fillConnectedLandmarks(
      ctx, landmarks, RIGHT_EYEBROW, eyebrowColor, 
      finalScaleX, finalScaleY, finalOffsetX, finalOffsetY
    );
    this.drawConnectedLandmarks(
      ctx, landmarks, RIGHT_EYEBROW, eyebrowColor, 
      2.5 * lineWidthMultiplier, false, finalScaleX, finalScaleY, finalOffsetX, finalOffsetY
    );
    
    // Nose bridge 
    this.drawConnectedLandmarks(
      ctx, landmarks, [168, 8, 9, 10, 151], noseColor, 
      2.5 * lineWidthMultiplier, false, finalScaleX, finalScaleY, finalOffsetX, finalOffsetY
    );
    
    // Nose tip 
    this.drawLandmarkPoints(
      ctx, landmarks, NOSE_TIP, noseColor, 
      3 * lineWidthMultiplier, finalScaleX, finalScaleY, finalOffsetX, finalOffsetY
    );
    
    // Additional nose points
    this.drawLandmarkPoints(
      ctx, landmarks, [19, 20, 94, 125], noseColor, 
      2.5 * lineWidthMultiplier, finalScaleX, finalScaleY, finalOffsetX, finalOffsetY
    );
    
    // Mouth outer (filled)
    this.fillConnectedLandmarks(
      ctx, landmarks, MOUTH_OUTER, mouthColor, 
      finalScaleX, finalScaleY, finalOffsetX, finalOffsetY
    );
    this.drawConnectedLandmarks(
      ctx, landmarks, MOUTH_OUTER, mouthColor, 
      2.5 * lineWidthMultiplier, true, finalScaleX, finalScaleY, finalOffsetX, finalOffsetY
    );
    
    // Mouth inner (filled)
    this.fillConnectedLandmarks(
      ctx, landmarks, MOUTH_INNER, mouthColor, 
      finalScaleX, finalScaleY, finalOffsetX, finalOffsetY
    );
    this.drawConnectedLandmarks(
      ctx, landmarks, MOUTH_INNER, mouthColor, 
      2.5 * lineWidthMultiplier, true, finalScaleX, finalScaleY, finalOffsetX, finalOffsetY
    );
  }

  /**
   * Draw user name text below the landmark drawing
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} userName - User name to display
   * @param {number} centerX - X position of the face center
   * @param {number} centerY - Y position of the face center
   * @param {number} faceSize - Size of the face for positioning
   * @param {number} scale - Scale factor for text size
   * @param {Array} landmarks - Landmarks for auto-crop calculation (optional)
   * @param {boolean} autoCrop - Whether auto-crop is enabled (optional)
   * @param {number} cropPadding - Padding for auto-crop (optional)
   */
  static drawUserName(ctx, userName, centerX, centerY, faceSize, scale = 1, landmarks = null, autoCrop = false, cropPadding = 0.1) {
    if (!userName || !ctx) return;
    
    // Set text properties - smaller font size
    const fontSize = Math.max(8, 10 * scale);
    ctx.font = `${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // Add text shadow for better visibility
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    let textY;
    
    // If landmarks are provided, find the lowest point and position text below it
    if (landmarks && landmarks.length > 0) {
      // Find the lowest Y coordinate among all landmarks
      const maxLandmarkY = Math.max(...landmarks.map(landmark => landmark.y));
      
      // Calculate the actual position based on the drawing transformation
      let finalScaleY = faceSize;
      let finalOffsetY = centerY - faceSize / 2;
      
      // Apply auto-crop transformation if enabled
      if (autoCrop) {
        const bounds = this.calculateLandmarkBounds(landmarks, cropPadding);
        const cropScaleY = faceSize / bounds.height;
        const cropScale = Math.min(faceSize / bounds.width, cropScaleY);
        
        finalScaleY = cropScale;
        const centerLandmarkY = (bounds.minY + bounds.maxY) / 2;
        finalOffsetY = centerY - faceSize / 2 + (faceSize / 2) - (centerLandmarkY * cropScale);
      }
      
      // Position text right below the lowest landmark point
      textY = finalOffsetY + maxLandmarkY * finalScaleY + 5 * scale;
    } else {
      // Fallback to positioning below the face center if no landmarks
      textY = centerY + faceSize / 2 + 5 * scale;
    }
    
    // Draw the user name
    ctx.fillText(userName, centerX, textY);
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  /**
   * Draw all facial landmarks with auto-cropping enabled by default
   * This is a convenience method that automatically crops to landmark bounds
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array} landmarks - Array of landmark objects with x, y properties
   * @param {number} width - Target width for the drawing
   * @param {number} height - Target height for the drawing
   * @param {number} offsetX - X offset for positioning
   * @param {number} offsetY - Y offset for positioning
   * @param {number} lineWidthMultiplier - Multiplier for line widths (default 1 for better readability)
   * @param {number} cropPadding - Padding for auto-crop (default 0.15)
   * @param {string} status - Status for color determination ('smiling', 'jawOpen', 'nodding', 'noddingSmiling', 'noddingJawOpen', or null for default)
   */
  static drawLandmarksAutoCrop(ctx, landmarks, width, height, offsetX = 0, offsetY = 0, lineWidthMultiplier = 1, cropPadding = 0.15, status = null) {
    this.drawAllLandmarks(ctx, landmarks, width, height, offsetX, offsetY, lineWidthMultiplier, true, cropPadding, status);
  }

  /**
   * Get landmark connection arrays for external use
   */
  static getLandmarkArrays() {
    return {
      FACE_LANDMARKS_FACE_OVAL,
      LEFT_EYE,
      RIGHT_EYE, 
      LEFT_EYEBROW,
      RIGHT_EYEBROW,
      NOSE_TIP,
      MOUTH_OUTER,
      MOUTH_INNER
    };
  }
}

// Export the class and individual arrays for flexibility
export default LandmarkDrawing;
export {
  FACE_LANDMARKS_FACE_OVAL,
  LEFT_EYE,
  RIGHT_EYE,
  LEFT_EYEBROW,
  RIGHT_EYEBROW,
  NOSE_TIP,
  MOUTH_OUTER,
  MOUTH_INNER
}; 