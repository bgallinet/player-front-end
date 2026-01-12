import React, { useEffect, useState, useRef } from 'react';
import { Button } from 'react-bootstrap';
import AnalyticsAPI from '../../utils/AnalyticsAPI.jsx';
import { scanFrequencyLandmark } from '../../utils/DisplaySettings.jsx';
import { getSessionNameFromUrl } from '../../hooks/sessionUtils.js';
import { createAuthenticatedRequestBody } from '../../hooks/sessionUtils.js';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { drawLandmarksOnCanvas } from '../animations/landmarkRenderer';
import OrientedCamera from '../OrientedCamera.jsx';
import { uploadDetectionData, shouldUpload, clearArrays } from './detectionUploader';
import NoddingCalculator from './NoddingCalculator.jsx';
import { noddingAnalysisWindow, thresholdForVisualizationOfNodding, thresholdForVisualizationOfSmiling, thresholdForVisualizationOfJawOpen, landmarkDataUploadInterval } from '../../utils/DisplaySettings.jsx';
import { DATA_COLLECTION_WINDOW } from '../../hooks/ReactionMapperConfig';
import PlayPauseButton from '../../utils/PlayPauseButton.jsx';
import LandmarkWebSocket from '../../hooks/LandmarkWebSocket';


// Environment detection for production optimization
const isProduction = process.env.NODE_ENV === 'production';

// Landmark arrays are now imported from LandmarkDrawing component

