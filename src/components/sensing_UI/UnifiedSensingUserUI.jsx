/**
 * Unified webcam sensing UI: Holistic landmarker + gesture recognition; drives `onSensingFeedFrame`.
 * Overlay composition: `drawHolisticOverlay` below; primitives: `BodyPoseDrawing`, `HandDrawing`, `LandmarkDrawing`; math: `music_adaptation/landmarks/*`.
 */
import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
    scanFrequencyLandmark,
    scanFrequencyPose,
    noddingAnalysisWindow,
    secondaryColor,
    thresholdForVisualizationOfNodding,
} from '../../utils/DisplaySettings.jsx';
import { getSessionNameFromUrl } from '../../hooks/sessionUtils.js';
import { HolisticLandmarker, GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';
import BodyPoseDrawing from './BodyPoseDrawing';
import HandDrawing from './HandDrawing';
import { drawLandmarksOnCanvas } from './LandmarkDrawing';
import OrientedCamera from '../OrientedCamera.jsx';
import NoddingCalculator from '../../music_adaptation/landmarks/NoddingCalculator';
import HandRaiseCalculator from '../../music_adaptation/landmarks/HandRaiseCalculator';
import {
    emptyReactionSensingFeedSnapshot,
    normalizeReactionSensingFeed,
} from '../../music_adaptation/feeds/reactionSensingFeed';
import { emotionDataPointsFromFaceBlob, mergeFaceTimelineWindow } from '../../music_adaptation/feeds/faceTimelineMerge';
import {
    HOLISTIC_MODEL_URL,
    GESTURE_MODEL_URL,
    visionTasksWasmBaseUrl,
} from '../../music_adaptation/landmarks/holisticModelConfig';
import {
    readLeftRightGestures,
    buildFaceLandmarkSample,
    buildPoseLandmarkSample,
} from '../../music_adaptation/landmarks/holisticFrameUtils';
import PlayPauseButton from '../../buttons/PlayPauseButton';
import CloseButton from '../../buttons/CloseButton';
import { trackButtonClick } from '../../hooks/simpleTracker';

/**
 * @param {{
 *   ctx: CanvasRenderingContext2D,
 *   canvasWidth: number,
 *   canvasHeight: number,
 *   poseLandmarks: unknown[] | null,
 *   leftHandLm: unknown,
 *   rightHandLm: unknown,
 *   faceLandmarks: unknown[] | null,
 *   faceReactions: { smiling: number, jawOpen: number },
 *   nodAmp: number,
 *   faceLineWidthMultiplier: number,
 *   poseLineColor: string,
 *   leftHandRaised: boolean,
 *   rightHandRaised: boolean,
 * }} p
 */
function drawHolisticOverlay(p) {
    const {
        ctx,
        canvasWidth,
        canvasHeight,
        poseLandmarks,
        leftHandLm,
        rightHandLm,
        faceLandmarks,
        faceReactions,
        nodAmp,
        faceLineWidthMultiplier,
        poseLineColor,
        leftHandRaised,
        rightHandRaised,
    } = p;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (poseLandmarks && poseLandmarks.length > 0) {
        BodyPoseDrawing.drawAllPoseLandmarks(
            ctx,
            poseLandmarks,
            canvasWidth,
            canvasHeight,
            0,
            0,
            1,
            0.3,
            poseLineColor,
            leftHandRaised,
            rightHandRaised,
        );
    }

    HandDrawing.drawAllHandLandmarks(ctx, leftHandLm, canvasWidth, canvasHeight, 'rgba(0,255,200,0.85)');
    HandDrawing.drawAllHandLandmarks(ctx, rightHandLm, canvasWidth, canvasHeight, 'rgba(255,180,0,0.85)');

    if (faceLandmarks && faceLandmarks.length > 0) {
        const frameData = {
            amplitude: nodAmp,
            smiling: faceReactions.smiling,
            jaw_open: faceReactions.jawOpen,
        };
        drawLandmarksOnCanvas(
            ctx,
            faceLandmarks,
            frameData,
            canvasWidth,
            canvasHeight,
            faceLineWidthMultiplier,
        );
    }
}

const isProduction = process.env.NODE_ENV === 'production';

function readStoredEnergyValue(key) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null || raw === undefined || raw === '') return null;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

