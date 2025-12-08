import React, { useEffect, useState, useRef } from 'react';
import { Row, Col, Button } from 'react-bootstrap';
import AnalyticsAPI from '../../utils/AnalyticsAPI.jsx';
import { scanFrequencyPose, noddingAnalysisWindow, secondaryColor } from '../../utils/DisplaySettings';
import { getSessionNameFromUrl } from '../../hooks/sessionUtils';
import { createAuthenticatedRequestBody } from '../../hooks/sessionUtils';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import BodyPoseDrawing from '../animations/BodyPoseDrawing';
import OrientedCamera from '../OrientedCamera';
import { uploadDetectionData, shouldUpload, clearArrays } from './detectionUploader';
import PlayPauseButton from '../../utils/PlayPauseButton.jsx';
import LandmarkWebSocket from '../../hooks/LandmarkWebSocket';
import HandRaiseCalculator from './HandRaiseCalculator';

// Environment detection for production optimization
const isProduction = process.env.NODE_ENV === 'production';

const BodyPoseUserUI = ({ 
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
    const poseLandmarkerRef = useRef(null);
    const [scan, setScan] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [modelError, setModelError] = useState(null);
    const [detectorInitialized, setDetectorInitialized] = useState(false);
    
    // Pose state
    const [poseVisible, setPoseVisible] = useState(localStorage.getItem('pose_visible') || 'false');
    const [landmarkCount, setLandmarkCount] = useState(0);
    const [poseConfidence, setPoseConfidence] = useState(0);
    const [lastDetectionTime, setLastDetectionTime] = useState(0);
    const detectionInProgressRef = useRef(false);
    
    // Hand raising state (calculated from pose landmarks)
    const [leftHandRaiseFrequency, setLeftHandRaiseFrequency] = useState(0);
    const [leftHandRaiseAmplitude, setLeftHandRaiseAmplitude] = useState(0);
    const [leftHandRaised, setLeftHandRaised] = useState(false);
    const [rightHandRaiseFrequency, setRightHandRaiseFrequency] = useState(0);
    const [rightHandRaiseAmplitude, setRightHandRaiseAmplitude] = useState(0);
    const [rightHandRaised, setRightHandRaised] = useState(false);
    
    // Rolling buffer for hand raising detection
    const handRaiseBuffer = useRef([]);
    const lastHandRaiseCalculation = useRef(0);
    
    // Track latest hand raising values for immediate localStorage access (React state is async)
    const latestLeftHandRaiseFrequency = useRef(0);
    const latestLeftHandRaiseAmplitude = useRef(0);
    const latestLeftHandRaised = useRef(false);
    const latestRightHandRaiseFrequency = useRef(0);
    const latestRightHandRaiseAmplitude = useRef(0);
    const latestRightHandRaised = useRef(false);
    
    // WebSocket for real-time pose upload
    const uploadWebSocketRef = useRef(null);
    const isUploadConnectingRef = useRef(false);
    const useWebSocketUpload = true; // Feature flag
    const [wsUploadConnected, setWsUploadConnected] = useState(false);
    
    // Throttle WebSocket uploads
    const lastWebSocketUploadTime = useRef(0);
    const WEBSOCKET_UPLOAD_MIN_INTERVAL = 150; // Minimum 150ms between uploads

    // Camera size based on mode (default is 80px×80px portrait or 80px×80px landscape)
    const cameraSize = sizeMode === 'large' ? '160px' : '80px';

    //////////////////////////////////// MEDIAPIPE SETUP ////////////////////////////////////
    
    // Load MediaPipe Pose Landmarker
    const loadMediaPipe = async () => {
        try {
            // Create FilesetResolver for WASM loading
            const wasmPath = isProduction 
                ? 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
                : 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
            
            const vision = await FilesetResolver.forVisionTasks(wasmPath);
            
            // Create PoseLandmarker instance - using lighter model for better performance
            const modelConfig = {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                    delegate: 'CPU' // Always use CPU for better compatibility
                },
                runningMode: 'VIDEO',
                numPoses: 1,
                minPoseDetectionConfidence: 0.3,
                minPosePresenceConfidence: 0.3,
                minTrackingConfidence: 0.3
            };
            
            poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, modelConfig);
            
            setIsModelLoaded(true);
        } catch (error) {
            // Fallback for production deployment issues
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
                );
                
                poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                        delegate: 'CPU'
                    },
                    runningMode: 'VIDEO',
                    numPoses: 1,
                    minPoseDetectionConfidence: 0.3,
                    minPosePresenceConfidence: 0.3,
                    minTrackingConfidence: 0.3
                });
                
                setIsModelLoaded(true);
            } catch (fallbackError) {
                setModelError(`MediaPipe Pose loading failed: ${fallbackError.message}`);
            }
        }
    };

    //////////////////////////////////// POSE DETECTION ////////////////////////////////////
    
    const handlePoseDetection = async () => {
        // Analytics: mirror FacialLandmarkUserUI convention
        try {
            const analyticsData = JSON.stringify(createAuthenticatedRequestBody({
                'request_type': 'analytics',
                'interaction_type': 'user_interaction',
                'element_id': scan ? 'stop_pose_detection' : 'start_pose_detection',
                'page_url': window.location.href,
                'session_name': sessionName || getSessionNameFromUrl(),
                'experiment_name': 'body_pose_detection_ui',
                'metadata': {
                    'variant': 'control',
                    'is_control': true,
                    'experiment_config': {}
                }
            }, is_demo_session));
            AnalyticsAPI(analyticsData, !is_demo_session); // fire-and-forget
        } catch (error) {
            // Analytics API error
        }

        if (!is_demo_session) {
            const storedToken = localStorage.getItem('idToken');
            if (!storedToken) {
                return;
            }
        }

        if (!isModelLoaded || !poseLandmarkerRef.current || !detectorInitialized) {
            return;
        }

        
        // Start or stop scanning
        const newScanState = !scan;
        setScan(newScanState);
        
        if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }

        // Clean up pose-related data when stopping detection
        if (scan) { // If currently scanning, we're stopping
            // Clear pose states
            setPoseVisible('false');
            setLandmarkCount(0);
            setPoseConfidence(0);
            
            // Clear hand raising states
            setLeftHandRaiseFrequency(0);
            setLeftHandRaiseAmplitude(0);
            setLeftHandRaised(false);
            setRightHandRaiseFrequency(0);
            setRightHandRaiseAmplitude(0);
            setRightHandRaised(false);
            
            // Clear hand raising buffer
            handRaiseBuffer.current = [];
            lastHandRaiseCalculation.current = 0;
            latestLeftHandRaiseFrequency.current = 0;
            latestLeftHandRaiseAmplitude.current = 0;
            latestLeftHandRaised.current = false;
            latestRightHandRaiseFrequency.current = 0;
            latestRightHandRaiseAmplitude.current = 0;
            latestRightHandRaised.current = false;
            
            // Clear localStorage pose data
            localStorage.removeItem('pose_visible');
            localStorage.removeItem('landmark_count');
            localStorage.removeItem('pose_confidence');
            localStorage.removeItem('left_hand_raise_frequency');
            localStorage.removeItem('left_hand_raise_amplitude');
            localStorage.removeItem('left_hand_raised');
            localStorage.removeItem('right_hand_raise_frequency');
            localStorage.removeItem('right_hand_raise_amplitude');
            localStorage.removeItem('right_hand_raised');
            
            // Clear canvas
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }

        if (!scan && mounted) {
            // Initialize WebSocket for upload if enabled
            if (useWebSocketUpload) {
                initializeUploadWebSocket();
            }
            
            try {
                const poseArray = [];
                const timeStampArray = [];
                const confidenceArray = [];
                
                intervalIdRef.current = setInterval(
                    () => runPoseDetection(poseArray, timeStampArray, confidenceArray), 
                    scanFrequencyPose
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

    // Pose detection function
    const runPoseDetection = async (poseArray, timeStampArray, confidenceArray) => {
        // Skip if detection is already in progress (prevents overlapping async calls)
        if (detectionInProgressRef.current) {
            return;
        }
        
        if (!videoRef.current || !poseLandmarkerRef.current || !detectorInitialized) {
            return;
        }
        
        // Check if video is ready
        if (videoRef.current.readyState < 2) {
            return;
        }
        
        try {
            detectionInProgressRef.current = true;
            const currentTime = performance.now();
            
            // Detect pose landmarks
            const results = await poseLandmarkerRef.current.detectForVideo(videoRef.current, currentTime);
            
            if (results.landmarks && results.landmarks.length > 0) {
                const poseLandmarks = results.landmarks[0]; // Get first pose
                const confidence = results.worldLandmarks ? 0.8 : 0.6; // Use world landmarks confidence if available
                
                // MediaPipe Pose landmark indices:
                // 11: Left shoulder, 12: Right shoulder
                // 15: Left wrist, 16: Right wrist
                const leftShoulder = poseLandmarks[11];
                const rightShoulder = poseLandmarks[12];
                const leftWrist = poseLandmarks[15];
                const rightWrist = poseLandmarks[16];
                
                // Store pose data
                const poseData = {
                    timestamp: Date.now(),
                    landmarks: poseLandmarks.map((landmark, index) => ({
                        index: index,
                        x: landmark.x,
                        y: landmark.y,
                        z: landmark.z || 0,
                        visibility: landmark.visibility || 1.0
                    })),
                    confidence: confidence
                };

                poseArray.push(poseData.landmarks);
                timeStampArray.push(poseData.timestamp);
                confidenceArray.push(confidence);
                
                // Update UI state
                setPoseVisible('true');
                setLandmarkCount(poseLandmarks.length);
                setPoseConfidence(confidence);
                setLastDetectionTime(poseData.timestamp);
                
                // Draw pose landmarks on canvas
                drawPoseLandmarks(poseLandmarks);
                
                // Add to rolling buffer for hand raising calculation
                if (leftShoulder && leftWrist && rightShoulder && rightWrist) {
                    handRaiseBuffer.current.push({
                        timestamp: poseData.timestamp,
                        leftWristY: leftWrist.y,
                        leftShoulderY: leftShoulder.y,
                        rightWristY: rightWrist.y,
                        rightShoulderY: rightShoulder.y,
                        handRaiseData: {
                            leftFrequency: latestLeftHandRaiseFrequency.current,
                            leftAmplitude: latestLeftHandRaiseAmplitude.current,
                            leftRaised: latestLeftHandRaised.current,
                            rightFrequency: latestRightHandRaiseFrequency.current,
                            rightAmplitude: latestRightHandRaiseAmplitude.current,
                            rightRaised: latestRightHandRaised.current
                        }
                    });
                }
                
                // Calculate hand raising from pose landmarks every scanFrequencyPose interval
                const currentTimeMs = Date.now();
                if (currentTimeMs - lastHandRaiseCalculation.current >= scanFrequencyPose) {
                    const windowStart = currentTimeMs - noddingAnalysisWindow;
                    const recentData = handRaiseBuffer.current.filter(data => data.timestamp > windowStart);
                    
                    if (recentData.length >= 10) { // Minimum frames required for hand raising calculation
                        // Calculate left hand raising
                        if (recentData.every(d => d.leftWristY !== undefined && d.leftShoulderY !== undefined)) {
                            const leftPositionData = {
                                timestamps: recentData.map(d => d.timestamp),
                                wristYPositions: recentData.map(d => d.leftWristY),
                                shoulderYPositions: recentData.map(d => d.leftShoulderY)
                            };
                            
                            const leftHandRaiseResult = HandRaiseCalculator.calculateHandRaise(
                                leftPositionData.timestamps,
                                leftPositionData.wristYPositions,
                                leftPositionData.shoulderYPositions,
                                latestLeftHandRaised.current // Pass previous state for hysteresis
                            );
                            
                            // Store in refs for immediate access (React state updates are async)
                            latestLeftHandRaiseFrequency.current = leftHandRaiseResult.frequency;
                            latestLeftHandRaiseAmplitude.current = leftHandRaiseResult.amplitude;
                            latestLeftHandRaised.current = leftHandRaiseResult.isRaised;
                            
                            // Update React state for UI display
                            setLeftHandRaiseFrequency(leftHandRaiseResult.frequency);
                            setLeftHandRaiseAmplitude(leftHandRaiseResult.amplitude);
                            setLeftHandRaised(leftHandRaiseResult.isRaised);
                        }
                        
                        // Calculate right hand raising
                        if (recentData.every(d => d.rightWristY !== undefined && d.rightShoulderY !== undefined)) {
                            const rightPositionData = {
                                timestamps: recentData.map(d => d.timestamp),
                                wristYPositions: recentData.map(d => d.rightWristY),
                                shoulderYPositions: recentData.map(d => d.rightShoulderY)
                            };
                            
                            const rightHandRaiseResult = HandRaiseCalculator.calculateHandRaise(
                                rightPositionData.timestamps,
                                rightPositionData.wristYPositions,
                                rightPositionData.shoulderYPositions,
                                latestRightHandRaised.current // Pass previous state for hysteresis
                            );
                            
                            // Store in refs for immediate access (React state updates are async)
                            latestRightHandRaiseFrequency.current = rightHandRaiseResult.frequency;
                            latestRightHandRaiseAmplitude.current = rightHandRaiseResult.amplitude;
                            latestRightHandRaised.current = rightHandRaiseResult.isRaised;
                            
                            // Update React state for UI display
                            setRightHandRaiseFrequency(rightHandRaiseResult.frequency);
                            setRightHandRaiseAmplitude(rightHandRaiseResult.amplitude);
                            setRightHandRaised(rightHandRaiseResult.isRaised);
                        }
                        
                        lastHandRaiseCalculation.current = currentTimeMs;
                    }
                    
                    // Clean up old buffer data
                    handRaiseBuffer.current = handRaiseBuffer.current.filter(data => data.timestamp > windowStart);
                }
                
                // Upload frame immediately via WebSocket (real-time, throttled)
                if (useWebSocketUpload && uploadWebSocketRef.current && uploadWebSocketRef.current.isConnected) {
                    const now = Date.now();
                    const timeSinceLastUpload = now - lastWebSocketUploadTime.current;
                    
                    if (timeSinceLastUpload >= WEBSOCKET_UPLOAD_MIN_INTERVAL) {
                        try {
                            // Convert pose landmarks to flat array format
                            const flatPoints = [];
                            for (const lm of poseLandmarks) {
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
                                t: poseData.timestamp,
                                confidence: confidence || 0.0,
                                // Hand raising data (similar to nodding in FacialLandmarkUserUI)
                                leftHandRaiseFreq: latestLeftHandRaiseFrequency.current || 0.0,
                                leftHandRaiseAmp: latestLeftHandRaiseAmplitude.current || 0.0,
                                leftHandRaised: latestLeftHandRaised.current ? 1.0 : 0.0,
                                rightHandRaiseFreq: latestRightHandRaiseFrequency.current || 0.0,
                                rightHandRaiseAmp: latestRightHandRaiseAmplitude.current || 0.0,
                                rightHandRaised: latestRightHandRaised.current ? 1.0 : 0.0
                            };
                            
                            const uploaded = uploadFrameViaWebSocket(frameData);
                            if (uploaded) {
                                lastWebSocketUploadTime.current = now;
                                
                                // Stress test: duplicate frame if enabled
                                if (window.__stressTestDuplicateFrame) {
                                    window.__stressTestDuplicateFrame(frameData, 'pose');
                                }
                            }
                        } catch (error) {
                            // Error uploading frame
                        }
                    }
                }
                
                // Send data to server more frequently for body pose (800ms vs 1000ms for landmarks)
                // This compensates for slower detection rate and ensures continuous data flow
                if (shouldUpload(timeStampArray, 800)) {
                    // Copy arrays before clearing
                    const tempPoses = [...poseArray];
                    const tempTimestamps = [...timeStampArray];
                    const tempConfidences = [...confidenceArray];
                    
                    // Clear all arrays immediately
                    clearArrays(poseArray, timeStampArray, confidenceArray);
                    
                    // Upload data using common uploader
                    await uploadDetectionData({
                        dataArray: tempPoses,
                        timestampArray: tempTimestamps,
                        confidenceArray: tempConfidences,
                        dataType: 'pose',
                        is_demo_session,
                        demo_username,
                        sessionName
                    });
                    
                    // Double check arrays are empty
                    if (timeStampArray.length > 0) {
                        clearArrays(poseArray, timeStampArray, confidenceArray);
                    }
                }
                
                // Store in localStorage
                localStorage.setItem('pose_visible', 'true');
                localStorage.setItem('landmark_count', poseLandmarks.length.toString());
                localStorage.setItem('pose_confidence', confidence.toString());
                localStorage.setItem('left_hand_raise_frequency', latestLeftHandRaiseFrequency.current.toString());
                localStorage.setItem('left_hand_raise_amplitude', latestLeftHandRaiseAmplitude.current.toString());
                localStorage.setItem('left_hand_raised', latestLeftHandRaised.current ? 'true' : 'false');
                localStorage.setItem('right_hand_raise_frequency', latestRightHandRaiseFrequency.current.toString());
                localStorage.setItem('right_hand_raise_amplitude', latestRightHandRaiseAmplitude.current.toString());
                localStorage.setItem('right_hand_raised', latestRightHandRaised.current ? 'true' : 'false');
            } else {
                setPoseVisible('false');
                setLandmarkCount(0);
                setPoseConfidence(0);
                setLeftHandRaiseFrequency(0);
                setLeftHandRaiseAmplitude(0);
                setLeftHandRaised(false);
                setRightHandRaiseFrequency(0);
                setRightHandRaiseAmplitude(0);
                setRightHandRaised(false);
                
                // Clear hand raising refs
                latestLeftHandRaiseFrequency.current = 0;
                latestLeftHandRaiseAmplitude.current = 0;
                latestLeftHandRaised.current = false;
                latestRightHandRaiseFrequency.current = 0;
                latestRightHandRaiseAmplitude.current = 0;
                latestRightHandRaised.current = false;
                
                localStorage.setItem('pose_visible', 'false');
                localStorage.setItem('landmark_count', '0');
                localStorage.setItem('pose_confidence', '0');
                localStorage.setItem('left_hand_raise_frequency', '0');
                localStorage.setItem('left_hand_raise_amplitude', '0');
                localStorage.setItem('left_hand_raised', 'false');
                localStorage.setItem('right_hand_raise_frequency', '0');
                localStorage.setItem('right_hand_raise_amplitude', '0');
                localStorage.setItem('right_hand_raised', 'false');
                
                // Clear canvas
                if (canvasRef.current) {
                    const ctx = canvasRef.current.getContext('2d');
                    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                }
            }
        } catch (error) {
            // Pose detection error
        } finally {
            // Always reset the detection lock
            detectionInProgressRef.current = false;
        }
    };

    // Draw pose landmarks on canvas using BodyPoseDrawing component
    const drawPoseLandmarks = (landmarks) => {
        if (!canvasRef.current || !videoRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const video = videoRef.current;
        
        // Get video dimensions
        const videoWidth = video.videoWidth || video.clientWidth || 640;
        const videoHeight = video.videoHeight || video.clientHeight || 480;
        
        // Set canvas size to match video dimensions exactly
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Use the BodyPoseDrawing component to draw all pose landmarks
        BodyPoseDrawing.drawAllPoseLandmarks(
            ctx, 
            landmarks, 
            canvas.width,   // scaleX
            canvas.height,  // scaleY
            0,              // offsetX
            0,              // offsetY
            1,              // lineWidthMultiplier for better visibility
            0.3,            // minVisibility threshold
            secondaryColor, // secondary color
            latestLeftHandRaised.current,  // leftHandRaised
            latestRightHandRaised.current // rightHandRaised
        );
    };

    //////////////////////////////////// EFFECTS ////////////////////////////////////
    
    // Initialize WebSocket for pose upload
    const initializeUploadWebSocket = () => {
        if (!useWebSocketUpload || !sessionName) return;
        
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
        
        if (uploadWebSocketRef.current) {
            try {
                uploadWebSocketRef.current.disconnect();
            } catch (error) {
                // Error disconnecting existing upload WebSocket
            }
            uploadWebSocketRef.current = null;
        }
        
        isUploadConnectingRef.current = true;
        try {
            const ws = new LandmarkWebSocket(sessionName, {
                mode: 'upload',
                username: username,
                onConnect: (data) => {
                    setTimeout(() => {
                        setWsUploadConnected(true);
                    }, 0);
                    isUploadConnectingRef.current = false;
                },
                onUploadConfirmation: (data) => {
                    // Frame upload confirmed
                },
                onError: (error) => {
                    setWsUploadConnected(false);
                    isUploadConnectingRef.current = false;
                },
                onDisconnect: () => {
                    setWsUploadConnected(false);
                    isUploadConnectingRef.current = false;
                    if (scan) {
                        setTimeout(() => initializeUploadWebSocket(), 3000);
                    }
                },
                usePollingFallback: false
            });
            uploadWebSocketRef.current = ws;
        } catch (error) {
            setWsUploadConnected(false);
            isUploadConnectingRef.current = false;
        }
    };
    
    // Upload pose frame via WebSocket
    const uploadFrameViaWebSocket = (frameData) => {
        if (!uploadWebSocketRef.current || !uploadWebSocketRef.current.isConnected) {
            return false;
        }
        
        // Include data_type in the upload message
        return uploadWebSocketRef.current.uploadFrame(frameData, 'pose');
    };
    
    // Component mount effect
    useEffect(() => {
        setMounted(true);
        loadMediaPipe();
        
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
            if (poseLandmarkerRef.current) {
                try {
                    poseLandmarkerRef.current.close();
                    poseLandmarkerRef.current = null;
                } catch (error) {
                    // Error disposing MediaPipe model
                }
            }
            
            // Clear canvas
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
            
            // Clear hand raising buffer
            handRaiseBuffer.current = [];
            lastHandRaiseCalculation.current = 0;
            latestLeftHandRaiseFrequency.current = 0;
            latestLeftHandRaiseAmplitude.current = 0;
            latestLeftHandRaised.current = false;
            latestRightHandRaiseFrequency.current = 0;
            latestRightHandRaiseAmplitude.current = 0;
            latestRightHandRaised.current = false;
            
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

    // Status checking effect
    useEffect(() => {
        const checkPoseStatus = () => {
            setPoseVisible(localStorage.getItem('pose_visible') || 'false');
            setLandmarkCount(parseInt(localStorage.getItem('landmark_count') || '0'));
            setPoseConfidence(parseFloat(localStorage.getItem('pose_confidence') || '0'));
            setLeftHandRaiseFrequency(parseFloat(localStorage.getItem('left_hand_raise_frequency') || '0'));
            setLeftHandRaiseAmplitude(parseFloat(localStorage.getItem('left_hand_raise_amplitude') || '0'));
            setLeftHandRaised(localStorage.getItem('left_hand_raised') === 'true');
            setRightHandRaiseFrequency(parseFloat(localStorage.getItem('right_hand_raise_frequency') || '0'));
            setRightHandRaiseAmplitude(parseFloat(localStorage.getItem('right_hand_raise_amplitude') || '0'));
            setRightHandRaised(localStorage.getItem('right_hand_raised') === 'true');
        };

        const statusInterval = setInterval(checkPoseStatus, 250);
        return () => clearInterval(statusInterval);
    }, []);

    // Handle stream assignment to video element when stream changes
    useEffect(() => {
        if (stream && videoRef.current && videoRef.current.srcObject !== stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    //////////////////////////////////// RENDER ////////////////////////////////////

    return (
        <Row className="mb-4">
            <Col>
                <div className="d-flex flex-column align-items-center">
                    <div className="d-flex flex-column align-items-center" style={{ width: '200px' }}>
                        <div 
                            className={embeddingTW ? "twitch-embed-page" : ""}
                            style={{
                                position: 'fixed',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                backgroundColor: '#000',
                                zIndex: 1000,
                                padding: window.innerWidth < 768 ? '0.5rem' : '1rem',
                                paddingBottom: embeddingTW 
                                    ? `max(0.5rem, calc(0.5rem + var(--safe-area-bottom) + 8px))` 
                                    : `max(0.5rem, calc(0.5rem + var(--safe-area-bottom)))`,
                                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                                minHeight: window.innerWidth < 768 ? 'max(8rem, calc(8rem + var(--safe-area-bottom)))' : 
                                          sizeMode === 'large' ? 'max(12rem, calc(12rem + var(--safe-area-bottom)))' : 'auto',
                                maxHeight: window.innerWidth < 768 ? 'max(10rem, calc(10rem + var(--safe-area-bottom)))' : 
                                          sizeMode === 'large' ? 'max(16rem, calc(16rem + var(--safe-area-bottom)))' : 'auto',
                                transform: window.innerWidth < 768 ? 'translateY(0)' : 'none',
                                ...(embeddingTW && {
                                    isolation: 'isolate',
                                    contain: 'layout style',
                                    willChange: 'transform'
                                })
                            }}
                        >
                            <div className="d-flex align-items-center justify-content-between gap-3">
                                {/* Webcam container - Left side */}
                                <div className="d-flex justify-content-center" style={{
                                    // Move camera up in large mode on smartphone
                                    marginTop: (window.innerWidth < 768 && sizeMode === 'large') ? '-1rem' : '0'
                                }}>
                                    {/* Hidden camera for pose detection */}
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
                                    
                                    {/* Canvas for pose landmarks with white frame */}
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

                                {/* Status indicators - Center */}
                                <div className={`d-flex ${window.innerWidth >= 768 ? 'flex-row' : 'flex-column'} align-items-center gap-0`} style={{ flex: 1 }}>
                                    <div className={`d-flex gap-2 align-items-center justify-content-start ${window.innerWidth < 768 ? 'mb-2' : ''}`} style={{ width: '100%' }}>
                                        <PlayPauseButton
                                            onClick={handlePoseDetection}
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
                                                backgroundColor: poseVisible === 'true' ? '#4CAF50' : '#FF0000'
                                            }} />
                                        )}
                                        {!scan ? (
                                            <p style={{ 
                                                textAlign: 'left', 
                                                margin: 0, 
                                                fontSize: window.innerWidth < 768 ? '0.5rem' : '0.6rem',
                                                lineHeight: '1.2'
                                            }}>
                                                {modelError ? 'Model Error' : 
                                                 !isModelLoaded ? 'Loading model...' :
                                                 !detectorInitialized ? 'Loading video...' :
                                                 !is_demo_session && !localStorage.getItem('idToken') 
                                                    ? 'Login needed'
                                                    : 'Capture body pose'}
                                            </p>
                                        ) : (
                                            <span style={{ fontSize: window.innerWidth < 768 ? '0.6rem' : '0.7rem' }}>Pose visible</span>
                                        )}
                                    </div>
                                    <div className="d-flex gap-0 align-items-center justify-content-start" style={{ width: '100%' }}>
                                        <div className="d-flex flex-column" style={{ minWidth: '80px' }}>
                                            {scan ? (
                                                poseVisible === 'true' ? (
                                                    <p className="mb-1" style={{ fontSize: '0.5rem' }}>
                                                        {landmarkCount} landmarks @ {Math.round(poseConfidence * 100)}%
                                                    </p>
                                                ) : (
                                                    <p className="mb-1" style={{ fontSize: '0.5rem' }}>
                                                        Body pose
                                                    </p>
                                                )
                                            ) : (
                                                <p className="mb-1" style={{ fontSize: '0.5rem' }}>
                                                    Body pose
                                                </p>
                                            )}
                                            <div className="d-flex align-items-center">
                                                <div style={{ 
                                                    width: '40px',
                                                    height: '16px',
                                                    border: '2px solid white',
                                                    position: 'relative'
                                                }}>
                                                    <div style={{ 
                                                        position: 'absolute',
                                                        left: 0,
                                                        top: 0,
                                                        height: '100%',
                                                        width: scan ? `${poseConfidence * 100}%` : '0%',
                                                        backgroundColor: scan ? (poseConfidence > 0.7 ? '#4CAF50' : 'white') : 'transparent'
                                                    }}/>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Col>
        </Row>
    );
};

export default BodyPoseUserUI;
