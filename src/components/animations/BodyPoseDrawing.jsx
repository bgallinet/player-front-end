import React from 'react';
import { secondaryColor, primaryColor } from '../../utils/DisplaySettings';

/**
 * BodyPoseDrawing Component
 * 
 * A reusable component that provides body pose landmark drawing functionality.
 * Contains all pose landmark connection arrays and drawing functions.
 * Provides body pose landmark drawing functionality.
 */

// MediaPipe Pose landmark connections for drawing skeleton
const POSE_CONNECTIONS = [
    // Face
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],
    // Upper body
    [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
    [11, 23], [12, 24], [23, 24],
    // Lower body
    [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
    [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
    [25, 26]
];

/**
 * BodyPoseDrawing utility class
 * Provides static methods for drawing body pose landmarks on canvas
 */
class BodyPoseDrawing {
  
  /**
   * Check if a connection is part of the left arm or hand
   * Left arm: shoulder (11) -> elbow (13) -> wrist (15)
   * Left hand: wrist (15) -> hand landmarks (17, 19, 21) and [17, 19]
   */
  static isLeftArmConnection(startIdx, endIdx) {
    return (startIdx === 11 && endIdx === 13) || // shoulder to elbow
           (startIdx === 13 && endIdx === 15) || // elbow to wrist
           (startIdx === 15 && (endIdx === 17 || endIdx === 19 || endIdx === 21)) || // wrist to hand
           (startIdx === 17 && endIdx === 19);   // hand connection
  }

  /**
   * Check if a connection is part of the right arm or hand
   * Right arm: shoulder (12) -> elbow (14) -> wrist (16)
   * Right hand: wrist (16) -> hand landmarks (18, 20, 22) and [18, 20]
   */
  static isRightArmConnection(startIdx, endIdx) {
    return (startIdx === 12 && endIdx === 14) || // shoulder to elbow
           (startIdx === 14 && endIdx === 16) || // elbow to wrist
           (startIdx === 16 && (endIdx === 18 || endIdx === 20 || endIdx === 22)) || // wrist to hand
           (startIdx === 18 && endIdx === 20);   // hand connection
  }

  /**
   * Draw all pose landmarks with default styling
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array} landmarks - Array of pose landmark objects with x, y, z, visibility properties
   * @param {number} scaleX - X scale factor for positioning (typically canvas width)
   * @param {number} scaleY - Y scale factor for positioning (typically canvas height)
   * @param {number} offsetX - X offset for positioning
   * @param {number} offsetY - Y offset for positioning
   * @param {number} lineWidthMultiplier - Multiplier for line widths (default 1)
   * @param {number} minVisibility - Minimum visibility threshold (default 0.3)
   * @param {string} color - Color for landmarks and connections (default secondaryColor)
   * @param {boolean} leftHandRaised - Whether left hand is raised (default false)
   * @param {boolean} rightHandRaised - Whether right hand is raised (default false)
   */
  static drawAllPoseLandmarks(
    ctx, 
    landmarks, 
    scaleX = 1, 
    scaleY = 1, 
    offsetX = 0, 
    offsetY = 0, 
    lineWidthMultiplier = 1,
    minVisibility = 0.3,
    color = secondaryColor,
    leftHandRaised = false,
    rightHandRaised = false
  ) {
    if (!landmarks || landmarks.length === 0) return;

    // Draw connections between key points using secondary color with higher thickness
    // Arms use primary color when hand is raised
    ctx.lineWidth = 6 * lineWidthMultiplier;
    
    POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      if (landmarks[startIdx] && landmarks[endIdx] && 
          landmarks[startIdx].visibility > minVisibility && 
          landmarks[endIdx].visibility > minVisibility) {
        const startX = offsetX + landmarks[startIdx].x * scaleX;
        const startY = offsetY + landmarks[startIdx].y * scaleY;
        const endX = offsetX + landmarks[endIdx].x * scaleX;
        const endY = offsetY + landmarks[endIdx].y * scaleY;
        
        // Determine color: primary for raised arms, secondary for everything else
        if (this.isLeftArmConnection(startIdx, endIdx) && leftHandRaised) {
          ctx.strokeStyle = primaryColor;
        } else if (this.isRightArmConnection(startIdx, endIdx) && rightHandRaised) {
          ctx.strokeStyle = primaryColor;
        } else {
          ctx.strokeStyle = color;
        }
        
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    });
  }

  /**
   * Calculate bounding box of pose landmarks for auto-cropping
   * @param {Array} landmarks - Array of pose landmark objects with x, y, visibility properties
   * @param {number} padding - Padding factor around landmarks (default 0.1 = 10%)
   * @param {number} minVisibility - Minimum visibility threshold (default 0.3)
   * @returns {Object} Bounding box with min/max coordinates and dimensions
   */
  static calculatePoseBounds(landmarks, padding = 0.1, minVisibility = 0.3) {
    if (!landmarks || landmarks.length === 0) {
      return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
    }

    // Find first visible landmark to initialize bounds
    const visibleLandmarks = landmarks.filter(lm => lm.visibility > minVisibility);
    if (visibleLandmarks.length === 0) {
      return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
    }

    let minX = visibleLandmarks[0].x;
    let minY = visibleLandmarks[0].y;
    let maxX = visibleLandmarks[0].x;
    let maxY = visibleLandmarks[0].y;

    // Find the bounding box of all visible landmarks
    visibleLandmarks.forEach(landmark => {
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
   * Draw pose landmarks with auto-cropping to fit the canvas
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array} landmarks - Array of pose landmark objects
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   * @param {number} lineWidthMultiplier - Multiplier for line widths (default 1)
   * @param {number} minVisibility - Minimum visibility threshold (default 0.3)
   * @param {string} color - Color for landmarks and connections (default secondaryColor)
   * @param {number} cropPadding - Padding for auto-crop (default 0.15)
   */
  static drawPoseAutoCrop(
    ctx,
    landmarks,
    canvasWidth,
    canvasHeight,
    lineWidthMultiplier = 1,
    minVisibility = 0.3,
    color = secondaryColor,
    cropPadding = 0.15
  ) {
    if (!landmarks || landmarks.length === 0) return;

    const bounds = this.calculatePoseBounds(landmarks, cropPadding, minVisibility);
    
    // Calculate scale factors to fit the cropped area
    const cropScaleX = canvasWidth / bounds.width;
    const cropScaleY = canvasHeight / bounds.height;
    
    // Use the smaller scale to maintain aspect ratio
    const cropScale = Math.min(cropScaleX, cropScaleY);
    
    // Adjust offset to center the cropped pose
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    const finalOffsetX = (canvasWidth / 2) - (centerX * cropScale);
    const finalOffsetY = (canvasHeight / 2) - (centerY * cropScale);

    this.drawAllPoseLandmarks(
      ctx,
      landmarks,
      cropScale,
      cropScale,
      finalOffsetX,
      finalOffsetY,
      lineWidthMultiplier,
      minVisibility,
      color
    );
  }

  /**
   * Draw user name text below the pose drawing
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} userName - User name to display
   * @param {number} centerX - X position of the pose center
   * @param {number} centerY - Y position of the pose center
   * @param {number} poseSize - Size of the pose for positioning
   * @param {number} scale - Scale factor for text size
   * @param {Array} landmarks - Landmarks for position calculation (optional)
   */
  static drawUserName(ctx, userName, centerX, centerY, poseSize, scale = 1, landmarks = null) {
    if (!userName || !ctx) return;
    
    // Set text properties
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
    
    // If landmarks are provided, find the lowest visible point
    if (landmarks && landmarks.length > 0) {
      const visibleLandmarks = landmarks.filter(lm => lm.visibility > 0.3);
      if (visibleLandmarks.length > 0) {
        const maxLandmarkY = Math.max(...visibleLandmarks.map(landmark => landmark.y));
        textY = centerY - poseSize / 2 + maxLandmarkY * poseSize + 5 * scale;
      } else {
        textY = centerY + poseSize / 2 + 5 * scale;
      }
    } else {
      textY = centerY + poseSize / 2 + 5 * scale;
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
   * Get pose connection arrays for external use
   */
  static getPoseConnections() {
    return POSE_CONNECTIONS;
  }
}

// Export the class and connection arrays
export default BodyPoseDrawing;
export { POSE_CONNECTIONS };