const UnifiedSensingUserUI = ({
    stream,
    embeddingTW,
    sessionName,
    sizeMode = 'large',
    showDetectionToggle = false,
    autoStartLandmarkTick = 0,
    forceStopDetectionTick = 0,
    onSensingFeedFrame,
}) => {
    const onSensingFeedFrameRef = useRef(onSensingFeedFrame);
    onSensingFeedFrameRef.current = onSensingFeedFrame;

    const videoRef = useRef(null);
    const intervalIdRef = useRef(null);
    const canvasRef = useRef(null);
    const holisticRef = useRef(null);
    const gestureRecognizerRef = useRef(null);
    const [scan, setScan] = useState(false);
    const [overlayDismissed, setOverlayDismissed] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [modelError, setModelError] = useState(null);
    const [detectorInitialized, setDetectorInitialized] = useState(false);

    const [faceVisible, setFaceVisible] = useState('false');
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
    /** @type {React.MutableRefObject<object|null>} */
    const faceTimelineMergedRef = useRef(null);

    const isOverlayLayout = scan && !overlayDismissed;

    const cameraSize = useMemo(() => {
        if (isOverlayLayout) {
            return 'min(70vmin, calc(100dvh - 15rem), calc(100vw - 2rem))';
        }
        return sizeMode === 'large' ? '160px' : '80px';
    }, [isOverlayLayout, sizeMode]);

    // User-state survey values are currently static during the session (non-dynamic modality).
    const energyModalitySnapshot = useMemo(
        () => ({
            currentEnergy: readStoredEnergyValue('current_energy'),
            targetEnergy: readStoredEnergyValue('target_energy'),
        }),
        []
    );

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

    const loadVisionModels = async () => {
        try {
            const wasmPath = visionTasksWasmBaseUrl(isProduction);
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

    const drawComposite = (faceLandmarks, faceReactions, nodAmp, poseLandmarks, leftHandLm, rightHandLm) => {
        if (!canvasRef.current || !videoRef.current) return;
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth || video.width || 640;
        canvas.height = video.videoHeight || video.height || 480;
        const ctx = canvas.getContext('2d');
        drawHolisticOverlay({
            ctx,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            poseLandmarks,
            leftHandLm,
            rightHandLm,
            faceLandmarks,
            faceReactions,
            nodAmp,
            faceLineWidthMultiplier: sizeMode === 'large' ? 3.5 : 2.5,
            poseLineColor: secondaryColor,
            leftHandRaised: latestLeftHandRaised.current,
            rightHandRaised: latestRightHandRaised.current,
        });
    };

    const runUnifiedFrame = () => {
        if (!videoRef.current || !holisticRef.current || !detectorInitialized) return;
        if (videoRef.current.readyState < 2) return;
        if (detectionInProgressRef.current) return;

        try {
            detectionInProgressRef.current = true;
            const ts = performance.now();
            let gestureLeft = 'None';
            let gestureRight = 'None';
            const r = holisticRef.current.detectForVideo(videoRef.current, ts);

            let faceLandmarks = null;
            let faceReactions = { smiling: 0, jawOpen: 0 };
            let poseLandmarks = null;
            let leftHandLm = r.leftHandLandmarks?.[0] || null;
            let rightHandLm = r.rightHandLandmarks?.[0] || null;

            if (r.faceLandmarks && r.faceLandmarks.length > 0) {
                faceLandmarks = r.faceLandmarks[0];
                const videoWidth = videoRef.current.videoWidth || videoRef.current.width || 640;
                const videoHeight = videoRef.current.videoHeight || videoRef.current.height || 480;
                const { landmarkData, faceReactions: fr, faceBox, confidence } = buildFaceLandmarkSample(
                    faceLandmarks,
                    r.faceBlendshapes?.[0]?.categories,
                    videoWidth,
                    videoHeight,
                );
                faceReactions = fr;
                if (faceBox) {
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
                            recentData.map((d) => d.height),
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

                if (faceBox) {
                    const now = Date.now();
                    faceTimelineMergedRef.current = mergeFaceTimelineWindow(
                        faceTimelineMergedRef.current,
                        {
                            tempLandmarks: [landmarkData.landmarks],
                            tempTimestamps: [landmarkData.timestamp],
                            tempConfidences: [confidence],
                            tempCenterX: [faceBox.position.centerX],
                            tempCenterY: [faceBox.position.centerY],
                            tempWidths: [faceBox.width],
                            tempHeights: [faceBox.height],
                            tempFrequencies: [latestNoddingFrequency.current],
                            tempAmplitudes: [latestNoddingAmplitude.current],
                            tempSmiling: [faceReactions.smiling],
                            tempJawOpen: [faceReactions.jawOpen],
                        },
                        {
                            frequency: latestNoddingFrequency.current,
                            amplitude: latestNoddingAmplitude.current,
                        },
                        now,
                    );
                }
            } else {
                setFaceVisible('false');
                setNoddingFrequency(0);
                setNoddingAmplitude(0);
                latestNoddingFrequency.current = 0;
                latestNoddingAmplitude.current = 0;
                faceTimelineMergedRef.current = null;
                landmarkBuffer.current = [];
            }

            if (r.poseLandmarks && r.poseLandmarks.length > 0) {
                poseLandmarks = r.poseLandmarks[0];
                const leftShoulder = poseLandmarks[11];
                const rightShoulder = poseLandmarks[12];
                const leftWrist = poseLandmarks[15];
                const rightWrist = poseLandmarks[16];
                const poseData = buildPoseLandmarkSample(
                    poseLandmarks,
                    !!(r.poseWorldLandmarks?.length > 0),
                );

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
                                latestLeftHandRaised.current,
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
                                latestRightHandRaised.current,
                            );
                            latestRightHandRaiseFrequency.current = rightHandRaiseResult.frequency;
                            latestRightHandRaiseAmplitude.current = rightHandRaiseResult.amplitude;
                            latestRightHandRaised.current = rightHandRaiseResult.isRaised;
                        }
                        lastHandRaiseCalculation.current = currentTimeMs;
                    }
                    handRaiseBuffer.current = handRaiseBuffer.current.filter((d) => d.timestamp > windowStart);
                }
            } else {
                latestLeftHandRaiseFrequency.current = 0;
                latestLeftHandRaiseAmplitude.current = 0;
                latestLeftHandRaised.current = false;
                latestRightHandRaiseFrequency.current = 0;
                latestRightHandRaiseAmplitude.current = 0;
                latestRightHandRaised.current = false;
            }

            if (gestureRecognizerRef.current) {
                try {
                    const gResult = gestureRecognizerRef.current.recognizeForVideo(videoRef.current, ts);
                    const { left, right } = readLeftRightGestures(gResult);
                    gestureLeft = left;
                    gestureRight = right;
                } catch {
                    /* gesture frame skipped */
                }
            }

            const faceBlob = faceTimelineMergedRef.current;
            const thumbDownActive = gestureLeft === 'Thumb_Down' || gestureRight === 'Thumb_Down';
            const thumbUpActive = !thumbDownActive && (gestureLeft === 'Thumb_Up' || gestureRight === 'Thumb_Up');
            onSensingFeedFrameRef.current?.(
                normalizeReactionSensingFeed({
                    emotionDataArray: emotionDataPointsFromFaceBlob(faceBlob),
                    noddingAmplitude: latestNoddingAmplitude.current,
                    noddingFrequency: latestNoddingFrequency.current,
                    handsRaised: latestLeftHandRaised.current || latestRightHandRaised.current,
                    thumbDownActive,
                    thumbUpActive,
                    currentEnergy: energyModalitySnapshot.currentEnergy,
                    targetEnergy: energyModalitySnapshot.targetEnergy,
                    modalitiesDetail: {
                        userStateSurvey: {
                            currentEnergy: energyModalitySnapshot.currentEnergy,
                            targetEnergy: energyModalitySnapshot.targetEnergy,
                        },
                        nodding: {
                            amplitude: latestNoddingAmplitude.current,
                            frequency: latestNoddingFrequency.current,
                        },
                        handRaise: {
                            left: {
                                isRaised: latestLeftHandRaised.current,
                                amplitude: latestLeftHandRaiseAmplitude.current,
                                frequency: latestLeftHandRaiseFrequency.current,
                            },
                            right: {
                                isRaised: latestRightHandRaised.current,
                                amplitude: latestRightHandRaiseAmplitude.current,
                                frequency: latestRightHandRaiseFrequency.current,
                            },
                        },
                        mediaPipeHandGestures: {
                            left: gestureLeft,
                            right: gestureRight,
                        },
                        faceInstant: {
                            smiling: faceReactions.smiling,
                            jawOpen: faceReactions.jawOpen,
                        },
                        faceTimelineWindow: faceBlob
                            ? {
                                  lastUpdated: faceBlob.lastUpdated,
                                  landmarkCount: faceBlob.landmarkCount,
                                  faceConfidence: faceBlob.faceConfidence,
                                  sampleCount: Array.isArray(faceBlob.timestamps) ? faceBlob.timestamps.length : 0,
                                  noddingFrequency: faceBlob.noddingFrequency,
                                  noddingAmplitude: faceBlob.noddingAmplitude,
                                  smilingIntensity: faceBlob.smilingIntensity,
                                  jawOpenIntensity: faceBlob.jawOpenIntensity,
                              }
                            : null,
                    },
                }),
            );

            drawComposite(
                faceLandmarks,
                faceReactions,
                latestNoddingAmplitude.current,
                poseLandmarks,
                leftHandLm,
                rightHandLm,
            );
        } catch {
            /* one frame failed */
        } finally {
            detectionInProgressRef.current = false;
        }
    };

    const handleToggle = async ({ trackInteraction = false } = {}) => {
        const wasScanning = scan;

        if (trackInteraction) {
            void trackButtonClick(
                wasScanning ? 'stop_detection_button_press' : 'start_detection_button_press',
                window.location.href,
                {
                    session_name: sessionName || getSessionNameFromUrl(),
                    intended_action: wasScanning ? 'stop_detection' : 'start_detection',
                    detector_ready: Boolean(isModelLoaded && detectorInitialized && !modelError)
                }
            );
        }

        if (!wasScanning) {
            setFaceVisible('false');
        }
        setScan(!wasScanning);

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
            faceTimelineMergedRef.current = null;
            onSensingFeedFrameRef.current?.(emptyReactionSensingFeedSnapshot());
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

    const handleRestoreOverlay = () => {
        void trackButtonClick(
            'restore_detection_overlay_button_press',
            window.location.href,
            {
                session_name: sessionName || getSessionNameFromUrl(),
                intended_action: 'restore_detection_overlay',
            }
        );
        setOverlayDismissed(false);
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
        void handleToggle({ trackInteraction: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- tick-driven start
    }, [autoStartLandmarkTick, scan, isModelLoaded, detectorInitialized, modelError]);

    const lastStopTick = useRef(0);
    useEffect(() => {
        if (!forceStopDetectionTick || forceStopDetectionTick <= lastStopTick.current) return;
        lastStopTick.current = forceStopDetectionTick;
        if (!scan) return;
        void handleToggle({ trackInteraction: false });
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
            faceTimelineMergedRef.current = null;
            onSensingFeedFrameRef.current?.(emptyReactionSensingFeedSnapshot());
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
            {scan && overlayDismissed && (
                <div
                    style={{
                        position: 'absolute',
                        top: '0.75rem',
                        right: '0.75rem',
                        zIndex: 10,
                    }}
                >
                    <button
                        type="button"
                        onClick={handleRestoreOverlay}
                        aria-label="Restore sensing overlay fullscreen view"
                        title="Fullscreen sensing overlay"
                        style={{
                            width: '2.4rem',
                            height: '2.4rem',
                            borderRadius: '999px',
                            border: '1px solid rgba(255,255,255,0.6)',
                            background: 'rgba(0,0,0,0.6)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '1.1rem',
                            lineHeight: 1,
                        }}
                    >
                        <span aria-hidden="true">⛶</span>
                    </button>
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
                    {showDetectionToggle && (
                        <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap">
                            <PlayPauseButton
                                onClick={() => void handleToggle({ trackInteraction: true })}
                                isPlaying={scan}
                                size={transportBtnSize}
                                tooltipText={scan ? 'Stop detection' : 'Start detection'}
                                isEnabled={
                                    isModelLoaded &&
                                    detectorInitialized &&
                                    !modelError
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
                    )}
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