const FacialLandmarkUserUI = ({ 
    stream, 
    embeddingTW, 
    is_demo_session, 
    demo_username,
    sessionName,
    sizeMode = 'small' // 'small' (default) or 'large'
}) => {
    // State management
    const videoRef = useRef(null);
    const intervalIdRef = useRef(null);
    const canvasRef = useRef(null);
    const faceLandmarkerRef = useRef(null);
    const [scan, setScan] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [modelError, setModelError] = useState(null);
    const [detectorInitialized, setDetectorInitialized] = useState(false);
    
    // Landmark state
    const [faceVisible, setFaceVisible] = useState(localStorage.getItem('face_visible') || 'false');
    const [landmarkCount, setLandmarkCount] = useState(0);
    const [faceConfidence, setFaceConfidence] = useState(0);
    const [lastDetectionTime, setLastDetectionTime] = useState(0);
    
    // Face reactions state (from blendshapes)
    const [smilingIntensity, setSmilingIntensity] = useState(0);
    const [jawOpenIntensity, setJawOpenIntensity] = useState(0);
    
    // Nodding state (calculated from facial landmarks)
    const [noddingFrequency, setNoddingFrequency] = useState(0);
    const [noddingAmplitude, setNoddingAmplitude] = useState(0);
    
    // Rolling buffer for landmark-based nodding detection
    const landmarkBuffer = useRef([]);
    const lastNoddingCalculation = useRef(0);
    
    // Temporal smoothing for nodding amplitude
    const smoothedAmplitude = useRef(0);
    const amplitudeSmoothingFactor = 0.4;
    
    // Track latest nodding values for immediate localStorage access (React state is async)
    const latestNoddingFrequency = useRef(0);
    const latestNoddingAmplitude = useRef(0);
    
    // WebSocket for real-time upload
    const uploadWebSocketRef = useRef(null);
    const isUploadConnectingRef = useRef(false); // Prevent race conditions
    const useWebSocketUpload = true; // Feature flag - set to false to use HTTP fallback
    const [wsUploadConnected, setWsUploadConnected] = useState(false);
    
    // Throttle WebSocket uploads to prevent overwhelming server (optional optimization)
    const lastWebSocketUploadTime = useRef(0);
    const WEBSOCKET_UPLOAD_MIN_INTERVAL = 150; // Minimum 150ms between uploads (~6.7 fps max, but smooth enough)

    // Camera size based on mode (default is 60px×80px portrait or 80px×60px landscape)
    const cameraSize = sizeMode === 'large' ? '160px' : '80px';
    

    //////////////////////////////////// HELPER FUNCTIONS ////////////////////////////////////
    
    /**
     * Compute face bounding box from landmarks
     * @param {Array} landmarks - Array of landmark objects with x, y, z properties (normalized 0-1)
     * @param {Number} videoWidth - Width of the video in pixels
     * @param {Number} videoHeight - Height of the video in pixels
     * @returns {Object} - {centerX, centerY, width, height, top, left}
     */
    const computeFaceBoundingBox = (landmarks, videoWidth, videoHeight) => {
        if (!landmarks || landmarks.length === 0) {
            return null;
        }
        
        // Find min/max coordinates (landmarks are normalized 0-1)
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        
        landmarks.forEach(landmark => {
            if (landmark.x < minX) minX = landmark.x;
            if (landmark.x > maxX) maxX = landmark.x;
            if (landmark.y < minY) minY = landmark.y;
            if (landmark.y > maxY) maxY = landmark.y;
        });
        
        // Convert normalized coordinates to pixel coordinates
        const left = Math.round(minX * videoWidth);
        const top = Math.round(minY * videoHeight);
        const width = Math.round((maxX - minX) * videoWidth);
        const height = Math.round((maxY - minY) * videoHeight);
        
        // Calculate center coordinates
        const centerX = Math.round(left + width / 2);
        const centerY = Math.round(top + height / 2);
        
        return {
            width,
            height,
            position: {
                top,
                left,
                centerX,
                centerY
            }
        };
    };
    
    /**
     * Extract face reactions from MediaPipe blendshapes
     * @param {Array} blendshapes - Array of blendshape categories with categoryName and score
     * @returns {Object} - {smiling: number, jawOpen: number}
     * 
     * AVAILABLE BLENDSHAPES FOR FUTURE IMPLEMENTATION:
     * 
     * MOUTH EXPRESSIONS:
     * - mouthSmileLeft, mouthSmileRight: Smile intensity (currently used)
     * - mouthFrownLeft, mouthFrownRight: Frown/sad expression
     * - mouthPucker: Lips pushed forward (kissing, disgust)
     * - mouthFunnel: Mouth opening with lips funneled inward
     * - mouthLeft, mouthRight: Mouth movement to sides
     * - mouthRollLower, mouthRollUpper: Lip rolling
     * - mouthShrugLower, mouthShrugUpper: Lip shrugging
     * - mouthClose: Mouth closure intensity
     * - mouthDimpleLeft, mouthDimpleRight: Dimple formation
     * - mouthStretchLeft, mouthStretchRight: Mouth stretching
     * - mouthPressLeft, mouthPressRight: Lip pressing
     * - mouthLowerDownLeft, mouthLowerDownRight: Lower lip down movement
     * - mouthUpperUpLeft, mouthUpperUpRight: Upper lip up movement
     * 
     * JAW MOVEMENTS:
     * - jawOpen: Jaw opening (currently used)
     * - jawForward: Jaw thrust forward
     * - jawLeft, jawRight: Lateral jaw movement
     * 
     * EYE EXPRESSIONS:
     * - eyeBlinkLeft, eyeBlinkRight: Eye blinking
     * - eyeSquintLeft, eyeSquintRight: Eye squinting (narrowing)
     * - eyeWideLeft, eyeWideRight: Eyes wide open (surprise, fear)
     * - eyeLookDownLeft, eyeLookDownRight: Eye gaze direction (down)
     * - eyeLookInLeft, eyeLookInRight: Eye gaze direction (inward)
     * - eyeLookOutLeft, eyeLookOutRight: Eye gaze direction (outward)
     * - eyeLookUpLeft, eyeLookUpRight: Eye gaze direction (up)
     * 
     * EYEBROW EXPRESSIONS:
     * - browDownLeft, browDownRight: Brow lowering (anger, concentration)
     * - browInnerUp: Inner brow raise (sadness, concern)
     * - browOuterUpLeft, browOuterUpRight: Outer brow raise (surprise)
     * 
     * CHEEK EXPRESSIONS:
     * - cheekPuff: Cheek puffing (air holding)
     * - cheekSquintLeft, cheekSquintRight: Cheek raising (genuine smile)
     * 
     * NOSE EXPRESSIONS:
     * - noseSneerLeft, noseSneerRight: Nose wrinkling (disgust, anger)
     * 
     * TONGUE:
     * - tongueOut: Tongue protrusion
     * 
     * COMPOSITE REACTION IDEAS FOR FUTURE:
     * - Genuine smile: mouthSmile + cheekSquint
     * - Concentration: browDown + eyeSquint
     * - Surprise: eyeWide + browOuterUp + jawOpen
     * - Disgust: noseSneer + mouthFrown + browDown
     * - Thinking: browInnerUp + mouthPucker
     * - Confusion: browInnerUp + eyeSquint
     */
    const extractFaceReactions = (blendshapes) => {
        if (!blendshapes || blendshapes.length === 0) {
            return { smiling: 0, jawOpen: 0 };
        }
        
        // Helper to get blendshape score
        const getScore = (name) => {
            const blendshape = blendshapes.find(b => b.categoryName === name);
            return blendshape ? blendshape.score : 0;
        };
        
        // CURRENTLY IMPLEMENTED REACTIONS:
        
        // Extract smiling intensity (average of left and right mouth smile)
        const smileLeft = getScore('mouthSmileLeft');
        const smileRight = getScore('mouthSmileRight');
        const smilingIntensity = (smileLeft + smileRight) / 2;
        
        // Extract jaw open intensity
        const jawOpenIntensity = getScore('jawOpen');
        
        // FUTURE IMPLEMENTATION EXAMPLES:
        // const eyeWide = (getScore('eyeWideLeft') + getScore('eyeWideRight')) / 2;
        // const browRaise = (getScore('browOuterUpLeft') + getScore('browOuterUpRight')) / 2;
        // const genuineSmile = smilingIntensity * ((getScore('cheekSquintLeft') + getScore('cheekSquintRight')) / 2);
        // const concentration = (getScore('browDownLeft') + getScore('browDownRight')) / 2;
        // const noseWrinkle = (getScore('noseSneerLeft') + getScore('noseSneerRight')) / 2;
        
        return {
            smiling: Math.round(smilingIntensity * 1000) / 1000,
            jawOpen: Math.round(jawOpenIntensity * 1000) / 1000
        };
    };
    
    //////////////////////////////////// MEDIAPIPE SETUP ////////////////////////////////////
    
    // Load MediaPipe Face Landmarker
    const loadMediaPipe = async () => {
        try {
            // Create FilesetResolver for WASM loading
            // Use specific version for production stability
            const wasmPath = isProduction 
                ? 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
                : 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
            
            const vision = await FilesetResolver.forVisionTasks(wasmPath);
            
            // Create FaceLandmarker instance
            const modelConfig = {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
                    delegate: isProduction ? 'CPU' : 'GPU' // Use CPU for better compatibility in production
                },
                runningMode: 'VIDEO',
                numFaces: 1,
                minFaceDetectionConfidence: 0.3,
                minFacePresenceConfidence: 0.3,
                minTrackingConfidence: 0.3,
                outputFaceBlendshapes: true,  // Enable for face reaction detection
                outputFacialTransformationMatrixes: false
            };
            
            faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, modelConfig);
            
            setIsModelLoaded(true);
        } catch (error) {
            // Fallback for production deployment issues
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
                );
                
                faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
                        delegate: 'CPU' // Fallback to CPU if GPU fails
                    },
                    runningMode: 'VIDEO',
                    numFaces: 1,
                    minFaceDetectionConfidence: 0.3,
                    minFacePresenceConfidence: 0.3,
                    minTrackingConfidence: 0.3,
                    outputFaceBlendshapes: true,  // Enable for face reaction detection
                    outputFacialTransformationMatrixes: false
                });
                
                setIsModelLoaded(true);
            } catch (fallbackError) {
                setModelError(`MediaPipe loading failed: ${fallbackError.message}`);
            }
        }
    };

    //////////////////////////////////// LANDMARK DETECTION ////////////////////////////////////
    
    const handleLandmarkDetection = async () => {
        
        // Immediately clear face visible when starting detection (BEFORE anything else)
        if (!scan) { // About to start detection
            setFaceVisible('false');
            localStorage.setItem('face_visible', 'false');
        }

        // Start or stop scanning (set state immediately for UI update)
        const newScanState = !scan;
        setScan(newScanState);
        
        // Analytics call (non-blocking - don't await)
        try {
            const analyticsData = JSON.stringify(createAuthenticatedRequestBody({
                'request_type': 'analytics',
                'interaction_type': 'user_interaction',
                'element_id': scan ? 'stop_landmark_detection' : 'start_landmark_detection',
                'page_url': window.location.href,
                'session_name': sessionName || getSessionNameFromUrl(),
                'experiment_name': 'facial_landmark_detection_ui',
                'metadata': {
                    'variant': 'control',
                    'is_control': true,
                    'experiment_config': {}
                }
            }, is_demo_session));
            AnalyticsAPI(analyticsData, !is_demo_session); // Don't await - fire and forget
        } catch (error) {
            // Analytics API error
        }

        if (!is_demo_session) {
            const storedToken = localStorage.getItem('idToken');
            if (!storedToken) {
                return;
            }
        }

        if (!isModelLoaded || !faceLandmarkerRef.current || !detectorInitialized) {
            return;
        }
        
        if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }
        
        // Clear localStorage data when stopping detection
        if (scan) { // If currently scanning, we're stopping
            localStorage.removeItem('face_visible');
            localStorage.removeItem('face_position_data_arrays');
            localStorage.removeItem('landmark_nodding_frequency');
            localStorage.removeItem('landmark_nodding_amplitude');
            
            // Clear landmark buffer and reset nodding
            landmarkBuffer.current = [];
            lastNoddingCalculation.current = 0;
            smoothedAmplitude.current = 0;
            latestNoddingFrequency.current = 0;
            latestNoddingAmplitude.current = 0;
            setNoddingFrequency(0);
            setNoddingAmplitude(0);
            
            // Clear face reactions
            setSmilingIntensity(0);
            setJawOpenIntensity(0);
            
            // Clear canvas to remove drawn landmarks
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
            
            // Reset face visibility
            setFaceVisible('false');
            setLandmarkCount(0);
            setFaceConfidence(0);
        }

        if (!scan && mounted) {
            // Initialize WebSocket for upload if enabled
            if (useWebSocketUpload) {
                initializeUploadWebSocket();
            }
            
            try {
                const landmarkArray = [];
                const timeStampArray = [];
                const confidenceArray = [];
                
                // Face position arrays
                const centerXArray = [];
                const centerYArray = [];
                const widthArray = [];
                const heightArray = [];
                
                // Nodding data arrays
                const frequencyArray = [];
                const amplitudeArray = [];
                
                // Face reaction data arrays (from blendshapes)
                const smilingArray = [];
                const jawOpenArray = [];
                
                intervalIdRef.current = setInterval(
                    () => runLandmarkDetection(
                        landmarkArray, 
                        timeStampArray, 
                        confidenceArray,
                        centerXArray,
                        centerYArray,
                        widthArray,
                        heightArray,
                        frequencyArray,
                        amplitudeArray,
                        smilingArray,
                        jawOpenArray
                    ), 
                    scanFrequencyLandmark
                );
            } catch (error) {
                setScan(false);
            }
        } else {
            // Close WebSocket when stopping detection
            if (uploadWebSocketRef.current) {
                try {
                    uploadWebSocketRef.current.disconnect();
                    uploadWebSocketRef.current = null;
                } catch (error) {
                    // Error closing upload WebSocket
                }
            }
            setWsUploadConnected(false);
        }
    };

    // Landmark detection function
    const runLandmarkDetection = async (
        landmarkArray, 
        timeStampArray, 
        confidenceArray,
        centerXArray,
        centerYArray,
        widthArray,
        heightArray,
        frequencyArray,
        amplitudeArray,
        smilingArray,
        jawOpenArray
    ) => {
        
        if (!videoRef.current || !faceLandmarkerRef.current || !detectorInitialized) {
            return;
        }
        
        // Check if video is ready
        if (videoRef.current.readyState < 2) {
            return;
        }
        
        try {
            const currentTime = performance.now();
            
            // Detect face landmarks
            const results = await faceLandmarkerRef.current.detectForVideo(videoRef.current, currentTime);
            
            
            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                const faceLandmarks = results.faceLandmarks[0]; // Get first face
                const confidence = 0.8; // MediaPipe doesn't provide direct confidence, using default
                
                // Extract face reactions from blendshapes
                let faceReactions = { smiling: 0, jawOpen: 0 };
                if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
                    const blendshapes = results.faceBlendshapes[0].categories;
                    faceReactions = extractFaceReactions(blendshapes);
                    
                }
                
                // Compute face bounding box from landmarks
                const videoWidth = videoRef.current.videoWidth || videoRef.current.width || 640;
                const videoHeight = videoRef.current.videoHeight || videoRef.current.height || 480;
                const faceBox = computeFaceBoundingBox(faceLandmarks, videoWidth, videoHeight);
                
                // Store landmark data
                const landmarkData = {
                    timestamp: Date.now(),
                    landmarks: faceLandmarks.map((landmark, index) => ({
                        index: index,
                        x: parseFloat(landmark.x.toFixed(3)),
                        y: parseFloat(landmark.y.toFixed(3)),
                        z: parseFloat((landmark.z || 0).toFixed(3))
                    })),
                    confidence: confidence,
                    facePosition: faceBox // Add computed bounding box
                };

                landmarkArray.push(landmarkData.landmarks);
                timeStampArray.push(landmarkData.timestamp);
                confidenceArray.push(confidence);
                
                // Store face position data in arrays
                if (faceBox) {
                    centerXArray.push(faceBox.position.centerX);
                    centerYArray.push(faceBox.position.centerY);
                    widthArray.push(faceBox.width);
                    heightArray.push(faceBox.height);
                    
                    // Store current nodding values (use refs for immediate values, not async state)
                    frequencyArray.push(latestNoddingFrequency.current);
                    amplitudeArray.push(latestNoddingAmplitude.current);
                    
                    // Store face reaction data
                    smilingArray.push(faceReactions.smiling);
                    jawOpenArray.push(faceReactions.jawOpen);
                    
                    // Upload frame immediately via WebSocket (real-time, throttled to prevent overwhelming server)
                    if (useWebSocketUpload && uploadWebSocketRef.current && uploadWebSocketRef.current.isConnected) {
                        const now = Date.now();
                        const timeSinceLastUpload = now - lastWebSocketUploadTime.current;
                        
                        // Throttle: Only upload if enough time has passed (prevents flooding at 5fps)
                        if (timeSinceLastUpload >= WEBSOCKET_UPLOAD_MIN_INTERVAL) {
                            try {
                                // Convert landmarks to flat array format
                                const flatPoints = [];
                                for (const lm of faceLandmarks) {
                                    if (typeof lm === 'object' && lm.x !== undefined) {
                                        flatPoints.push(parseFloat(lm.x.toFixed(4)));
                                        flatPoints.push(parseFloat(lm.y.toFixed(4)));
                                    } else if (Array.isArray(lm)) {
                                        flatPoints.push(parseFloat(lm[0].toFixed(4)));
                                        flatPoints.push(parseFloat(lm[1].toFixed(4)));
                                    }
                                }
                                
                                const frameData = {
                                    p: flatPoints,  // Flat array [x0,y0,x1,y1,...]
                                    t: landmarkData.timestamp,
                                    sm: faceReactions.smiling || 0.0,
                                    jaw: faceReactions.jawOpen || 0.0,
                                    amp: latestNoddingAmplitude.current || 0.0,
                                    freq: latestNoddingFrequency.current || 0.0
                                };
                                
                                const uploaded = uploadFrameViaWebSocket(frameData);
                                if (uploaded) {
                                    lastWebSocketUploadTime.current = now;
                                    
                                    // Stress test: duplicate frame if enabled
                                    if (window.__stressTestDuplicateFrame) {
                                        window.__stressTestDuplicateFrame(frameData, 'landmark');
                                    }
                                }
                            } catch (error) {
                                // Error uploading frame
                            }
                        } else {
                            // Frame throttled - will upload on next detection cycle if needed
                            // This is fine - we're getting 5 fps, throttling to ~6.7 fps max is still smooth
                        }
                    }
                    
                    // Add to rolling buffer for nodding calculation
                    landmarkBuffer.current.push({
                        timestamp: landmarkData.timestamp,
                        centerX: faceBox.position.centerX,
                        centerY: faceBox.position.centerY,
                        width: faceBox.width,
                        height: faceBox.height,
                        noddingData: {
                            frequency: latestNoddingFrequency.current,
                            amplitude: latestNoddingAmplitude.current
                        }
                    });
                }
                
                // Update UI state
                setFaceVisible('true');
                setLandmarkCount(faceLandmarks.length);
                setFaceConfidence(confidence);
                setLastDetectionTime(landmarkData.timestamp);
                setSmilingIntensity(faceReactions.smiling);
                setJawOpenIntensity(faceReactions.jawOpen);
                
                // Draw landmarks on canvas with current values (not async state)
                drawLandmarks(faceLandmarks, faceReactions.smiling, faceReactions.jawOpen, latestNoddingAmplitude.current);
                
                // Calculate nodding from facial landmarks every scanFrequencyLandmark interval
                const currentTimeMs = Date.now();
                if (currentTimeMs - lastNoddingCalculation.current >= scanFrequencyLandmark) {
                    const windowStart = currentTimeMs - noddingAnalysisWindow;
                    const recentData = landmarkBuffer.current.filter(data => data.timestamp > windowStart);
                    
                    
                    if (recentData.length >= 10) { // Minimum frames required for nodding calculation
                        // Extract position data for nodding calculation
                        const positionData = {
                            timestamps: recentData.map(d => d.timestamp),
                            xPositions: recentData.map(d => d.centerX),
                            yPositions: recentData.map(d => d.centerY),
                            widthPositions: recentData.map(d => d.width),
                            heightPositions: recentData.map(d => d.height)
                        };
                        
                        
                        const noddingResult = NoddingCalculator.calculateNodding(
                            positionData.timestamps,
                            positionData.xPositions,
                            positionData.yPositions,
                            positionData.widthPositions,
                            positionData.heightPositions
                        );
                        
                        
                        // Apply temporal smoothing to amplitude
                        const previousSmoothedAmplitude = smoothedAmplitude.current;
                        smoothedAmplitude.current = smoothedAmplitude.current * (1 - amplitudeSmoothingFactor) + 
                                                     noddingResult.amplitude * amplitudeSmoothingFactor;
                        
                        const finalAmplitude = Math.round(smoothedAmplitude.current * 1000) / 1000;
                                                
                        // Store in refs for immediate access (React state updates are async)
                        latestNoddingFrequency.current = noddingResult.frequency;
                        latestNoddingAmplitude.current = finalAmplitude;
                        
                        // Update React state for UI display
                        setNoddingFrequency(noddingResult.frequency);
                        setNoddingAmplitude(finalAmplitude);
                        
                        lastNoddingCalculation.current = currentTimeMs;
                    }
                    
                    // Clean up old buffer data
                    landmarkBuffer.current = landmarkBuffer.current.filter(data => data.timestamp > windowStart);
                }
                
                // Send data to server and store in localStorage at configured interval
                if (shouldUpload(timeStampArray, landmarkDataUploadInterval)) {
                    // Copy arrays before clearing
                    const tempLandmarks = [...landmarkArray];
                    const tempTimestamps = [...timeStampArray];
                    const tempConfidences = [...confidenceArray];
                    const tempCenterX = [...centerXArray];
                    const tempCenterY = [...centerYArray];
                    const tempWidths = [...widthArray];
                    const tempHeights = [...heightArray];
                    const tempFrequencies = [...frequencyArray];
                    const tempAmplitudes = [...amplitudeArray];
                    const tempSmiling = [...smilingArray];
                    const tempJawOpen = [...jawOpenArray];
                    
                    // Clear all arrays immediately
                    clearArrays(
                        landmarkArray, 
                        timeStampArray, 
                        confidenceArray,
                        centerXArray,
                        centerYArray,
                        widthArray,
                        heightArray,
                        frequencyArray,
                        amplitudeArray,
                        smilingArray,
                        jawOpenArray
                    );
                    
                    // Reorganize post-processed data into ONE array before sending
                    const postProcessedArray = [];
                    for (let i = 0; i < tempTimestamps.length; i++) {
                        postProcessedArray.push({
                            center_x: tempCenterX[i] || 0,
                            center_y: tempCenterY[i] || 0,
                            width: tempWidths[i] || 0,
                            height: tempHeights[i] || 0,
                            frequency: tempFrequencies[i] || 0.0,
                            amplitude: tempAmplitudes[i] || 0.0,
                            smiling: tempSmiling[i] || 0.0,
                            jaw_open: tempJawOpen[i] || 0.0,
                            confidence: tempConfidences[i] || 0.0
                        });
                    }
                    
                    // Note: WebSocket uploads happen immediately (every 200ms) when frames are detected above
                    // HTTP batch upload still happens here for persistence/fallback
                    // WebSocket is already handled in real-time during detection
                    
                    // Store face position arrays in localStorage for other components to access
                    try {
                        // Get existing data to maintain rolling buffer
                        let existingData = null;
                        try {
                            const existingDataStr = localStorage.getItem('face_position_data_arrays');
                            if (existingDataStr) {
                                existingData = JSON.parse(existingDataStr);
                            }
                        } catch (e) {
                            // If parsing fails, start fresh
                            existingData = null;
                        }
                        
                        // Maintain rolling buffer of last 10 seconds of data
                        const now = Date.now();
                        const bufferWindow = DATA_COLLECTION_WINDOW;
                        
                        const facePositionDataArrays = {
                            // Store nodding arrays (not single values!)
                            frequencyArray: tempFrequencies,
                            amplitudeArray: tempAmplitudes,
                            // Store face reaction arrays
                            smilingArray: tempSmiling,
                            jawOpenArray: tempJawOpen,
                            landmarks: tempLandmarks,
                            timestamps: tempTimestamps,
                            confidences: tempConfidences,
                            centerXPositions: tempCenterX,
                            centerYPositions: tempCenterY,
                            widthPositions: tempWidths,
                            heightPositions: tempHeights,
                            lastUpdated: now,
                            // Store latest values for UI display (using refs for immediate values)
                            landmarkCount: tempLandmarks.length > 0 ? tempLandmarks[tempLandmarks.length - 1].length : 0,
                            faceConfidence: tempConfidences.length > 0 ? tempConfidences[tempConfidences.length - 1] : 0,
                            noddingFrequency: latestNoddingFrequency.current,
                            noddingAmplitude: latestNoddingAmplitude.current,
                            smilingIntensity: tempSmiling.length > 0 ? tempSmiling[tempSmiling.length - 1] : 0,
                            jawOpenIntensity: tempJawOpen.length > 0 ? tempJawOpen[tempJawOpen.length - 1] : 0
                        };
                        
                        // If we have existing data, merge it with new data (rolling buffer)
                        if (existingData && existingData.timestamps) {
                            // Filter existing data to keep only recent data
                            const recentExistingData = existingData.timestamps
                                .map((timestamp, index) => ({ timestamp, index }))
                                .filter(item => (now - item.timestamp) <= bufferWindow)
                                .map(item => item.index);
                            
                            // Merge arrays, keeping recent data from existing and adding new data
                            facePositionDataArrays.frequencyArray = [
                                ...recentExistingData.map(i => existingData.frequencyArray[i]).filter(v => v !== undefined),
                                ...tempFrequencies
                            ];
                            facePositionDataArrays.amplitudeArray = [
                                ...recentExistingData.map(i => existingData.amplitudeArray[i]).filter(v => v !== undefined),
                                ...tempAmplitudes
                            ];
                            facePositionDataArrays.smilingArray = [
                                ...recentExistingData.map(i => existingData.smilingArray[i]).filter(v => v !== undefined),
                                ...tempSmiling
                            ];
                            facePositionDataArrays.jawOpenArray = [
                                ...recentExistingData.map(i => existingData.jawOpenArray[i]).filter(v => v !== undefined),
                                ...tempJawOpen
                            ];
                            facePositionDataArrays.timestamps = [
                                ...recentExistingData.map(i => existingData.timestamps[i]).filter(v => v !== undefined),
                                ...tempTimestamps
                            ];
                            facePositionDataArrays.centerXPositions = [
                                ...recentExistingData.map(i => existingData.centerXPositions[i]).filter(v => v !== undefined),
                                ...tempCenterX
                            ];
                            facePositionDataArrays.centerYPositions = [
                                ...recentExistingData.map(i => existingData.centerYPositions[i]).filter(v => v !== undefined),
                                ...tempCenterY
                            ];
                            facePositionDataArrays.widthPositions = [
                                ...recentExistingData.map(i => existingData.widthPositions[i]).filter(v => v !== undefined),
                                ...tempWidths
                            ];
                            facePositionDataArrays.heightPositions = [
                                ...recentExistingData.map(i => existingData.heightPositions[i]).filter(v => v !== undefined),
                                ...tempHeights
                            ];
                        }
                        
                        localStorage.setItem('face_position_data_arrays', JSON.stringify(facePositionDataArrays));
                    } catch (storageError) {
                        // Failed to store face position arrays in localStorage
                    }
                    
                    // Double check arrays are empty
                    if (timeStampArray.length > 0) {
                        clearArrays(
                            landmarkArray, 
                            timeStampArray, 
                            confidenceArray,
                            centerXArray,
                            centerYArray,
                            widthArray,
                            heightArray,
                            frequencyArray,
                            amplitudeArray,
                            smilingArray,
                            jawOpenArray
                        );
                    }
                }
                
                // Update face_visible for real-time UI feedback
                localStorage.setItem('face_visible', 'true');
            } else {
                
                setFaceVisible('false');
                setLandmarkCount(0);
                setFaceConfidence(0);
                setNoddingFrequency(0);
                setNoddingAmplitude(0);
                setSmilingIntensity(0);
                setJawOpenIntensity(0);
                
                // Clear nodding refs
                latestNoddingFrequency.current = 0;
                latestNoddingAmplitude.current = 0;
                
                // Update face_visible for real-time UI feedback
                localStorage.setItem('face_visible', 'false');
                
                // Clear face position arrays and nodding data when no face detected
                localStorage.removeItem('face_position_data_arrays');
                localStorage.removeItem('landmark_nodding_frequency');
                localStorage.removeItem('landmark_nodding_amplitude');
                
                // Clear canvas
                if (canvasRef.current) {
                    const ctx = canvasRef.current.getContext('2d');
                    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                }
            }
        } catch (error) {
            // Landmark detection error
        }
    };



    // Draw landmarks on canvas using shared renderer
    const drawLandmarks = (landmarks, currentSmiling, currentJawOpen, currentNoddingAmplitude) => {
        if (!canvasRef.current || !videoRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const video = videoRef.current;
        
        // Set canvas size to match video dimensions exactly
        canvas.width = video.videoWidth || video.width || 640;
        canvas.height = video.videoHeight || video.height || 480;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // DEBUG: Draw frame boundaries
        ctx.strokeStyle = 'lime';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        
        // Create frame data object for shared renderer
        const frameData = {
            amplitude: currentNoddingAmplitude,
            smiling: currentSmiling,
            jaw_open: currentJawOpen
        };
        
        // Use shared renderer function
        // Use larger line width multiplier for better visibility in FacialLandmarkUserUI
        const lineWidthMultiplier = sizeMode === 'large' ? 3.5 : 2.5;
        drawLandmarksOnCanvas(ctx, landmarks, frameData, canvas.width, canvas.height, lineWidthMultiplier);
    };

    //////////////////////////////////// EFFECTS ////////////////////////////////////
    
    // Initialize WebSocket for upload when scanning starts
    const initializeUploadWebSocket = () => {
        if (!useWebSocketUpload || !sessionName) return;
        
        // Prevent duplicate initialization if already connected or connecting
        if (uploadWebSocketRef.current && uploadWebSocketRef.current.isConnected) {
            return;
        }
        
        if (isUploadConnectingRef.current) {
            return;
        }
        
        // Get username from token or demo session
        let username = null;
        if (is_demo_session && demo_username) {
            username = demo_username;
        } else {
            try {
                const token = localStorage.getItem('idToken');
                if (token) {
                    // Extract username from token (JWT decode)
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    username = payload['cognito:username'] || payload.sub || payload.username;
                }
            } catch (e) {
                // Could not extract username from token
            }
        }
        
        if (!username) {
            return;
        }
        
        // Cleanup existing connection first
        if (uploadWebSocketRef.current) {
            try {
                uploadWebSocketRef.current.disconnect();
            } catch (error) {
                // Error disconnecting existing upload WebSocket
            }
            uploadWebSocketRef.current = null;
        }
        
        // Use LandmarkWebSocket hook for upload mode
        try {
            const ws = new LandmarkWebSocket(sessionName, {
                mode: 'upload',
                username: username,
                onConnect: (data) => {
                    // Use setTimeout to ensure state update happens after WebSocket state is set
                    setTimeout(() => {
                        setWsUploadConnected(true);
                    }, 0);
                },
                onUploadConfirmation: (data) => {
                    // Frame upload confirmed - optionally track success
                },
                onError: (error) => {
                    setWsUploadConnected(false);
                },
                onDisconnect: () => {
                    setWsUploadConnected(false);
                    // Attempt reconnect if still scanning
                    if (scan) {
                        setTimeout(() => initializeUploadWebSocket(), 3000);
                    }
                },
                usePollingFallback: false // No polling fallback for uploads
            });
            
            uploadWebSocketRef.current = ws;
        } catch (error) {
            setWsUploadConnected(false);
        }
    };
    
    // Upload frame via WebSocket
    const uploadFrameViaWebSocket = (frameData) => {
        if (!uploadWebSocketRef.current) {
            return false;
        }
        
        if (!uploadWebSocketRef.current.isConnected) {
            return false;
        }
        
        const result = uploadWebSocketRef.current.uploadFrame(frameData);
        return result;
    };

    // Component mount effect (guard against StrictMode double-invocation)
    const hasLoadedMediaPipe = useRef(false);
    useEffect(() => {
        setMounted(true);
        
        // Only load MediaPipe once, even in StrictMode
        if (!hasLoadedMediaPipe.current) {
            hasLoadedMediaPipe.current = true;
        loadMediaPipe();
        }
        
        return () => {
            setMounted(false);
            
            // Clear intervals
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
            
            // Close WebSocket upload connection
            if (uploadWebSocketRef.current) {
                try {
                    uploadWebSocketRef.current.disconnect();
                    uploadWebSocketRef.current = null;
                } catch (error) {
                    // Error closing upload WebSocket
                }
            }
            setWsUploadConnected(false);
            isUploadConnectingRef.current = false;
            
            // Dispose MediaPipe model to prevent memory leaks
            if (faceLandmarkerRef.current) {
                try {
                    faceLandmarkerRef.current.close();
                    faceLandmarkerRef.current = null;
                    hasLoadedMediaPipe.current = false; // Reset on cleanup
                } catch (error) {
                    // Error disposing MediaPipe model
                }
            }
            
            // Clear canvas
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
            
            // Clear localStorage data
            localStorage.removeItem('face_visible');
            localStorage.removeItem('face_position_data_arrays');
            localStorage.removeItem('landmark_nodding_frequency');
            localStorage.removeItem('landmark_nodding_amplitude');
            
            // Clear landmark buffer
            landmarkBuffer.current = [];
            lastNoddingCalculation.current = 0;
            smoothedAmplitude.current = 0;
            latestNoddingFrequency.current = 0;
            latestNoddingAmplitude.current = 0;
            
            setScan(false);
        };
    }, []);

    // Initialize detector when model is loaded and video is ready
    useEffect(() => {
        
        if (isModelLoaded && !detectorInitialized && videoRef.current) {
            try {
                if (videoRef.current.readyState === 4) {
                    setDetectorInitialized(true);
                } else {
                    const handleLoadedData = () => {
                        setDetectorInitialized(true);
                    };
                    videoRef.current.addEventListener('loadeddata', handleLoadedData);
                    
                    // Cleanup listener
                    return () => {
                        if (videoRef.current) {
                            videoRef.current.removeEventListener('loadeddata', handleLoadedData);
                        }
                    };
                }
            } catch (error) {
                setModelError(error.message);
            }
        }
    }, [isModelLoaded, detectorInitialized, stream]);

    // Status checking effect - reads face_visible from localStorage
    // (Other values are updated directly via React state during detection)
    useEffect(() => {
        const checkLandmarkStatus = () => {
            try {
                // Read face_visible directly (updated every frame for real-time feedback)
                setFaceVisible(localStorage.getItem('face_visible') || 'false');
            } catch (error) {
                // Error reading face_visible
            }
        };

        const statusInterval = setInterval(checkLandmarkStatus, 250);
        return () => clearInterval(statusInterval);
    }, []);


    //////////////////////////////////// RENDER ////////////////////////////////////

    return (
        <div style={{ width: '100%', marginBottom: '1rem', display: 'block' }}>
            <div 
                className={`${embeddingTW ? "twitch-embed-page" : ""}`}
                style={{
                    backgroundColor: '#000',
                    padding: window.innerWidth < 768 ? '0.5rem' : '1rem',
                    paddingBottom: embeddingTW 
                        ? `max(0.5rem, calc(0.5rem + var(--safe-area-bottom) + 8px))` 
                        : `max(0.5rem, calc(0.5rem + var(--safe-area-bottom)))`,
                    borderRadius: '0.5rem',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    ...(embeddingTW && {
                        isolation: 'isolate',
                        contain: 'layout style',
                        willChange: 'transform'
                    })
                }}
            >
                            <div className="d-flex flex-column align-items-center gap-2">
                                {/* Start detection button and text */}
                                <div className="d-flex align-items-center justify-content-center gap-2">
                                    <PlayPauseButton
                                        onClick={handleLandmarkDetection}
                                        isPlaying={scan}
                                        size={window.innerWidth < 768 ? '3.2rem' : '4rem'}
                                        isEnabled={isModelLoaded && detectorInitialized && !modelError && (localStorage.getItem('idToken') || is_demo_session)}
                                        style={{
                                            width: window.innerWidth < 768 ? '3.2rem' : '4rem',
                                            height: window.innerWidth < 768 ? '3.2rem' : '4rem'
                                        }}
                                    />
                                    {scan && (
                                        <div style={{
                                            width: window.innerWidth < 768 ? '1rem' : '1.2rem',
                                            height: window.innerWidth < 768 ? '1rem' : '1.2rem',
                                            borderRadius: '50%',
                                            border: '0.2rem solid white',
                                            backgroundColor: faceVisible === 'true' ? '#4CAF50' : '#FF0000'
                                        }} />
                                    )}
                                    {!scan ? (
                                        <p style={{ 
                                            textAlign: 'left', 
                                            margin: 0, 
                                            fontSize: window.innerWidth < 768 ? '0.8rem' : '1rem',
                                            lineHeight: '1.2',
                                            color: 'white'
                                        }}>
                                            {modelError ? 'Model Error' : 
                                             !isModelLoaded ? 'Loading model...' :
                                             !detectorInitialized ? 'Loading video...' :
                                             !is_demo_session && !localStorage.getItem('idToken') 
                                                ? 'Login needed'
                                                : 'Start detection'}
                                        </p>
                                    ) : (
                                        <p style={{ 
                                            textAlign: 'left', 
                                            margin: 0, 
                                            fontSize: window.innerWidth < 768 ? '0.8rem' : '1rem',
                                            lineHeight: '1.2',
                                            color: 'white'
                                        }}>
                                            {faceVisible === 'true' ? 'Detecting' : 'Searching...'}
                                        </p>
                                    )}
                                </div>

                                {/* Webcam container */}
                                <div className="d-flex justify-content-center">
                                    {/* Hidden camera for landmark detection */}
                                    <OrientedCamera 
                                        stream={stream}
                                        onVideoRef={(videoElement) => {
                                            videoRef.current = videoElement;
                                            }}
                                        style={{ 
                                            position: 'absolute',
                                            width: cameraSize,
                                            height: cameraSize,
                                            opacity: 0, // Hide the camera image
                                            pointerEvents: 'none'
                                        }}
                                        objectPosition={window.innerWidth < 768 ? 'center 85%' : 'center'}
                                    />
                                    
                                    {/* Canvas for landmarks with white frame */}
                                    <div style={{
                                        position: 'relative',
                                        width: cameraSize,
                                        height: cameraSize,
                                        border: '2px solid white',
                                        borderRadius: '8px',
                                        backgroundColor: 'transparent',
                                        overflow: 'hidden'
                                    }}>
                                        <canvas
                                            ref={canvasRef}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                transform: 'rotateY(180deg)',
                                                WebkitTransform: 'rotateY(180deg)',
                                                pointerEvents: 'none',
                                                objectFit: 'cover'
                                            }}
                                        />
                                    </div>
                                </div>
                                    
                                {/* Nodding indicator with BPM */}
                                <div className="d-flex align-items-center justify-content-center">
                                    <p style={{ 
                                        margin: 0, 
                                        fontSize: window.innerWidth < 768 ? '0.7rem' : '0.9rem',
                                        color: 'white',
                                        fontFamily: 'monospace'
                                    }}>
                                        {(() => {
                                            const bpm = scan && faceVisible === 'true' && noddingAmplitude > thresholdForVisualizationOfNodding 
                                                ? Math.round(noddingFrequency * 60).toString().padStart(3, '0')
                                                : '000';
                                            return `Nodding ${bpm} bpm`;
                                        })()}
                                    </p>
                                </div>
                                </div>
            </div>
        </div>
    );
};

export default FacialLandmarkUserUI;
