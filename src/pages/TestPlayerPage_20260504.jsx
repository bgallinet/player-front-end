import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import Player from '../components/player/Player';
import Forms from '../components/Form';
import TutorialMessage from '../components/TutorialMessage';
import { fetchLatestEnergySurveyFromUserEndpoint } from '../music_adaptation/policy/serverDeclarativeRules';
import EnvironmentVariables from '../EnvironmentVariables';
import { useAuth } from '../contexts/AuthContext';
import { ANALYTICS_SESSION_OVERRIDE_KEY } from '../hooks/sessionUtils';
import { useAdaptationPolicy } from '../music_adaptation/hooks/useAdaptationPolicy';
import { activateExperiment, deactivateExperiment } from '../utils/experimentSession';
import {
    buildSequencePlaylist,
    fetchExperimentConfigFromAnalytics,
} from '../utils/fetchExperimentConfigFromAnalytics';
import ModeCThumbTempoOverrideButtons from '../components/test_player/ModeCThumbTempoOverrideButtons';
import { trackSimpleEvent } from '../hooks/simpleTracker';

const TEST_CLOUDFRONT_URL =
    process.env.REACT_APP_TEST_TRACKS_CDN_URL || 'https://dhuj2x4ippvty.cloudfront.net';

/** DB `experiments.id` — must match `controlled_experiments.csv` */
const EXPERIMENT_DB_ID = '20260504';

export const adaptation_modes_sequence = ['Mode C', 'Mode B', 'Mode A'];

/**
 * Returns a randomized copy of the provided adaptation mode sequence.
 * Uses Fisher-Yates shuffle and keeps the input array unchanged.
 */
export function randomizeAdaptationModesSequence(sequence = adaptation_modes_sequence) {
    const randomized = [...sequence];
    for (let i = randomized.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [randomized[i], randomized[j]] = [randomized[j], randomized[i]];
    }
    return randomized;
}

function buildExperimentMetadataForMode(modeName) {
    const normalizedMode =
        modeName === 'Mode A' || modeName === 'Mode B' || modeName === 'Mode C'
            ? modeName
            : 'Mode A';
    return {
        variant: normalizedMode,
        is_control: normalizedMode === 'Mode A',
    };
}

/** crossOrigin must be set before src so the first byte request uses CORS (required for Web Audio). */
function loadAudioElementSource(audioEl, url, options = {}) {
    if (!audioEl || !url) return;
    const anonymousCors = options.anonymousCors === true;
    audioEl.pause();
    audioEl.crossOrigin = anonymousCors ? 'anonymous' : null;
    audioEl.src = url;
    audioEl.load();
}

