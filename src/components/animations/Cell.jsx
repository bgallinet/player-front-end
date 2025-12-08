import React, { useEffect, useRef } from 'react';
import BodyPoseDrawing from './BodyPoseDrawing';
import { drawLandmarksOnCanvas } from './landmarkRenderer';
import { secondaryColor } from '../../utils/DisplaySettings';

/**
 * Cell - React component that manages canvas and animation for a single user's feed
 * Handles its own canvas, animation loop, and drawing using LandmarkDrawing/BodyPoseDrawing
 */
const Cell = ({ userId, landmarkData, poseData, cellWidth, cellHeight, showNames }) => {
    const canvasRef = useRef(null);
    const lastDisplayedTimestamp = useRef(-1);
    const dataRef = useRef({ landmarkData, poseData });
    const nextFrameTimeout = useRef(null);
    
    // Update data ref when new data arrives
    useEffect(() => {
        const prevLandmarkCount = dataRef.current.landmarkData?.length || 0;
        const prevPoseCount = dataRef.current.poseData?.length || 0;
        const newLandmarkCount = landmarkData?.length || 0;
        const newPoseCount = poseData?.length || 0;
        
        dataRef.current = { landmarkData, poseData };
        
        // Only reset timestamp if data becomes completely empty
        if (!landmarkData?.length && !poseData?.length) {
            lastDisplayedTimestamp.current = -1;
        } else if (lastDisplayedTimestamp.current === -1 && (landmarkData?.length || poseData?.length)) {
            // First data arrived - start from the latest frame for immediate display (like FacialLandmarkUserUI)
            const latestArray = landmarkData?.length ? landmarkData : poseData;
            if (latestArray.length > 0) {
                // Start from the latest frame to minimize delay and show current state immediately
                const latestData = latestArray[latestArray.length - 1];
                lastDisplayedTimestamp.current = latestData.timestamp - 1;
            }
        }
    }, [landmarkData, poseData, userId]);
    
    // Setup canvas and animation loop
    useEffect(() => {
        if (!canvasRef.current) return;
        
        const canvas = canvasRef.current;
        // Set canvas size once per effect run (or when deps change), not every frame
        canvas.width = cellWidth;
        canvas.height = cellHeight;

        const drawFrame = () => {
            const { landmarkData, poseData } = dataRef.current;
            const ctx = canvas.getContext('2d');
            
            // Determine which data to use - prioritize pose if both exist
            const dataArray = poseData?.length ? poseData : landmarkData;
            const isPoseData = poseData?.length > 0;
            
            if (!dataArray?.length) {
                nextFrameTimeout.current = setTimeout(drawFrame, 50); // Check again in 50ms
                return; // Don't clear - keep last frame visible
            }
            
            // Find next frame to display
            let dataIndex = -1;
            for (let i = 0; i < dataArray.length; i++) {
                if (dataArray[i].timestamp > lastDisplayedTimestamp.current) {
                    dataIndex = i;
                    break;
                }
            }
            
            // If caught up, wait (keep last frame visible - don't clear)
            if (dataIndex === -1) {
                nextFrameTimeout.current = setTimeout(drawFrame, 50); // Check again in 50ms
                return; // Don't clear - keep last frame visible
            }
            
            // We have a new frame - clear canvas and draw it
            ctx.clearRect(0, 0, cellWidth, cellHeight);
            
            // Get frame data and draw
            const frameData = dataArray[dataIndex];
            const frameTimestamp = frameData.timestamp;
            const prevTimestamp = lastDisplayedTimestamp.current;
            lastDisplayedTimestamp.current = frameTimestamp;
            
            // Draw landmarks/pose first
            // Check if this is actually pose data by looking at the frame structure
            const hasPoseLandmarks = frameData && frameData.pose_landmarks && Array.isArray(frameData.pose_landmarks);
            if (isPoseData && hasPoseLandmarks) {
                drawPose(ctx, frameData, null, cellWidth, cellHeight);
            } else {
                // Try to draw landmarks (works for both landmark-only and mixed data)
                drawLandmarks(ctx, frameData, null, cellWidth, cellHeight);
            }
            
            // Draw username on top if enabled (drawn last so it's always visible)
            if (showNames && userId) {
                drawUserName(ctx, userId, cellWidth, cellHeight);
            }
            
            // Calculate time until next frame based on timestamp difference
            let delayUntilNextFrame = 100; // Default 100ms if no more frames (check more frequently)
            
            if (dataIndex + 1 < dataArray.length) {
                const nextFrame = dataArray[dataIndex + 1];
                const timestampDiff = nextFrame.timestamp - frameTimestamp;
                
                // Use actual timestamp difference (typically 150-200ms for real-time, or 1000ms for slow feeds)
                // Cap at reasonable bounds for smooth playback
                delayUntilNextFrame = Math.max(33, Math.min(1000, timestampDiff));
                
            }
            
            // Schedule next frame based on timestamp difference
            nextFrameTimeout.current = setTimeout(drawFrame, delayUntilNextFrame);
        };
        
        drawFrame();
        
        return () => {
            if (nextFrameTimeout.current) {
                clearTimeout(nextFrameTimeout.current);
            }
        };
    }, [cellWidth, cellHeight, showNames, userId]);
    
    return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />;
};

