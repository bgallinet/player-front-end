import { useState, useEffect, useRef } from 'react';
import AnalyticsAPI from '../../utils/AnalyticsAPI.jsx';
import { getSessionNameFromUrl, createAuthenticatedRequestBody } from '../../hooks/sessionUtils';

/**
 * Custom hook for MediaPipe detection (Face Landmarks or Body Pose)
 * Handles common logic for both detection types
 * 
 * @param {Object} config - Configuration object
 * @param {MediaStream} config.stream - Video stream
 * @param {boolean} config.is_demo_session - Whether it's a demo session
 * @param {string} config.sessionName - Session name
 * @param {Function} config.createDetector - Function to create the MediaPipe detector
 * @param {Function} config.runDetection - Function to run detection on a frame
 * @param {number} config.scanFrequency - Detection interval in ms
 * @param {string} config.detectionType - Type of detection ('landmark' or 'pose')
 * @param {string} config.experimentName - Name for analytics tracking
 * 
 * @returns {Object} - Detection state and controls
 */
export const useMediaPipeDetection = ({
    stream,
    is_demo_session,
    sessionName,
    createDetector,
    runDetection,
    scanFrequency,
    detectionType, // 'landmark' or 'pose'
    experimentName
}) => {
    // State management
    const videoRef = useRef(null);
    const intervalIdRef = useRef(null);
    const detectorRef = useRef(null);
    const detectionInProgressRef = useRef(false);
    
    const [scan, setScan] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [modelError, setModelError] = useState(null);
    const [detectorInitialized, setDetectorInitialized] = useState(false);
    
    // Detection state
    const [dataVisible, setDataVisible] = useState(
        localStorage.getItem(`${detectionType}_visible`) || 'false'
    );
    const [landmarkCount, setLandmarkCount] = useState(0);
    const [confidence, setConfidence] = useState(0);
    const [lastDetectionTime, setLastDetectionTime] = useState(0);

    // Load MediaPipe model
    const loadModel = async () => {
        try {
            const detector = await createDetector();
            detectorRef.current = detector;
            setIsModelLoaded(true);
        } catch (error) {
            setModelError(`MediaPipe ${detectionType} loading failed: ${error.message}`);
        }
    };

    // Handle detection start/stop
    const handleDetection = async () => {
        // Analytics tracking
        try {
            const analyticsData = JSON.stringify(createAuthenticatedRequestBody({
                'request_type': 'analytics',
                'element_id': `${detectionType}_detection_button`,
                'interaction_type': scan ? `stop_${detectionType}_detection` : `start_${detectionType}_detection`,
                'page_url': window.location.href,
                'session_name': sessionName || getSessionNameFromUrl(),
                'experiment_name': experimentName,
                'metadata': {
                    'variant': 'control',
                    'is_control': true,
                    'experiment_config': {}
                }
            }, is_demo_session));
            await AnalyticsAPI(analyticsData, !is_demo_session);
        } catch (error) {
            // Analytics API error
        }

        if (!is_demo_session && !localStorage.getItem('idToken')) {
            return;
        }

        if (!isModelLoaded || !detectorRef.current || !detectorInitialized) {
            return;
        }

        const newScanState = !scan;
        setScan(newScanState);
        
        if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }

        // Clean up when stopping detection
        if (scan) {
            setDataVisible('false');
            setLandmarkCount(0);
            setConfidence(0);
            
            localStorage.removeItem(`${detectionType}_visible`);
            localStorage.removeItem(`${detectionType}_count`);
            localStorage.removeItem(`${detectionType}_confidence`);
        }

        // Start detection
        if (!scan && mounted) {
            try {
                const dataArray = [];
                const timeStampArray = [];
                const confidenceArray = [];
                
                intervalIdRef.current = setInterval(
                    () => runDetection(
                        videoRef.current,
                        detectorRef.current,
                        detectorInitialized,
                        dataArray,
                        timeStampArray,
                        confidenceArray,
                        {
                            setDataVisible,
                            setLandmarkCount,
                            setConfidence,
                            setLastDetectionTime,
                            detectionInProgressRef
                        },
                        is_demo_session,
                        sessionName
                    ),
                    scanFrequency
                );
            } catch (error) {
                setScan(false);
            }
        }
    };

    // Component mount effect
    useEffect(() => {
        setMounted(true);
        loadModel();
        
        return () => {
            setMounted(false);
            
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
            
            if (detectorRef.current) {
                try {
                    detectorRef.current.close();
                    detectorRef.current = null;
                } catch (error) {
                    // Error disposing MediaPipe model
                }
            }
            
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
        const checkStatus = () => {
            setDataVisible(localStorage.getItem(`${detectionType}_visible`) || 'false');
            setLandmarkCount(parseInt(localStorage.getItem(`${detectionType}_count`) || '0'));
            setConfidence(parseFloat(localStorage.getItem(`${detectionType}_confidence`) || '0'));
        };

        const statusInterval = setInterval(checkStatus, 250);
        return () => clearInterval(statusInterval);
    }, [detectionType]);

    // Handle stream assignment to video element
    useEffect(() => {
        if (stream && videoRef.current && videoRef.current.srcObject !== stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return {
        // Refs
        videoRef,
        detectorRef,
        intervalIdRef,
        detectionInProgressRef,
        
        // State
        scan,
        mounted,
        isModelLoaded,
        modelError,
        detectorInitialized,
        dataVisible,
        landmarkCount,
        confidence,
        lastDetectionTime,
        
        // Methods
        handleDetection,
        setDataVisible,
        setLandmarkCount,
        setConfidence,
        setLastDetectionTime
    };
};

