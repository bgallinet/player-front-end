/**
 * Unified webcam sensing: face mesh + expressions, full-body pose, and hand landmarks
 * in one pipeline using MediaPipe HolisticLandmarker (@mediapipe/tasks-vision, Apache-2.0).
 * Runs in the browser (WASM); CPU delegate is used for broad smartphone compatibility.
 *
 * Writes the same localStorage keys as the old separate face + pose UIs so
 * Player / ReactionMapper keep working. Adds optional pinch-open scores per hand.
 * GestureRecognizer (same package) adds Thumb_Up / Thumb_Down; it does not replace
 * arm/hand-raise from pose (wrist vs shoulder) — HandRaiseCalculator stays for that.
 *
 * Model weights: full holistic_landmarker float16 from Google storage (`.../latest/...`).
 * The `_lite` artifact path previously used returns 404 from CDN.
 */
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import AnalyticsAPI from '../../utils/AnalyticsAPI.jsx';
import {
    scanFrequencyLandmark,
    scanFrequencyPose,
    noddingAnalysisWindow,
    secondaryColor,
    landmarkDataUploadInterval,
    thresholdForVisualizationOfNodding,
} from '../../utils/DisplaySettings.jsx';
import { getSessionNameFromUrl, createAuthenticatedRequestBody } from '../../hooks/sessionUtils.js';
import { HolisticLandmarker, GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';
import { drawLandmarksOnCanvas } from '../animations/landmarkRenderer';
import OrientedCamera from '../OrientedCamera.jsx';
import { uploadDetectionData, shouldUpload, clearArrays } from './detectionUploader';
import NoddingCalculator from './NoddingCalculator.jsx';
import HandRaiseCalculator from './HandRaiseCalculator.jsx';
import { DATA_COLLECTION_WINDOW } from '../../hooks/ReactionMapperConfig';
import PlayPauseButton from '../buttons/PlayPauseButton';
import CloseButton from '../buttons/CloseButton';
import BodyPoseDrawing from '../animations/BodyPoseDrawing';

const isProduction = process.env.NODE_ENV === 'production';

/** Full HolisticLandmarker bundle (lite variant not published at the historical URL). */
const HOLISTIC_MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task';

const GESTURE_MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task';

/** Min score to accept a canned gesture (Thumb_Up / Thumb_Down). */
const MIN_GESTURE_SCORE = 0.55;

function gestureLabelFromCategory(category) {
    if (!category || category.score < MIN_GESTURE_SCORE) return 'None';
    const n = category.categoryName;
    if (n === 'Thumb_Up' || n === 'Thumb_Down') return n;
    return 'None';
}

function readLeftRightGestures(gestureResult) {
    let left = 'None';
    let right = 'None';
    const n = gestureResult?.gestures?.length ?? 0;
    for (let i = 0; i < n; i++) {
        const side = gestureResult.handedness?.[i]?.[0]?.categoryName;
        const label = gestureLabelFromCategory(gestureResult.gestures[i]?.[0]);
        if (side === 'Left') left = label;
        else if (side === 'Right') right = label;
    }
    return { left, right };
}

function computeFaceBoundingBox(landmarks, videoWidth, videoHeight) {
    if (!landmarks || landmarks.length === 0) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    landmarks.forEach((landmark) => {
        if (landmark.x < minX) minX = landmark.x;
        if (landmark.x > maxX) maxX = landmark.x;
        if (landmark.y < minY) minY = landmark.y;
        if (landmark.y > maxY) maxY = landmark.y;
    });
    const left = Math.round(minX * videoWidth);
    const top = Math.round(minY * videoHeight);
    const width = Math.round((maxX - minX) * videoWidth);
    const height = Math.round((maxY - minY) * videoHeight);
    const centerX = Math.round(left + width / 2);
    const centerY = Math.round(top + height / 2);
    return {
        left,
        top,
        width,
        height,
        position: { centerX, centerY, top, left },
    };
}

function extractFaceReactions(blendshapes) {
    if (!blendshapes || blendshapes.length === 0) {
        return { smiling: 0, jawOpen: 0 };
    }
    const getScore = (name) => {
        const b = blendshapes.find((x) => x.categoryName === name);
        return b ? b.score : 0;
    };
    const smileLeft = getScore('mouthSmileLeft');
    const smileRight = getScore('mouthSmileRight');
    const smilingIntensity = (smileLeft + smileRight) / 2;
    const jawOpenIntensity = getScore('jawOpen');
    return {
        smiling: Math.round(smilingIntensity * 1000) / 1000,
        jawOpen: Math.round(jawOpenIntensity * 1000) / 1000,
    };
}

/** ~1 = fingers more open / less pinch, ~0 = strong pinch (thumb–index proximity). */
function pinchOpen01(landmarks) {
    if (!landmarks || landmarks.length < 9) return 0;
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    if (!thumbTip || !indexTip) return 0;
    const d = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    const pinched = 0.035;
    const open = 0.2;
    return Math.min(1, Math.max(0, (d - pinched) / (open - pinched)));
}

const UnifiedSensingUserUI = ({
    stream,
    embeddingTW,
    is_demo_session,
    demo_username,
    sessionName,
    sizeMode = 'large',
    autoStartLandmarkTick = 0,
    forceStopDetectionTick = 0,
}) => {
    const videoRef = useRef(null);
    const intervalIdRef = useRef(null);
    const canvasRef = useRef(null);
    const holisticRef = useRef(null);
    const gestureRecognizerRef = useRef(null);
    const [scan, setScan] = useState(false);
    /** When detection is on, show full-screen overlay until user closes it or stops detection */
    const [overlayDismissed, setOverlayDismissed] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [modelError, setModelError] = useState(null);
    const [detectorInitialized, setDetectorInitialized] = useState(false);

    const [faceVisible, setFaceVisible] = useState('false');
    const [poseVisible, setPoseVisible] = useState('false');
    const [faceLandmarkCount, setFaceLandmarkCount] = useState(0);
    const [poseLandmarkCount, setPoseLandmarkCount] = useState(0);
    const [smilingIntensity, setSmilingIntensity] = useState(0);
    const [jawOpenIntensity, setJawOpenIntensity] = useState(0);
    const [noddingFrequency, setNoddingFrequency] = useState(0);
    const [noddingAmplitude, setNoddingAmplitude] = useState(0);

    const landmarkBuffer = useRef([]);
    const lastNoddingCalculation = useRef(0);
    const smoothedAmplitude = useRef(0);
    const amplitudeSmoothingFactor = 0.4;
    const latestNoddingFrequency = useRef(0);
    const latestNoddingAmplitude = useRef(0);

    const handRaiseBuffer = useRef([]);
    const lastHandRaiseCalculation = useRef(0);
    const latestLeftHandRaiseFrequency = useRef(0);
    const latestLeftHandRaiseAmplitude = useRef(0);
    const latestLeftHandRaised = useRef(false);
    const latestRightHandRaiseFrequency = useRef(0);
    const latestRightHandRaiseAmplitude = useRef(0);
    const latestRightHandRaised = useRef(false);

    const detectionInProgressRef = useRef(false);

    const isOverlayLayout = scan && !overlayDismissed;

    /** Overlay: square fits below nav with room for controls + BPM (no page scroll). */
    const cameraSize = useMemo(() => {
        if (isOverlayLayout) {
            return 'min(70vmin, calc(100dvh - 15rem), calc(100vw - 2rem))';
        }
        return sizeMode === 'large' ? '160px' : '80px';
    }, [isOverlayLayout, sizeMode]);

    useEffect(() => {
        if (!scan) {
            setOverlayDismissed(false);
        }
    }, [scan]);

    useEffect(() => {
        if (!isOverlayLayout) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isOverlayLayout]);
    const unifiedScanMs = Math.min(scanFrequencyLandmark, scanFrequencyPose);

    const flushFaceLocalStorage = useCallback(
        (
            tempLandmarks,
            tempTimestamps,
            tempConfidences,
            tempCenterX,
            tempCenterY,
            tempWidths,
            tempHeights,
            tempFrequencies,
            tempAmplitudes,
            tempSmiling,
            tempJawOpen
        ) => {
            const now = Date.now();
            try {
                let existingData = null;
                try {
                    const s = localStorage.getItem('face_position_data_arrays');
                    if (s) existingData = JSON.parse(s);
                } catch {
                    existingData = null;
                }
                const bufferWindow = DATA_COLLECTION_WINDOW;
                const facePositionDataArrays = {
                    frequencyArray: tempFrequencies,
                    amplitudeArray: tempAmplitudes,
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
                    landmarkCount:
                        tempLandmarks.length > 0 ? tempLandmarks[tempLandmarks.length - 1].length : 0,
                    faceConfidence:
                        tempConfidences.length > 0 ? tempConfidences[tempConfidences.length - 1] : 0,
                    noddingFrequency: latestNoddingFrequency.current,
                    noddingAmplitude: latestNoddingAmplitude.current,
                    smilingIntensity:
                        tempSmiling.length > 0 ? tempSmiling[tempSmiling.length - 1] : 0,
                    jawOpenIntensity: tempJawOpen.length > 0 ? tempJawOpen[tempJawOpen.length - 1] : 0,
                };
                if (existingData && existingData.timestamps) {
                    const recentExistingData = existingData.timestamps
                        .map((timestamp, index) => ({ timestamp, index }))
                        .filter((item) => now - item.timestamp <= bufferWindow)
                        .map((item) => item.index);
                    facePositionDataArrays.frequencyArray = [
                        ...recentExistingData.map((i) => existingData.frequencyArray[i]).filter((v) => v !== undefined),
                        ...tempFrequencies,
                    ];
                    facePositionDataArrays.amplitudeArray = [
                        ...recentExistingData.map((i) => existingData.amplitudeArray[i]).filter((v) => v !== undefined),
                        ...tempAmplitudes,
                    ];
                    facePositionDataArrays.smilingArray = [
                        ...recentExistingData.map((i) => existingData.smilingArray[i]).filter((v) => v !== undefined),
                        ...tempSmiling,
                    ];
                    facePositionDataArrays.jawOpenArray = [
                        ...recentExistingData.map((i) => existingData.jawOpenArray[i]).filter((v) => v !== undefined),
                        ...tempJawOpen,
                    ];
                    facePositionDataArrays.timestamps = [
                        ...recentExistingData.map((i) => existingData.timestamps[i]).filter((v) => v !== undefined),
                        ...tempTimestamps,
                    ];
                    facePositionDataArrays.centerXPositions = [
                        ...recentExistingData.map((i) => existingData.centerXPositions[i]).filter((v) => v !== undefined),
                        ...tempCenterX,
                    ];
                    facePositionDataArrays.centerYPositions = [
                        ...recentExistingData.map((i) => existingData.centerYPositions[i]).filter((v) => v !== undefined),
                        ...tempCenterY,
                    ];
                    facePositionDataArrays.widthPositions = [
                        ...recentExistingData.map((i) => existingData.widthPositions[i]).filter((v) => v !== undefined),
                        ...tempWidths,
                    ];
                    facePositionDataArrays.heightPositions = [
                        ...recentExistingData.map((i) => existingData.heightPositions[i]).filter((v) => v !== undefined),
                        ...tempHeights,
                    ];
                }
                localStorage.setItem('face_position_data_arrays', JSON.stringify(facePositionDataArrays));
            } catch {
                /* ignore */
            }
        },
        []
    );

    const loadVisionModels = async () => {
        try {
            const wasmPath = isProduction
                ? 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
                : 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
            const vision = await FilesetResolver.forVisionTasks(wasmPath);
            holisticRef.current = await HolisticLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: HOLISTIC_MODEL_URL,
                    delegate: 'CPU',
                },
                runningMode: 'VIDEO',
                minFaceDetectionConfidence: 0.3,
                minFacePresenceConfidence: 0.3,
                outputFaceBlendshapes: true,
                minPoseDetectionConfidence: 0.3,
                minPosePresenceConfidence: 0.3,
                minHandLandmarksConfidence: 0.3,
            });

            try {
                gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: GESTURE_MODEL_URL,
                        delegate: 'CPU',
                    },
                    runningMode: 'VIDEO',
                    numHands: 2,
                    minHandDetectionConfidence: 0.35,
                    minHandPresenceConfidence: 0.35,
                    minTrackingConfidence: 0.35,
                    cannedGesturesClassifierOptions: {
                        categoryAllowlist: ['Thumb_Up', 'Thumb_Down'],
                    },
                });
            } catch (gestureErr) {
                console.warn('GestureRecognizer init failed', gestureErr);
                gestureRecognizerRef.current = null;
            }

            setIsModelLoaded(true);
        } catch (err) {
            setModelError(err.message || 'Holistic model load failed');
        }
    };

    const drawComposite = (
        faceLandmarks,
        faceReactions,
        nodAmp,
        poseLandmarks,
        leftHandLm,
        rightHandLm
    ) => {
        if (!canvasRef.current || !videoRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const video = videoRef.current;
        canvas.width = video.videoWidth || video.width || 640;
        canvas.height = video.videoHeight || video.height || 480;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (poseLandmarks && poseLandmarks.length > 0) {
            BodyPoseDrawing.drawAllPoseLandmarks(
                ctx,
                poseLandmarks,
                canvas.width,
                canvas.height,
                0,
                0,
                1,
                0.3,
                secondaryColor,
                latestLeftHandRaised.current,
                latestRightHandRaised.current
            );
        }

        const drawHand = (lm, color) => {
            if (!lm || lm.length < 2) return;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            const pairs = [
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
            for (const [a, b] of pairs) {
                if (!lm[a] || !lm[b]) continue;
                ctx.beginPath();
                ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height);
                ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height);
                ctx.stroke();
            }
        };
        drawHand(leftHandLm, 'rgba(0,255,200,0.85)');
        drawHand(rightHandLm, 'rgba(255,180,0,0.85)');

        if (faceLandmarks && faceLandmarks.length > 0) {
            const frameData = {
                amplitude: nodAmp,
                smiling: faceReactions.smiling,
                jaw_open: faceReactions.jawOpen,
            };
            const lineWidthMultiplier = sizeMode === 'large' ? 3.5 : 2.5;
            drawLandmarksOnCanvas(ctx, faceLandmarks, frameData, canvas.width, canvas.height, lineWidthMultiplier);
        }
    };

    const landmarkArrayRef = useRef([]);
    const timeStampArrayRef = useRef([]);
    const confidenceArrayRef = useRef([]);
    const centerXArrayRef = useRef([]);
    const centerYArrayRef = useRef([]);
    const widthArrayRef = useRef([]);
    const heightArrayRef = useRef([]);
    const frequencyArrayRef = useRef([]);
    const amplitudeArrayRef = useRef([]);
    const smilingArrayRef = useRef([]);
    const jawOpenArrayRef = useRef([]);

    const poseArrayRef = useRef([]);
    const poseTimeRef = useRef([]);
    const poseConfRef = useRef([]);

    const runUnifiedFrame = async () => {
        if (!videoRef.current || !holisticRef.current || !detectorInitialized) return;
        if (videoRef.current.readyState < 2) return;
        if (detectionInProgressRef.current) return;

        const la = landmarkArrayRef.current;
        const tsa = timeStampArrayRef.current;
        const ca = confidenceArrayRef.current;
        const cxa = centerXArrayRef.current;
        const cya = centerYArrayRef.current;
        const wa = widthArrayRef.current;
        const ha = heightArrayRef.current;
        const fa = frequencyArrayRef.current;
        const aa = amplitudeArrayRef.current;
        const sa = smilingArrayRef.current;
        const ja = jawOpenArrayRef.current;
        const pa = poseArrayRef.current;
        const pta = poseTimeRef.current;
        const pca = poseConfRef.current;

        try {
            detectionInProgressRef.current = true;
            const ts = performance.now();
            const r = holisticRef.current.detectForVideo(videoRef.current, ts);

            let faceLandmarks = null;
            let faceReactions = { smiling: 0, jawOpen: 0 };
            let poseLandmarks = null;
            let leftHandLm = r.leftHandLandmarks?.[0] || null;
            let rightHandLm = r.rightHandLandmarks?.[0] || null;

            if (r.faceLandmarks && r.faceLandmarks.length > 0) {
                faceLandmarks = r.faceLandmarks[0];
                const cats = r.faceBlendshapes?.[0]?.categories;
                faceReactions = extractFaceReactions(cats || []);
                const confidence = 0.8;
                const videoWidth = videoRef.current.videoWidth || videoRef.current.width || 640;
                const videoHeight = videoRef.current.videoHeight || videoRef.current.height || 480;
                const faceBox = computeFaceBoundingBox(faceLandmarks, videoWidth, videoHeight);
                const landmarkData = {
                    timestamp: Date.now(),
                    landmarks: faceLandmarks.map((landmark, index) => ({
                        index,
                        x: parseFloat(landmark.x.toFixed(3)),
                        y: parseFloat(landmark.y.toFixed(3)),
                        z: parseFloat((landmark.z || 0).toFixed(3)),
                    })),
                    confidence,
                    facePosition: faceBox,
                };
                la.push(landmarkData.landmarks);
                tsa.push(landmarkData.timestamp);
                ca.push(confidence);
                if (faceBox) {
                    cxa.push(faceBox.position.centerX);
                    cya.push(faceBox.position.centerY);
                    wa.push(faceBox.width);
                    ha.push(faceBox.height);
                    fa.push(latestNoddingFrequency.current);
                    aa.push(latestNoddingAmplitude.current);
                    sa.push(faceReactions.smiling);
                    ja.push(faceReactions.jawOpen);
                    landmarkBuffer.current.push({
                        timestamp: landmarkData.timestamp,
                        centerX: faceBox.position.centerX,
                        centerY: faceBox.position.centerY,
                        width: faceBox.width,
                        height: faceBox.height,
                        noddingData: {
                            frequency: latestNoddingFrequency.current,
                            amplitude: latestNoddingAmplitude.current,
                        },
                    });
                }
                setFaceVisible('true');
                setFaceLandmarkCount(faceLandmarks.length);
                setSmilingIntensity(faceReactions.smiling);
                setJawOpenIntensity(faceReactions.jawOpen);

                const currentTimeMs = Date.now();
                if (currentTimeMs - lastNoddingCalculation.current >= scanFrequencyLandmark) {
                    const windowStart = currentTimeMs - noddingAnalysisWindow;
                    const recentData = landmarkBuffer.current.filter((d) => d.timestamp > windowStart);
                    if (recentData.length >= 10) {
                        const noddingResult = NoddingCalculator.calculateNodding(
                            recentData.map((d) => d.timestamp),
                            recentData.map((d) => d.centerX),
                            recentData.map((d) => d.centerY),
                            recentData.map((d) => d.width),
                            recentData.map((d) => d.height)
                        );
                        smoothedAmplitude.current =
                            smoothedAmplitude.current * (1 - amplitudeSmoothingFactor) +
                            noddingResult.amplitude * amplitudeSmoothingFactor;
                        const finalAmplitude = Math.round(smoothedAmplitude.current * 1000) / 1000;
                        latestNoddingFrequency.current = noddingResult.frequency;
                        latestNoddingAmplitude.current = finalAmplitude;
                        setNoddingFrequency(noddingResult.frequency);
                        setNoddingAmplitude(finalAmplitude);
                        lastNoddingCalculation.current = currentTimeMs;
                    }
                    landmarkBuffer.current = landmarkBuffer.current.filter((d) => d.timestamp > windowStart);
                }

                if (shouldUpload(tsa, landmarkDataUploadInterval)) {
                    const tempLandmarks = [...la];
                    const tempTimestamps = [...tsa];
                    const tempConfidences = [...ca];
                    const tempCenterX = [...cxa];
                    const tempCenterY = [...cya];
                    const tempWidths = [...wa];
                    const tempHeights = [...ha];
                    const tempFrequencies = [...fa];
                    const tempAmplitudes = [...aa];
                    const tempSmiling = [...sa];
                    const tempJawOpen = [...ja];
                    clearArrays(la, tsa, ca, cxa, cya, wa, ha, fa, aa, sa, ja);
                    flushFaceLocalStorage(
                        tempLandmarks,
                        tempTimestamps,
                        tempConfidences,
                        tempCenterX,
                        tempCenterY,
                        tempWidths,
                        tempHeights,
                        tempFrequencies,
                        tempAmplitudes,
                        tempSmiling,
                        tempJawOpen
                    );
                }
                localStorage.setItem('face_visible', 'true');
            } else {
                setFaceVisible('false');
                setFaceLandmarkCount(0);
                setSmilingIntensity(0);
                setJawOpenIntensity(0);
                setNoddingFrequency(0);
                setNoddingAmplitude(0);
                latestNoddingFrequency.current = 0;
                latestNoddingAmplitude.current = 0;
                localStorage.setItem('face_visible', 'false');
                localStorage.removeItem('face_position_data_arrays');
                localStorage.removeItem('landmark_nodding_frequency');
                localStorage.removeItem('landmark_nodding_amplitude');
                landmarkBuffer.current = [];
            }

            if (r.poseLandmarks && r.poseLandmarks.length > 0) {
                poseLandmarks = r.poseLandmarks[0];
                const confidence = r.poseWorldLandmarks?.length ? 0.8 : 0.6;
                const leftShoulder = poseLandmarks[11];
                const rightShoulder = poseLandmarks[12];
                const leftWrist = poseLandmarks[15];
                const rightWrist = poseLandmarks[16];
                const poseData = {
                    timestamp: Date.now(),
                    landmarks: poseLandmarks.map((landmark, index) => ({
                        index,
                        x: landmark.x,
                        y: landmark.y,
                        z: landmark.z || 0,
                        visibility: landmark.visibility || 1.0,
                    })),
                    confidence,
                };
                pa.push(poseData.landmarks);
                pta.push(poseData.timestamp);
                pca.push(confidence);
                setPoseVisible('true');
                setPoseLandmarkCount(poseLandmarks.length);

                if (leftShoulder && leftWrist && rightShoulder && rightWrist) {
                    handRaiseBuffer.current.push({
                        timestamp: poseData.timestamp,
                        leftWristY: leftWrist.y,
                        leftShoulderY: leftShoulder.y,
                        rightWristY: rightWrist.y,
                        rightShoulderY: rightShoulder.y,
                    });
                }
                const currentTimeMs = Date.now();
                if (currentTimeMs - lastHandRaiseCalculation.current >= scanFrequencyPose) {
                    const windowStart = currentTimeMs - noddingAnalysisWindow;
                    const recentData = handRaiseBuffer.current.filter((d) => d.timestamp > windowStart);
                    if (recentData.length >= 10) {
                        if (recentData.every((d) => d.leftWristY !== undefined && d.leftShoulderY !== undefined)) {
                            const leftHandRaiseResult = HandRaiseCalculator.calculateHandRaise(
                                recentData.map((d) => d.timestamp),
                                recentData.map((d) => d.leftWristY),
                                recentData.map((d) => d.leftShoulderY),
                                latestLeftHandRaised.current
                            );
                            latestLeftHandRaiseFrequency.current = leftHandRaiseResult.frequency;
                            latestLeftHandRaiseAmplitude.current = leftHandRaiseResult.amplitude;
                            latestLeftHandRaised.current = leftHandRaiseResult.isRaised;
                        }
                        if (recentData.every((d) => d.rightWristY !== undefined && d.rightShoulderY !== undefined)) {
                            const rightHandRaiseResult = HandRaiseCalculator.calculateHandRaise(
                                recentData.map((d) => d.timestamp),
                                recentData.map((d) => d.rightWristY),
                                recentData.map((d) => d.rightShoulderY),
                                latestRightHandRaised.current
                            );
                            latestRightHandRaiseFrequency.current = rightHandRaiseResult.frequency;
                            latestRightHandRaiseAmplitude.current = rightHandRaiseResult.amplitude;
                            latestRightHandRaised.current = rightHandRaiseResult.isRaised;
                        }
                        lastHandRaiseCalculation.current = currentTimeMs;
                    }
                    handRaiseBuffer.current = handRaiseBuffer.current.filter((d) => d.timestamp > windowStart);
                }

                if (shouldUpload(pta, 800)) {
                    const tempPoses = [...pa];
                    const tempT = [...pta];
                    const tempC = [...pca];
                    clearArrays(pa, pta, pca);
                    await uploadDetectionData({
                        dataArray: tempPoses,
                        timestampArray: tempT,
                        confidenceArray: tempC,
                        dataType: 'pose',
                        is_demo_session,
                        demo_username,
                        sessionName,
                    });
                    if (pta.length > 0) clearArrays(pa, pta, pca);
                }
                localStorage.setItem('pose_visible', 'true');
                localStorage.setItem('landmark_count', String(poseLandmarks.length));
                localStorage.setItem('pose_confidence', String(confidence));
            } else {
                setPoseVisible('false');
                localStorage.setItem('pose_visible', 'false');
                latestLeftHandRaiseFrequency.current = 0;
                latestLeftHandRaiseAmplitude.current = 0;
                latestLeftHandRaised.current = false;
                latestRightHandRaiseFrequency.current = 0;
                latestRightHandRaiseAmplitude.current = 0;
                latestRightHandRaised.current = false;
            }

            localStorage.setItem(
                'left_hand_raise_frequency',
                String(latestLeftHandRaiseFrequency.current)
            );
            localStorage.setItem(
                'left_hand_raise_amplitude',
                String(latestLeftHandRaiseAmplitude.current)
            );
            localStorage.setItem('left_hand_raised', latestLeftHandRaised.current ? 'true' : 'false');
            localStorage.setItem(
                'right_hand_raise_frequency',
                String(latestRightHandRaiseFrequency.current)
            );
            localStorage.setItem(
                'right_hand_raise_amplitude',
                String(latestRightHandRaiseAmplitude.current)
            );
            localStorage.setItem('right_hand_raised', latestRightHandRaised.current ? 'true' : 'false');

            const leftPinch = pinchOpen01(leftHandLm);
            const rightPinch = pinchOpen01(rightHandLm);
            localStorage.setItem('mediapipe_left_hand_pinch_open', String(leftPinch));
            localStorage.setItem('mediapipe_right_hand_pinch_open', String(rightPinch));

            if (gestureRecognizerRef.current) {
                try {
                    const gResult = gestureRecognizerRef.current.recognizeForVideo(
                        videoRef.current,
                        ts
                    );
                    const { left: leftG, right: rightG } = readLeftRightGestures(gResult);
                    localStorage.setItem('mediapipe_left_hand_gesture', leftG);
                    localStorage.setItem('mediapipe_right_hand_gesture', rightG);
                    localStorage.setItem(
                        'mediapipe_left_thumb_up',
                        leftG === 'Thumb_Up' ? 'true' : 'false'
                    );
                    localStorage.setItem(
                        'mediapipe_right_thumb_up',
                        rightG === 'Thumb_Up' ? 'true' : 'false'
                    );
                    localStorage.setItem(
                        'mediapipe_left_thumb_down',
                        leftG === 'Thumb_Down' ? 'true' : 'false'
                    );
                    localStorage.setItem(
                        'mediapipe_right_thumb_down',
                        rightG === 'Thumb_Down' ? 'true' : 'false'
                    );
                } catch {
                    /* gesture frame skipped */
                }
            }

            drawComposite(
                faceLandmarks,
                faceReactions,
                latestNoddingAmplitude.current,
                poseLandmarks,
                leftHandLm,
                rightHandLm
            );
        } catch {
            /* one frame failed */
        } finally {
            detectionInProgressRef.current = false;
        }
    };

    const handleToggle = async () => {
        const wasScanning = scan;
        if (!wasScanning) {
            setFaceVisible('false');
            localStorage.setItem('face_visible', 'false');
        }
        setScan(!wasScanning);

        try {
            const analyticsData = JSON.stringify(
                createAuthenticatedRequestBody(
                    {
                        request_type: 'analytics',
                        interaction_type: 'user_interaction',
                        element_id: scan ? 'stop_unified_sensing' : 'start_unified_sensing',
                        page_url: window.location.href,
                        session_name: sessionName || getSessionNameFromUrl(),
                        experiment_name: 'unified_holistic_detection_ui',
                        metadata: { variant: 'control', is_control: true, experiment_config: {} },
                    },
                    is_demo_session
                )
            );
            AnalyticsAPI(analyticsData, !is_demo_session);
        } catch {
            /* ignore */
        }

        if (!is_demo_session && !localStorage.getItem('idToken')) {
            return;
        }
        if (!isModelLoaded || !holisticRef.current || !detectorInitialized) {
            return;
        }

        if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }

        if (wasScanning) {
            landmarkBuffer.current = [];
            handRaiseBuffer.current = [];
            localStorage.removeItem('face_visible');
            localStorage.removeItem('face_position_data_arrays');
            localStorage.removeItem('pose_visible');
            localStorage.removeItem('mediapipe_left_hand_pinch_open');
            localStorage.removeItem('mediapipe_right_hand_pinch_open');
            localStorage.removeItem('mediapipe_left_hand_gesture');
            localStorage.removeItem('mediapipe_right_hand_gesture');
            localStorage.removeItem('mediapipe_left_thumb_up');
            localStorage.removeItem('mediapipe_right_thumb_up');
            localStorage.removeItem('mediapipe_left_thumb_down');
            localStorage.removeItem('mediapipe_right_thumb_down');
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
            return;
        }

        intervalIdRef.current = setInterval(() => {
            void runUnifiedFrame();
        }, unifiedScanMs);
    };

    const lastAutoTick = useRef(0);
    useEffect(() => {
        if (!autoStartLandmarkTick || autoStartLandmarkTick <= lastAutoTick.current) return;
        if (scan) {
            lastAutoTick.current = autoStartLandmarkTick;
            return;
        }
        if (!isModelLoaded || !holisticRef.current || !detectorInitialized || modelError) return;
        lastAutoTick.current = autoStartLandmarkTick;
        void handleToggle();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- tick-driven start
    }, [autoStartLandmarkTick, scan, isModelLoaded, detectorInitialized, modelError]);

    const lastStopTick = useRef(0);
    useEffect(() => {
        if (!forceStopDetectionTick || forceStopDetectionTick <= lastStopTick.current) return;
        lastStopTick.current = forceStopDetectionTick;
        if (!scan) return;
        void handleToggle();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [forceStopDetectionTick, scan]);

    const hasLoaded = useRef(false);
    useEffect(() => {
        if (!hasLoaded.current) {
            hasLoaded.current = true;
            void loadVisionModels();
        }
        return () => {
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
            if (gestureRecognizerRef.current) {
                try {
                    gestureRecognizerRef.current.close();
                    gestureRecognizerRef.current = null;
                } catch {
                    /* ignore */
                }
            }
            if (holisticRef.current) {
                try {
                    holisticRef.current.close();
                    holisticRef.current = null;
                } catch {
                    /* ignore */
                }
            }
            hasLoaded.current = false;
            setScan(false);
        };
    }, []);

    useEffect(() => {
        if (isModelLoaded && !detectorInitialized && videoRef.current) {
            if (videoRef.current.readyState === 4) {
                setDetectorInitialized(true);
            } else {
                const onData = () => setDetectorInitialized(true);
                videoRef.current.addEventListener('loadeddata', onData);
                return () => videoRef.current?.removeEventListener('loadeddata', onData);
            }
        }
    }, [isModelLoaded, detectorInitialized, stream]);

    const transportBtnSize = isOverlayLayout
        ? window.innerWidth < 768
            ? '3.2rem'
            : '3.75rem'
        : window.innerWidth < 768
          ? '3.2rem'
          : '4rem';

    return (
        <div
            style={{
                width: '100%',
                marginBottom: isOverlayLayout ? 0 : '1rem',
                display: 'block',
                ...(isOverlayLayout
                    ? {
                          position: 'fixed',
                          left: 0,
                          right: 0,
                          bottom: 0,
                          top: 'clamp(3.5rem, 5vw, 6rem)',
                          zIndex: 900,
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          backgroundColor: '#050505',
                      }
                    : {}),
            }}
        >
            {isOverlayLayout && (
                <div
                    style={{
                        position: 'absolute',
                        top: '0.75rem',
                        right: '0.75rem',
                        zIndex: 10,
                    }}
                >
                    <CloseButton
                        onClick={() => setOverlayDismissed(true)}
                        aria-label="Close overlay and keep detection in the main window"
                    />
                </div>
            )}
            <div
                className={`${embeddingTW ? 'twitch-embed-page' : ''}`}
                style={{
                    backgroundColor: '#000',
                    padding: isOverlayLayout
                        ? '0.5rem 0.75rem 0.75rem'
                        : window.innerWidth < 768
                          ? '0.5rem'
                          : '1rem',
                    borderRadius: isOverlayLayout ? 0 : '0.5rem',
                    width: '100%',
                    minHeight: isOverlayLayout ? 0 : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: isOverlayLayout ? 'center' : 'flex-start',
                    flex: isOverlayLayout ? 1 : undefined,
                    boxSizing: 'border-box',
                    overflow: isOverlayLayout ? 'hidden' : undefined,
                }}
            >
                <div
                    className="d-flex flex-column align-items-center"
                    style={{
                        gap: isOverlayLayout ? '0.35rem' : '0.5rem',
                        flex: isOverlayLayout ? 1 : undefined,
                        minHeight: isOverlayLayout ? 0 : undefined,
                        justifyContent: isOverlayLayout ? 'center' : undefined,
                        width: '100%',
                        maxHeight: isOverlayLayout ? '100%' : undefined,
                    }}
                >
                    <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap">
                        <PlayPauseButton
                            onClick={() => void handleToggle()}
                            isPlaying={scan}
                            size={transportBtnSize}
                            tooltipText={scan ? 'Stop detection' : 'Start detection'}
                            isEnabled={
                                isModelLoaded &&
                                detectorInitialized &&
                                !modelError &&
                                (localStorage.getItem('idToken') || is_demo_session)
                            }
                            style={{
                                width: transportBtnSize,
                                height: transportBtnSize,
                            }}
                        />
                        {scan && (
                            <div
                                style={{
                                    width: window.innerWidth < 768 ? '1rem' : '1.2rem',
                                    height: window.innerWidth < 768 ? '1rem' : '1.2rem',
                                    borderRadius: '50%',
                                    border: '0.2rem solid white',
                                    backgroundColor: faceVisible === 'true' ? '#4CAF50' : '#FF0000',
                                }}
                            />
                        )}
                        {!scan ? (
                            <p
                                style={{
                                    textAlign: 'left',
                                    margin: 0,
                                    fontSize: window.innerWidth < 768 ? '0.8rem' : '1rem',
                                    lineHeight: '1.2',
                                    color: 'white',
                                }}
                            >
                                {modelError
                                    ? 'Model Error'
                                    : !isModelLoaded
                                      ? 'Loading model...'
                                      : !detectorInitialized
                                        ? 'Loading video...'
                                        : !is_demo_session && !localStorage.getItem('idToken')
                                          ? 'Login needed'
                                          : 'Start detection'}
                            </p>
                        ) : (
                            <p
                                style={{
                                    textAlign: 'left',
                                    margin: 0,
                                    fontSize: window.innerWidth < 768 ? '0.8rem' : '1rem',
                                    lineHeight: '1.2',
                                    color: 'white',
                                }}
                            >
                                {faceVisible === 'true' ? 'Detecting' : 'Searching...'}
                            </p>
                        )}
                    </div>
                    <div className="d-flex justify-content-center" style={{ position: 'relative' }}>
                        <OrientedCamera
                            stream={stream}
                            onVideoRef={(el) => {
                                videoRef.current = el;
                            }}
                            style={{
                                position: 'absolute',
                                width: cameraSize,
                                height: cameraSize,
                                opacity: 0,
                                pointerEvents: 'none',
                            }}
                            objectPosition={window.innerWidth < 768 ? 'center 85%' : 'center'}
                        />
                        <div
                            style={{
                                position: 'relative',
                                width: cameraSize,
                                height: cameraSize,
                                border: '2px solid white',
                                borderRadius: '8px',
                                backgroundColor: 'transparent',
                                overflow: 'hidden',
                            }}
                        >
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
                                    objectFit: 'cover',
                                }}
                            />
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-center">
                        <p
                            style={{
                                margin: 0,
                                fontSize: window.innerWidth < 768 ? '0.7rem' : '0.9rem',
                                color: 'white',
                                fontFamily: 'monospace',
                            }}
                        >
                            {(() => {
                                const bpm =
                                    scan &&
                                    faceVisible === 'true' &&
                                    noddingAmplitude > thresholdForVisualizationOfNodding
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

export default UnifiedSensingUserUI;