/**
 * Draw username at the top of the cell
 */
const drawUserName = (ctx, userName, cellWidth, cellHeight) => {
    if (!userName || !ctx) return;
    
    const fontSize = Math.max(10, Math.min(cellWidth, cellHeight) * 0.1);
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // Draw text with outline for better visibility
    const textX = cellWidth / 2;
    const textY = 5;
    ctx.strokeText(userName, textX, textY);
    ctx.fillText(userName, textX, textY);
};

/**
 * Draw landmarks on canvas using shared renderer
 */
const drawLandmarks = (ctx, frameData, userName, cellWidth, cellHeight) => {
    if (!ctx) return;
    const hasObjects = Array.isArray(frameData.landmarks) && frameData.landmarks.length > 0;
    const hasFlat = Array.isArray(frameData.p) && frameData.p.length > 0;
    if (!hasObjects && !hasFlat) return;
    
    // Flip horizontally to correct mirrored appearance for either format
    let input = null;
    if (hasObjects) {
        input = frameData.landmarks.map(landmark => ({
            ...landmark,
            x: 1 - landmark.x
        }));
    } else {
        // Flat array [x0,y0,...]
        const src = frameData.p;
        const out = new Array(src.length);
        for (let i = 0; i < src.length - 1; i += 2) {
            out[i] = 1 - src[i];
            out[i + 1] = src[i + 1];
        }
        input = out;
    }
    
    // Use shared renderer function
    drawLandmarksOnCanvas(ctx, input, frameData, cellWidth, cellHeight, 0.6);
};

/**
 * Draw pose on canvas
 */
const drawPose = (ctx, frameData, userName, cellWidth, cellHeight) => {
    if (!ctx || !frameData.pose_landmarks) return;
    
    const cellCenterX = cellWidth / 2;
    const cellCenterY = cellHeight / 2;
    const visSize = Math.min(cellWidth, cellHeight) * 0.7;
    const isMobile = window.innerWidth < 768;
    const finalVisSize = visSize * (isMobile ? 0.8 : 1.0);
    const visOffsetX = cellCenterX - finalVisSize / 2;
    const visOffsetY = cellCenterY - finalVisSize / 2 - 15;
    
    // Flip horizontally to correct mirrored appearance
    const flippedPose = frameData.pose_landmarks.map(landmark => ({
        ...landmark,
        x: 1 - landmark.x
    }));
    
    BodyPoseDrawing.drawAllPoseLandmarks(
        ctx, 
        flippedPose, 
        finalVisSize, finalVisSize, 
        visOffsetX, visOffsetY, 
        0.2, 0.3, secondaryColor,
        frameData.leftHandRaised || false,  // leftHandRaised
        frameData.rightHandRaised || false  // rightHandRaised
    );
};

export default Cell;