const TestPlayerPage_20260504 = () => {
    const { idToken } = useAuth();
    const [showInitialEnergySurvey, setShowInitialEnergySurvey] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);
    const [playlist, setPlaylist] = useState([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
    const [showEvaluationForm, setShowEvaluationForm] = useState(false);
    const [redirectToHomepageAfterEvaluationSubmit, setRedirectToHomepageAfterEvaluationSubmit] = useState(false);
    const [showAfterBlockSurvey, setShowAfterBlockSurvey] = useState(false);
    const [showSequenceTutorial, setShowSequenceTutorial] = useState(false);
    const [tracksLoadError, setTracksLoadError] = useState('');
    const [currentAdaptationModeIndex, setCurrentAdaptationModeIndex] = useState(0);
    const audioRef = useRef(null);
    const thumbBpmControlRef = useRef(null);
    const blockTrackTimerRef = useRef(null);
    const blockTrackStepRef = useRef(0);
    const isAutoSwitchingTrackRef = useRef(false);
    // TODO: restore random mode order — temporarily fixed C → B → A
    const randomizedAdaptationModesSequence = adaptation_modes_sequence;
    // const randomizedAdaptationModesSequence = useMemo(
    //     () => randomizeAdaptationModesSequence(adaptation_modes_sequence),
    //     []
    // );
    const currentAdaptationMode =
        randomizedAdaptationModesSequence[currentAdaptationModeIndex] ?? randomizedAdaptationModesSequence[0];
    console.log('[TestPlayerPage] chosen adaptation mode:', currentAdaptationMode);
    const experimentId = EXPERIMENT_DB_ID;
    const {
        policyInstance: reactionPolicyInstance,
        loading: policyLoading,
        error: policyLoadError,
    } = useAdaptationPolicy({
        experimentId: EXPERIMENT_DB_ID,
        variantId: currentAdaptationMode,
        idToken,
        enabled: !showInitialEnergySurvey,
    });
    const currentExperimentMetadata = useMemo(
        () => buildExperimentMetadataForMode(currentAdaptationMode),
        [currentAdaptationMode]
    );
    const analyticsSessionName = 'test_20260504';

    const handleModeCTempoStep = useCallback(
        (direction) => {
            const commandType = direction === 'up' ? 'thumbs_up' : 'thumbs_down';
            void trackSimpleEvent({
                interaction_type: commandType,
                element_id: direction === 'up' ? 'mode_c_tempo_up_button' : 'mode_c_tempo_down_button',
                session_name: analyticsSessionName,
                page_url: window.location.href,
                timestamp: Date.now(),
                command_type: commandType,
                context: {
                    trigger: 'mode_c_tempo_button',
                    direction,
                    adaptation_mode: currentAdaptationMode,
                    experiment_id: experimentId,
                    song_id: selectedFile?.songId ?? null,
                    song_name: selectedFile?.title ?? null,
                    song_artist: selectedFile?.artist ?? null,
                },
            });
        },
        [analyticsSessionName, currentAdaptationMode, experimentId, selectedFile],
    );
    const [sequenceConfig, setSequenceConfig] = useState(null);
    const [sequenceConfigError, setSequenceConfigError] = useState('');
    const [catalogTrackRows, setCatalogTrackRows] = useState([]);

    useLayoutEffect(() => {
        try {
            sessionStorage.setItem(ANALYTICS_SESSION_OVERRIDE_KEY, analyticsSessionName);
        } catch {
            // Ignore storage failures.
        }
        return () => {
            try {
                const currentOverride = sessionStorage.getItem(ANALYTICS_SESSION_OVERRIDE_KEY);
                if (currentOverride === analyticsSessionName) {
                    sessionStorage.removeItem(ANALYTICS_SESSION_OVERRIDE_KEY);
                }
            } catch {
                // Ignore storage failures.
            }
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        void fetchExperimentConfigFromAnalytics(EXPERIMENT_DB_ID)
            .then((cfg) => {
                if (cancelled) return;
                setSequenceConfig(cfg);
                setSequenceConfigError('');
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('[TestPlayerPage] experiment config:', err);
                setSequenceConfig(null);
                setSequenceConfigError(
                    err?.message || 'Failed to load BPM experiment sequence from server',
                );
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (showInitialEnergySurvey) {
            return undefined;
        }
        activateExperiment({
            experimentId,
            variant: currentExperimentMetadata.variant,
            is_control: currentExperimentMetadata.is_control,
            experiment_config: {},
        });
        return () => {
            deactivateExperiment();
        };
    }, [
        showInitialEnergySurvey,
        experimentId,
        currentAdaptationMode,
        currentExperimentMetadata.variant,
        currentExperimentMetadata.is_control,
    ]);

    useEffect(() => {
        if (showInitialEnergySurvey) return;
        if (currentAdaptationMode !== 'Mode B') return;
        void fetchLatestEnergySurveyFromUserEndpoint(idToken).then((value) => {
            console.log('[TestPlayerPage][Mode B] refreshed latest_energy_survey before sequence', { value });
        });
    }, [currentAdaptationMode, idToken, showInitialEnergySurvey]);

    const finalFeedbackIntro =
        'Thank you for your participation. Before ending this test session, we need from you to answer these questions.';
    const evaluationQuestions = [
        'Rank the 3 sequences (1 best to 3 worst).',
        'Most of the time, I wanted the music to...',
        'This sequence best matched my energy:',
        'This sequence best helped me shift my energy level.',
        'Contexts where it could work best:',
        'Please specify:',
        'What should be improved?',
        'Is there anything else you would like to share?',
    ];

    const evaluationInputTypes = ['ranking', 'choice', 'choice', 'choice', 'choice', 'comment', 'comment', 'comment'];
    const evaluationQuestionKinds = evaluationQuestions.map(() => 'evaluation');
    const evaluationChoiceOptions = [
        ['Sequence 1', 'Sequence 2', 'Sequence 3'],
        ['Match my energy', 'Help me shift my energy', 'Depends on the situation'],
        ['1', '2', '3', "Not applicable (wasn't trying to)"],
        ['1', '2', '3', "Not applicable (Wasn't trying to)"],
        ['Work/focus', 'Commute', 'Relaxation', 'Sport/light exercise', 'Social/background', 'Other'],
        [],
        [],
        [],
    ];
    const afterBlockSurveyQuestions = [
        'In what I just heard, the tempo matched my need.',
        'In what I just heard, the tempo felt natural.',
        'It took effort to go through this sequence.',
        'What is your energy level right now? (0-10)',
        'What is your stress level?',
    ];
    const afterBlockSurveyInputTypes = ['scale', 'scale', 'scale', 'scale', 'scale'];
    const afterBlockSurveyQuestionKinds = [
        'evaluation',
        'evaluation',
        'evaluation',
        'user_state',
        'user_state',
    ];
    const afterBlockSurveyScaleLabelTypes = [
        'agreement',
        'agreement',
        'agreement',
        'low_high',
        'low_high',
    ];
    const afterBlockSurveyChoiceOptions = [[], [], [], [], []];
    const initialSurveyQuestions = [
        'Did you consume caffeine or alcohol in the last few hours?',
        'How did you sleep last night?',
        'What is your stress level?',
        'What is your energy level right now? (0-10)',
        'Where are you right now?',
        'Please specify',
        'Are you using headphones?',
    ];
    const initialSurveyInputTypes = [
        'choice',
        'choice',
        'scale',
        'scale',
        'choice',
        'comment',
        'choice',
    ];
    const initialSurveyQuestionKinds = [
        'user_state',
        'user_state',
        'user_state',
        'user_state',
        'user_state',
        'evaluation',
        'evaluation',
    ];
    const initialSurveyChoiceOptions = [
        ['No', 'Caffeine only', 'Alcohol only', 'Both caffeine and alcohol'],
        ['Very poorly', 'Poorly', 'Okay', 'Well', 'Very well'],
        [],
        [],
        ['In the car', 'At home', 'Outdoors', 'At work', 'Other'],
        [],
        ['Yes', 'No'],
    ];
    const initialSurveyScaleLabelTypes = [
        'agreement',
        'agreement',
        'low_high',
        'low_high',
        'agreement',
        'agreement',
        'agreement',
    ];

    const getSequenceTutorialMessages = (modeIndex, modeName) => {
        const totalSequenceSeconds = (sequenceConfig?.durationSecondsByTrack ?? []).reduce(
            (sum, sec) => {
                const n = Number(sec);
                return sum + (Number.isFinite(n) && n > 0 ? n : 0);
            },
            0,
        );
        const sequenceDurationSecondsLabel =
            totalSequenceSeconds > 0 ? String(Math.floor(totalSequenceSeconds)) : '…';

        const sequenceCount = 3;
        const surveyCount = 5; // initial + after each sequence + final evaluation
        const estimatedTestMinutes =
            totalSequenceSeconds > 0
                ? Math.floor((sequenceCount * totalSequenceSeconds) / 60) + surveyCount
                : null;
        const estimatedTestMinutesLabel =
            estimatedTestMinutes != null ? String(estimatedTestMinutes) : '…';

        const modeSpecificPages = (() => {
            if (modeName === 'Mode C') {
                return [
                    'In this sequence, you can press Tempo up or Tempo down buttons.',
                    'You can modify further tempo up or down until it feels right.',
                ];
            }
            if (modeName === 'Mode A') {
                return ['In this sequence the music tempo is not adjustable.'];
            }
            if (modeName === 'Mode B') {
                return ['In this sequence the music tempo is not adjustable.'];
            }
            return [];
        })();

        if (modeIndex === 1) {
            return [
                ...modeSpecificPages,
                'When you are ready for hearing the second sequence, click on Play.',
            ];
        }
        if (modeIndex === 2) {
            return [
                ...modeSpecificPages,
                'When you are ready for hearing the third sequence, click on Play.',
            ];
        }
        return [
            `You will hear three sequences. All sequences play the same three songs and have a duration of ${sequenceDurationSecondsLabel} seconds. For each sequence, you can interact differently with the music.`,
            'During sequences, your movements and reactions will be recorded, but NOT your video. You will be able to see in real time what is recorded.',
            'At the end of each sequence, you will answer a few short questions about how you feel.',
            `At the end of this test, you will be asked to rate the sequences. The total duration of this test is estimated to ${estimatedTestMinutesLabel} minutes.`,
            ...modeSpecificPages,
            'Let us start with the first sequence. When you are ready, click on Play.',
        ];
    };

    const toPlaylistRows = (tracks) =>
        tracks
            .map((track) => {
                if (!track || typeof track !== 'object') return null;
                const normalizedTrack = {
                    id: track.id ?? track.track_id ?? track.trackId,
                    title: track.title ?? track.Title,
                    artist: track.artist ?? track.Artist,
                    file_name: track.file_name ?? track.fileName ?? track['File name'],
                    bpm: track.bpm ?? track.BPM,
                };
                return normalizedTrack;
            })
            .filter((track) => track?.file_name)
            .map((track, index) => {
                const trackId = track.id ?? (index + 1);
                const title = track.title || `Track ${trackId}`;
                const artist = track.artist || 'Unknown Artist';
                const fileName = track.file_name;
                return {
                    id: `test-seq-${trackId}`,
                    songId: trackId,
                    name: `${title} - ${artist}`,
                    title,
                    artist,
                    fileName,
                    bpm: Number.isFinite(Number(track.bpm)) ? Number(track.bpm) : null,
                    url: `${TEST_CLOUDFRONT_URL}/${encodeURIComponent(fileName)}`,
                    duration: 0,
                };
            });

    const persistOriginalBpmFromApi = (track) => {
        const originalBpm = Number(track?.bpm);
        if (Number.isFinite(originalBpm) && originalBpm > 0) {
            localStorage.setItem('calibration_original_bpm', String(originalBpm));
        } else {
            localStorage.removeItem('calibration_original_bpm');
        }
    };

    // Initialize playlist from backend info endpoint.
    useEffect(() => {
        let isCancelled = false;
        let timer = null;

        const fetchTracks = async () => {
            try {
                setTracksLoadError('');
                const headers = { 'Content-Type': 'application/json' };
                if (idToken) {
                    headers.Authorization = `Bearer ${idToken}`;
                }

                const response = await fetch(EnvironmentVariables.InfoAPI_URL, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        request_type: 'info',
                        info_type: 'songs',
                        body: {
                            request_type: 'info',
                            info_type: 'songs',
                        },
                    }),
                });
                console.log('[TestPlayerPage] /info response status:', response.status);

                if (!response.ok) {
                    let errorDetails = '';
                    try {
                        const errorPayload = await response.json();
                        console.log('[TestPlayerPage] /info error payload:', errorPayload);
                        if (errorPayload?.error) {
                            errorDetails = `: ${errorPayload.error}`;
                        }
                    } catch {
                        // Ignore JSON parse errors and keep status-only message.
                    }
                    throw new Error(`Info API failed with status ${response.status}${errorDetails}`);
                }

                const payload = await response.json();
                console.log('[TestPlayerPage] /info payload:', payload);

                // Support both normalized API responses and legacy wrapped body payloads.
                let rawTracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
                if (!rawTracks.length && Array.isArray(payload?.body?.tracks)) {
                    rawTracks = payload.body.tracks;
                }
                if (!rawTracks.length && typeof payload?.body === 'string') {
                    try {
                        const parsedBody = JSON.parse(payload.body);
                        rawTracks = Array.isArray(parsedBody?.tracks) ? parsedBody.tracks : [];
                    } catch {
                        rawTracks = [];
                    }
                }
                console.log('[TestPlayerPage] raw tracks extracted:', rawTracks);

                const rows = toPlaylistRows(rawTracks);
                console.log('[TestPlayerPage] catalog rows normalized:', rows);
                if (isCancelled) return;
                if (rows.length === 0) {
                    throw new Error('Songs API returned no tracks');
                }

                setCatalogTrackRows(rows);
            } catch (error) {
                console.error('Failed to load test-player songs from info endpoint:', error);
                if (isCancelled) return;
                setCatalogTrackRows([]);
                setPlaylist([]);
                setCurrentTrackIndex(-1);
                setSelectedFile(null);
                setTracksLoadError(`Unable to load songs from API. ${error?.message || ''}`.trim());
            }
        };

        fetchTracks();

        return () => {
            isCancelled = true;
            if (timer) clearTimeout(timer);
            if (blockTrackTimerRef.current) {
                clearTimeout(blockTrackTimerRef.current);
            }
        };
    }, [idToken]);

    useEffect(() => {
        if (!catalogTrackRows.length) {
            return;
        }
        const trackIds = sequenceConfig?.trackIds;
        const ordered = trackIds?.length
            ? buildSequencePlaylist(catalogTrackRows, trackIds, (track) => track.songId)
            : catalogTrackRows;
        setPlaylist(ordered);
        setCurrentTrackIndex(-1);
        setSelectedFile(null);
    }, [catalogTrackRows, sequenceConfig?.trackIds]);

    const prepareSequenceStart = () => {
        const firstTrack = playlist[0];
        if (!firstTrack?.url) return;
        blockTrackStepRef.current = 0;
        setCurrentTrackIndex(0);
        setSelectedFile(firstTrack);
        persistOriginalBpmFromApi(firstTrack);
        if (audioRef.current) {
            loadAudioElementSource(audioRef.current, firstTrack.url, { anonymousCors: true });
            audioRef.current.currentTime = 0;
        }
    };

    // Handle music play event for active sequence.
    const handleMusicPlay = () => {
        scheduleNextTrackTransition();
    };

    // Handle music pause/stop - cancel transition timer.
    const handleMusicPause = () => {
        if (isAutoSwitchingTrackRef.current) {
            return;
        }
        clearBlockTrackTimer();
    };

    const handleTestSequenceTrackSelect = (track, index) => {
        if (!track?.url) return;
        setSelectedFile(track);
        setCurrentTrackIndex(index);
        persistOriginalBpmFromApi(track);
        if (audioRef.current) {
            loadAudioElementSource(audioRef.current, track.url, { anonymousCors: true });
        }
    };

    const clearBlockTrackTimer = () => {
        if (blockTrackTimerRef.current) {
            clearTimeout(blockTrackTimerRef.current);
            blockTrackTimerRef.current = null;
        }
    };

    const scheduleNextTrackTransition = () => {
        clearBlockTrackTimer();
        const step = blockTrackStepRef.current;
        const durations = sequenceConfig?.durationSecondsByTrack ?? [];
        const seconds = durations[step] ?? 60;
        blockTrackTimerRef.current = setTimeout(() => {
            playNextTrackInBlock();
        }, seconds * 1000);
    };

    const playTrackByIndex = (index) => {
        const track = playlist[index];
        const audioEl = audioRef.current;
        if (!track?.url || !audioEl) return;
        isAutoSwitchingTrackRef.current = true;

        const finalizeSwitchAttempt = () => {
            isAutoSwitchingTrackRef.current = false;
            scheduleNextTrackTransition();
        };

        const tryPlay = () => {
            void audioEl.play().then(() => {
                finalizeSwitchAttempt();
            }).catch(() => {
                // Keep fallback listeners/retries active.
            });
        };

        const autoplayWhenReady = () => {
            tryPlay();
        };

        audioEl.addEventListener('loadedmetadata', autoplayWhenReady, { once: true });
        audioEl.addEventListener('canplay', autoplayWhenReady, { once: true });
        handleTestSequenceTrackSelect(track, index);

        // Immediate attempt + short retry window to handle timing races across browsers.
        tryPlay();
        let retryCount = 0;
        const retryInterval = setInterval(() => {
            if (!isAutoSwitchingTrackRef.current) {
                clearInterval(retryInterval);
                return;
            }
            retryCount += 1;
            tryPlay();
            if (retryCount >= 10) {
                clearInterval(retryInterval);
                finalizeSwitchAttempt();
            }
        }, 200);
    };

    const playNextTrackInBlock = () => {
        const nextStep = blockTrackStepRef.current + 1;
        if (nextStep >= playlist.length) {
            clearBlockTrackTimer();
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setShowAfterBlockSurvey(true);
            return;
        }
        const nextTrack = playlist[nextStep];
        if (!nextTrack?.url) {
            clearBlockTrackTimer();
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            return;
        }
        blockTrackStepRef.current = nextStep;
        playTrackByIndex(nextStep);
    };

    return (
        <>
            {!showInitialEnergySurvey && policyLoading && (
                <div className="text-center text-light py-5">Loading adaptation policy…</div>
            )}
            {!showInitialEnergySurvey && !policyLoading && reactionPolicyInstance && (
                <Player
                    key={`sequence-mode-${currentAdaptationModeIndex}-${reactionPolicyInstance.policyId || 'policy'}`}
                    selectedFile={selectedFile}
                    sessionName="TestPlayer_20260504"
                    audioRef={audioRef}
                    thumbBpmControlRef={thumbBpmControlRef}
                    initialReactionPolicyInstance={reactionPolicyInstance}
                    playlist={playlist}
                    currentTrackIndex={currentTrackIndex}
                    onTrackSelect={handleTestSequenceTrackSelect}
                    onMusicPlay={handleMusicPlay}
                    onMusicPause={handleMusicPause}
                    showDeckArtwork={false}
                    enableSensingOverlayOnScan={false}
                    enableSecondDeck={false}
                    enableTrackNavigation={false}
                    enableStopButton={false}
                    showTutorialButton={true}
                    onTutorialButtonClick={() => setShowSequenceTutorial(true)}
                    sensingHeaderContent={
                        <ModeCThumbTempoOverrideButtons
                            show={currentAdaptationMode === 'Mode C'}
                            thumbBpmControlRef={thumbBpmControlRef}
                            onTempoStep={handleModeCTempoStep}
                        />
                    }
                >
                    {(tracksLoadError || sequenceConfigError || policyLoadError) && (
                        <div className="text-center mb-4">
                            {tracksLoadError && (
                                <div className="text-danger w-100 mb-2">{tracksLoadError}</div>
                            )}
                            {sequenceConfigError && (
                                <div className="text-danger w-100 mb-2">{sequenceConfigError}</div>
                            )}
                            {policyLoadError && (
                                <div className="text-warning w-100 mb-2">
                                    Policy fallback (server): {policyLoadError}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Evaluation form modal */}
                    <Forms
                        introText={finalFeedbackIntro}
                        questions={evaluationQuestions}
                        inputTypes={evaluationInputTypes}
                        questionKinds={evaluationQuestionKinds}
                        choiceOptions={evaluationChoiceOptions}
                        optionalQuestionIndices={[5, 6, 7]}
                        experimentId={experimentId}
                        formMetadata={currentExperimentMetadata}
                        sessionName={null}
                        show={showEvaluationForm}
                        onHide={() => {
                            setShowEvaluationForm(false);
                            if (redirectToHomepageAfterEvaluationSubmit) {
                                window.location.href = '/';
                            }
                        }}
                        disableSubmission={false}
                    />
                </Player>
            )}
            <Forms
                questions={afterBlockSurveyQuestions}
                inputTypes={afterBlockSurveyInputTypes}
                questionKinds={afterBlockSurveyQuestionKinds}
                choiceOptions={afterBlockSurveyChoiceOptions}
                scaleLabelTypes={afterBlockSurveyScaleLabelTypes}
                scaleMin={0}
                scaleMax={10}
                optionalQuestionIndices={[]}
                formCategory="after_sequence_survey"
                experimentId={experimentId}
                formMetadata={currentExperimentMetadata}
                sessionName={analyticsSessionName}
                show={showAfterBlockSurvey}
                onHide={() => {
                    setShowAfterBlockSurvey(false);
                    if (currentAdaptationModeIndex >= adaptation_modes_sequence.length - 1) {
                        setRedirectToHomepageAfterEvaluationSubmit(true);
                        setShowEvaluationForm(true);
                        return;
                    }
                    const nextModeIndex = Math.min(
                        currentAdaptationModeIndex + 1,
                        adaptation_modes_sequence.length - 1
                    );
                    setCurrentAdaptationModeIndex(nextModeIndex);
                    setShowSequenceTutorial(true);
                }}
                disableSubmission={false}
            />
            <Forms
                questions={initialSurveyQuestions}
                inputTypes={initialSurveyInputTypes}
                questionKinds={initialSurveyQuestionKinds}
                choiceOptions={initialSurveyChoiceOptions}
                scaleLabelTypes={initialSurveyScaleLabelTypes}
                scaleMin={0}
                scaleMax={10}
                optionalQuestionIndices={[5]}
                formCategory="user_state_survey"
                experimentId={experimentId}
                formMetadata={currentExperimentMetadata}
                sessionName={analyticsSessionName}
                show={showInitialEnergySurvey}
                onHide={() => {
                    setShowInitialEnergySurvey(false);
                    setShowSequenceTutorial(true);
                }}
                disableSubmission={false}
            />
            {showSequenceTutorial && (
                <TutorialMessage
                    messages={getSequenceTutorialMessages(currentAdaptationModeIndex, currentAdaptationMode)}
                    position="top-center"
                    forceShow
                    onClose={() => {
                        setShowSequenceTutorial(false);
                        prepareSequenceStart();
                    }}
                />
            )}
        </>
    );
};

export default TestPlayerPage_20260504;
