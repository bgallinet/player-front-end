import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import { Container, Spinner } from 'react-bootstrap';
import Player from '../components/player/Player';
import Forms from '../components/Form';
import TutorialMessage from '../components/TutorialMessage';
import SpotifyPlaylistChoice from '../components/library_panels/SpotifyPlaylistChoice';
import magicPlayerImage from '../images/logo_small.png';
import {
    ENERGY_SURVEY_LOCAL_STORAGE_KEY,
    fetchLatestEnergySurveyFromUserEndpoint,
} from '../music_adaptation/policy/serverDeclarativeRules';
import {
    getSpotifyPlaylistSelectionForMode,
    selectSpotifyPlaylistTracks,
} from '../music_adaptation/policy/spotifyPlaylistSelection';
import { useSpotifyAuth } from '../contexts/SpotifyAuthContext';
import { ANALYTICS_SESSION_OVERRIDE_KEY } from '../hooks/sessionUtils';
import { useAdaptationPolicy } from '../music_adaptation/hooks/useAdaptationPolicy';
import { useSpotifyWebPlayback } from '../hooks/useSpotifyWebPlayback';
import { activateExperiment, deactivateExperiment } from '../utils/experimentSession';
import {
    fetchExperimentConfigFromAnalytics,
} from '../utils/fetchExperimentConfigFromAnalytics';
import { bridgeAudioElementToSpotify } from '../utils/spotifyPlayback';
import { enrichSpotifyTrackWithBpm, dispatchTrackBpmDetected } from '../utils/spotifyBpm';
/** DB `experiments.id` — must match `controlled_experiments.csv` (20260518 row) */
const EXPERIMENT_DB_ID = '20260518';

/** Two variants for experiment 20260518 (see variants.csv). */
export const adaptation_modes_sequence = ['Mode B', 'Mode A'];

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
        modeName === 'Mode A' || modeName === 'Mode B' ? modeName : 'Mode A';
    return {
        variant: normalizedMode,
        is_control: normalizedMode === 'Mode A',
    };
}

const TestPlayerPage_20260518 = () => {
    const {
        accessToken,
        user,
        isAuthenticated: spotifyAuthenticated,
        isLoading: spotifyAuthLoading,
    } = useSpotifyAuth();
    const {
        isReady: playbackReady,
        isPaused: spotifyIsPaused,
        playUri,
        pause,
        resume,
        seek,
        getCurrentState,
    } = useSpotifyWebPlayback(accessToken);

    // TODO: revert to true — intro survey hidden temporarily for testing
    const [showInitialEnergySurvey, setShowInitialEnergySurvey] = useState(false);
    const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
    const [chosenSpotifyPlaylistName, setChosenSpotifyPlaylistName] = useState('');
    const [chosenSpotifyPlaylistId, setChosenSpotifyPlaylistId] = useState('');
    const [streamLoading, setStreamLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [playlist, setPlaylist] = useState([]);
    const [userSpotifyTracks, setUserSpotifyTracks] = useState([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
    const [showEvaluationForm, setShowEvaluationForm] = useState(false);
    const [redirectToHomepageAfterEvaluationSubmit, setRedirectToHomepageAfterEvaluationSubmit] = useState(false);
    const [showAfterBlockSurvey, setShowAfterBlockSurvey] = useState(false);
    const [showSequenceTutorial, setShowSequenceTutorial] = useState(false);
    const [tracksLoadError, setTracksLoadError] = useState('');
    const [currentAdaptationModeIndex, setCurrentAdaptationModeIndex] = useState(0);
    const audioRef = useRef(null);
    const playlistRef = useRef([]);
    const userSpotifyTracksRef = useRef([]);
    const bpmDetectGenByTrackRef = useRef(new Map());
    const playlistBpmPrefetchKeyRef = useRef('');
    const playlistAnalyticsContextRef = useRef(null);
    const bpmResolveChainRef = useRef(Promise.resolve());
    const [playlistBpmsReady, setPlaylistBpmsReady] = useState(false);
    const spotifyTransport = useRef({ playUri, pause, resume, seek, getCurrentState });
    spotifyTransport.current = { playUri, pause, resume, seek, getCurrentState };
    const blockTrackTimerRef = useRef(null);
    const blockTrackStepRef = useRef(0);
    const isAutoSwitchingTrackRef = useRef(false);
    const pendingSequenceStartRef = useRef(false);
    const randomizedAdaptationModesSequence = useMemo(
        () => randomizeAdaptationModesSequence(adaptation_modes_sequence),
        []
    );
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
        idToken: null,
        enabled: !showInitialEnergySurvey,
    });
    const currentExperimentMetadata = useMemo(
        () => buildExperimentMetadataForMode(currentAdaptationMode),
        [currentAdaptationMode]
    );
    const analyticsSessionName = 'test_20260518';
    const [sequenceConfig, setSequenceConfig] = useState(null);
    const [sequenceConfigError, setSequenceConfigError] = useState('');

    const experimentSongCount = sequenceConfig?.songCount ?? 3;
    const durationSecondsByTrack = useMemo(() => {
        const fromConfig = sequenceConfig?.durationSecondsByTrack;
        if (Array.isArray(fromConfig) && fromConfig.length > 0) {
            return fromConfig;
        }
        return Array.from({ length: experimentSongCount }, () => 60);
    }, [sequenceConfig?.durationSecondsByTrack, experimentSongCount]);

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
                    err?.message || 'Failed to load experiment configuration from server',
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
        void fetchLatestEnergySurveyFromUserEndpoint(null).then((value) => {
            console.log('[TestPlayerPage][Mode B] refreshed latest_energy_survey before sequence', { value });
        });
    }, [currentAdaptationMode, showInitialEnergySurvey]);

    useEffect(() => {
        const el = audioRef.current;
        if (!el || !playbackReady) return undefined;
        return bridgeAudioElementToSpotify(el, spotifyTransport.current);
    }, [playbackReady, playUri, pause, resume, seek, getCurrentState]);

    const spotifyMarket = user?.country || undefined;
    const spotifySessionReady = spotifyAuthenticated && playlist.length > 0 && !showPlaylistPicker;

    useEffect(() => {
        if (showInitialEnergySurvey || spotifyAuthLoading) return;
        if (!spotifyAuthenticated) return;
        if (userSpotifyTracks.length === 0) {
            setShowPlaylistPicker(true);
        }
    }, [showInitialEnergySurvey, spotifyAuthLoading, spotifyAuthenticated, userSpotifyTracks.length]);

    const handleInitialSurveyComplete = useCallback(() => {
        setShowInitialEnergySurvey(false);
        void fetchLatestEnergySurveyFromUserEndpoint(null).finally(() => {
            if (userSpotifyTracks.length === 0 && playlist.length === 0) {
                setShowPlaylistPicker(true);
            }
        });
    }, [playlist.length, userSpotifyTracks.length]);

    useEffect(() => {
        playlistRef.current = playlist;
    }, [playlist]);

    useEffect(() => {
        userSpotifyTracksRef.current = userSpotifyTracks;
    }, [userSpotifyTracks]);

    const getTrackFromPlaylist = useCallback((trackId) => {
        if (!trackId) return null;
        const match = (list) =>
            list.find((t) => t?.id === trackId || t?.songId === trackId) || null;
        return (
            match(userSpotifyTracksRef.current) ||
            match(playlistRef.current)
        );
    }, []);

    const patchTrackInState = useCallback((trackId, patch) => {
        if (!trackId) return;
        const applyPatch = (t) =>
            t?.id === trackId || t?.songId === trackId ? { ...t, ...patch } : t;
        setUserSpotifyTracks((prev) => {
            const next = prev.map(applyPatch);
            userSpotifyTracksRef.current = next;
            return next;
        });
        setPlaylist((prev) => {
            const next = prev.map(applyPatch);
            playlistRef.current = next;
            return next;
        });
        setSelectedFile((prev) =>
            prev?.id === trackId || prev?.songId === trackId ? { ...prev, ...patch } : prev,
        );
    }, []);

    const applyResolvedBpmToTrack = useCallback(
        (trackId, enriched) => {
            if (!trackId || !enriched?.bpm) return;
            dispatchTrackBpmDetected(audioRef.current, enriched.bpm);
            patchTrackInState(trackId, {
                bpm: enriched.bpm,
                track_bpm: enriched.bpm,
                bpmSource: enriched.bpmSource || 'preview',
                bpmPending: false,
                preview_url: enriched.preview_url ?? undefined,
                spTrack: enriched.spTrack,
            });
        },
        [patchTrackInState],
    );

    const resolveTrackBpmNow = useCallback(
        async (track, { allowMediaElement = true, positionIndex } = {}) => {
            const trackId = track?.id;
            if (!trackId) return;

            const latest = getTrackFromPlaylist(trackId) || track;
            const existing = Number(latest?.bpm ?? latest?.track_bpm);
            if (Number.isFinite(existing) && existing > 0) return;

            const nextGen = (bpmDetectGenByTrackRef.current.get(trackId) || 0) + 1;
            bpmDetectGenByTrackRef.current.set(trackId, nextGen);
            patchTrackInState(trackId, { bpmPending: true });

            const baseContext = playlistAnalyticsContextRef.current;
            const analyticsContext = baseContext
                ? {
                      ...baseContext,
                      positionIndex:
                          positionIndex != null ? positionIndex : baseContext.positionIndex,
                  }
                : null;

            try {
                const enriched = await enrichSpotifyTrackWithBpm(latest, {
                    accessToken,
                    market: spotifyMarket,
                    allowMediaElement,
                    analyticsContext,
                });
                if (bpmDetectGenByTrackRef.current.get(trackId) !== nextGen) return;
                if (enriched?.bpm) {
                    applyResolvedBpmToTrack(trackId, enriched);
                    return;
                }
                patchTrackInState(trackId, {
                    bpmPending: false,
                    preview_url: enriched?.preview_url ?? undefined,
                    spTrack: enriched?.spTrack,
                });
            } catch (err) {
                console.warn('[TestPlayerPage] BPM resolve failed:', trackId, err);
                if (bpmDetectGenByTrackRef.current.get(trackId) === nextGen) {
                    patchTrackInState(trackId, { bpmPending: false });
                }
            }
        },
        [accessToken, applyResolvedBpmToTrack, getTrackFromPlaylist, patchTrackInState, spotifyMarket],
    );

    /** One track at a time — shared queue so preview detection never runs in parallel. */
    const resolveTrackBpm = useCallback(
        (track, options = {}) => {
            const run = () => resolveTrackBpmNow(track, options);
            const next = bpmResolveChainRef.current.then(run, run);
            bpmResolveChainRef.current = next.catch(() => {});
            return next;
        },
        [resolveTrackBpmNow],
    );

    const detectTrackBpm = useCallback(
        (track, options) => {
            const index = userSpotifyTracksRef.current.findIndex((t) => t?.id === track?.id);
            resolveTrackBpm(track, {
                ...options,
                positionIndex: index >= 0 ? index : undefined,
            });
        },
        [resolveTrackBpm],
    );

    const loadSpotifyTrack = useCallback(
        async (track, autoPlay = false) => {
            const uri = track?.uri || track?.spTrack?.uri;
            if (!uri) {
                setTracksLoadError('Invalid track data.');
                return;
            }
            if (!playbackReady) {
                setTracksLoadError('Spotify player is still connecting. Please wait a moment.');
                return;
            }
            setStreamLoading(true);
            setTracksLoadError('');
            try {
                if (audioRef.current?._setSpotifyTrack) {
                    audioRef.current._setSpotifyTrack(uri);
                }
                await spotifyTransport.current.playUri(uri);
                audioRef.current?.dispatchEvent(new Event('play'));
                detectTrackBpm(track, { allowMediaElement: true });
            } catch (err) {
                console.error('Failed to load Spotify track:', err);
                setTracksLoadError(
                    err.message || 'Failed to load track. Spotify Premium may be required.',
                );
            } finally {
                setStreamLoading(false);
            }
        },
        [playbackReady, detectTrackBpm],
    );

    const spotifyPlaylistSelection = useMemo(
        () =>
            getSpotifyPlaylistSelectionForMode(
                currentAdaptationMode,
                reactionPolicyInstance?.catalogTrackSelection,
            ),
        [currentAdaptationMode, reactionPolicyInstance?.catalogTrackSelection],
    );

    const rebuildModePlaylist = useCallback(async () => {
        if (!userSpotifyTracks.length) return;

        let energySurvey = null;
        if (currentAdaptationMode === 'Mode B' && typeof window !== 'undefined') {
            const stored = Number(window.localStorage.getItem(ENERGY_SURVEY_LOCAL_STORAGE_KEY));
            energySurvey = Number.isFinite(stored) ? stored : null;
        }

        const candidateTracks =
            currentAdaptationMode === 'Mode B'
                ? userSpotifyTracksRef.current
                : userSpotifyTracks;

        let selected;
        try {
            selected = selectSpotifyPlaylistTracks(
                candidateTracks,
                spotifyPlaylistSelection,
                experimentSongCount,
                { energySurvey },
            );
        } catch (err) {
            setTracksLoadError(err?.message || 'Could not build playlist from your Spotify tracks.');
            return;
        }

        if (selected.length === 0) {
            setTracksLoadError('No playable tracks found in your Spotify playlist.');
            setPlaylist([]);
            return;
        }

        setPlaylist(selected);
        setCurrentTrackIndex(-1);
        setSelectedFile(null);
        blockTrackStepRef.current = 0;

        if (selected.length < experimentSongCount) {
            setTracksLoadError(
                `Your playlist has only ${selected.length} playable track(s); this session uses ${experimentSongCount}.`,
            );
        } else {
            setTracksLoadError('');
        }

    }, [
        currentAdaptationMode,
        experimentSongCount,
        spotifyPlaylistSelection,
        userSpotifyTracks,
    ]);

    useEffect(() => {
        if (!userSpotifyTracks.length || !chosenSpotifyPlaylistId) return;
        const key = `${chosenSpotifyPlaylistId}:${userSpotifyTracks.length}`;
        playlistBpmPrefetchKeyRef.current = key;
        setPlaylistBpmsReady(false);
        let cancelled = false;
        void (async () => {
            for (let index = 0; index < userSpotifyTracks.length; index += 1) {
                if (cancelled || playlistBpmPrefetchKeyRef.current !== key) return;
                await resolveTrackBpm(userSpotifyTracks[index], {
                    allowMediaElement: true,
                    positionIndex: index,
                });
            }
            if (!cancelled && playlistBpmPrefetchKeyRef.current === key) {
                setPlaylistBpmsReady(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userSpotifyTracks.length, chosenSpotifyPlaylistId, resolveTrackBpm]);

    useEffect(() => {
        if (!userSpotifyTracks.length || !reactionPolicyInstance || policyLoading) return;
        if (currentAdaptationMode === 'Mode B' && !playlistBpmsReady) return;
        rebuildModePlaylist();
    }, [
        userSpotifyTracks.length,
        reactionPolicyInstance?.policyId,
        currentAdaptationModeIndex,
        experimentSongCount,
        policyLoading,
        playlistBpmsReady,
        currentAdaptationMode,
        rebuildModePlaylist,
    ]);

    const handleSpotifyPlaylistChosen = useCallback(
        (tracks, playlistMeta) => {
            setUserSpotifyTracks(tracks);
            setChosenSpotifyPlaylistName(playlistMeta?.name || '');
            setChosenSpotifyPlaylistId(playlistMeta?.id || '');
            playlistAnalyticsContextRef.current = {
                sessionName: analyticsSessionName,
                playlistId: playlistMeta?.id || '',
                playlistName: playlistMeta?.name || '',
            };
            bpmResolveChainRef.current = Promise.resolve();
            setPlaylistBpmsReady(false);
            setShowPlaylistPicker(false);
            setTracksLoadError('');
            setShowSequenceTutorial(true);
        },
        [analyticsSessionName],
    );

    const finalFeedbackIntro =
        'Thank you for your participation. Before ending this test session, we need from you to answer these questions.';
    const evaluationQuestions = [
        'Rank the 2 sequences (1 best to 2 worst).',
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
        ['Sequence 1', 'Sequence 2'],
        ['Match my energy', 'Help me shift my energy', 'Depends on the situation'],
        ['1', '2', "Not applicable (wasn't trying to)"],
        ['1', '2', "Not applicable (Wasn't trying to)"],
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

    const getSequenceTutorialMessages = (modeIndex) => {
        if (modeIndex === 1) {
            return ['When you are ready, click Play.'];
        }
        return [
            'Choose a Spotify playlist that includes songs from our catalog when prompted.',
            'When you are ready, click Play.',
        ];
    };

    const persistOriginalBpmFromApi = (track) => {
        const originalBpm = Number(track?.bpm ?? track?.track_bpm);
        if (Number.isFinite(originalBpm) && originalBpm > 0) {
            localStorage.setItem('calibration_original_bpm', String(originalBpm));
        } else {
            localStorage.removeItem('calibration_original_bpm');
        }
    };

    const sequenceStepCount = useMemo(() => {
        const stepCount = durationSecondsByTrack.length || experimentSongCount;
        return Math.min(stepCount, playlist.length);
    }, [durationSecondsByTrack.length, experimentSongCount, playlist.length]);

    const findFirstPlayableTrackIndex = useCallback((tracks) => {
        return (tracks || []).findIndex((track) => track?.uri || track?.spTrack?.uri);
    }, []);

    const prepareSequenceStart = () => {
        const firstIndex = findFirstPlayableTrackIndex(playlist);
        if (firstIndex < 0) return;
        const track = playlist[firstIndex];
        if (!track) return;
        pendingSequenceStartRef.current = false;
        blockTrackStepRef.current = 0;
        setCurrentTrackIndex(firstIndex);
        setSelectedFile(track);
        persistOriginalBpmFromApi(track);
        detectTrackBpm(track);
        void loadSpotifyTrack(track, false);
    };

    const requestSequenceStart = () => {
        if (findFirstPlayableTrackIndex(playlist) >= 0) {
            prepareSequenceStart();
        } else {
            pendingSequenceStartRef.current = true;
        }
    };

    useEffect(() => {
        if (showSequenceTutorial || !pendingSequenceStartRef.current) {
            return;
        }
        if (findFirstPlayableTrackIndex(playlist) < 0) {
            return;
        }
        prepareSequenceStart();
    }, [playlist, showSequenceTutorial, findFirstPlayableTrackIndex]);

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

    const handleTestSequenceTrackSelect = useCallback(
        async (track, index) => {
            if (!track?.uri && !track?.spTrack?.uri) return;
            setSelectedFile(track);
            setCurrentTrackIndex(index);
            persistOriginalBpmFromApi(track);
            detectTrackBpm(track);
            await loadSpotifyTrack(track, false);
        },
        [detectTrackBpm, loadSpotifyTrack],
    );

    const clearBlockTrackTimer = () => {
        if (blockTrackTimerRef.current) {
            clearTimeout(blockTrackTimerRef.current);
            blockTrackTimerRef.current = null;
        }
    };

    const scheduleNextTrackTransition = () => {
        clearBlockTrackTimer();
        const step = blockTrackStepRef.current;
        const seconds = durationSecondsByTrack[step] ?? 60;
        blockTrackTimerRef.current = setTimeout(() => {
            playNextTrackInBlock();
        }, seconds * 1000);
    };

    const playTrackByIndex = useCallback(
        async (index) => {
            const track = playlist[index];
            if (!track?.uri && !track?.spTrack?.uri) return;
            isAutoSwitchingTrackRef.current = true;
            try {
                await handleTestSequenceTrackSelect(track, index);
                if (playbackReady) {
                    await spotifyTransport.current.resume?.();
                }
            } finally {
                isAutoSwitchingTrackRef.current = false;
            }
        },
        [playlist, handleTestSequenceTrackSelect, playbackReady],
    );

    const playNextTrackInBlock = () => {
        const nextStep = blockTrackStepRef.current + 1;
        if (nextStep >= sequenceStepCount) {
            clearBlockTrackTimer();
            void spotifyTransport.current.pause?.();
            setShowAfterBlockSurvey(true);
            return;
        }
        if (nextStep >= playlist.length) {
            clearBlockTrackTimer();
            void spotifyTransport.current.pause?.();
            return;
        }
        blockTrackStepRef.current = nextStep;
        void playTrackByIndex(nextStep);
    };

    const deckAIsPlaying =
        spotifySessionReady &&
        playbackReady &&
        !spotifyIsPaused &&
        Boolean(selectedFile?.uri || selectedFile?.spTrack?.uri);

    const sequenceIndexByTrackId = useMemo(() => {
        const map = new Map();
        playlist.forEach((track, index) => {
            if (track?.id) map.set(track.id, index);
        });
        return map;
    }, [playlist]);

    const playerSessionReady =
        !showInitialEnergySurvey && !spotifyAuthLoading && !policyLoading && reactionPolicyInstance;

    return (
        <>
            {!showInitialEnergySurvey && spotifyAuthLoading && (
                <div className="text-center text-light py-5">
                    <Spinner animation="border" style={{ color: '#1DB954' }} />
                    <span className="ms-3">Loading Spotify…</span>
                </div>
            )}
            {!showInitialEnergySurvey && !spotifyAuthLoading && policyLoading && (
                <div className="text-center text-light py-5">Loading adaptation policy…</div>
            )}
            <SpotifyPlaylistChoice
                show={showPlaylistPicker && spotifyAuthenticated}
                accessToken={accessToken}
                onPlaylistChosen={handleSpotifyPlaylistChosen}
                onError={(message) => setTracksLoadError(message)}
                selectionError={tracksLoadError}
            />
            {playerSessionReady && (
                <Container fluid className="px-3" style={{ marginTop: '1rem' }}>
                    <div
                        className="rounded p-3 text-light"
                        style={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid rgba(255,255,255,0.15)',
                            maxWidth: '720px',
                            margin: '0 auto 1rem',
                        }}
                    >
                        <div
                            style={{
                                fontSize: '0.75rem',
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                opacity: 0.65,
                                marginBottom: '0.5rem',
                            }}
                        >
                            Your playlist
                        </div>
                        {chosenSpotifyPlaylistName && (
                            <div style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '1rem' }}>
                                {chosenSpotifyPlaylistName}
                            </div>
                        )}
                        {playlist.length > 0 && (
                            <div
                                style={{
                                    textAlign: 'center',
                                    fontSize: '0.85rem',
                                    opacity: 0.7,
                                    marginBottom: '0.75rem',
                                }}
                            >
                                Session plays {playlist.length} track{playlist.length === 1 ? '' : 's'} (highlighted)
                            </div>
                        )}
                        <div
                            style={{
                                maxHeight: 'min(50vh, 420px)',
                                overflowY: 'auto',
                                WebkitOverflowScrolling: 'touch',
                            }}
                        >
                            {userSpotifyTracks.length === 0 ? (
                                <p style={{ textAlign: 'center', opacity: 0.7, fontSize: '0.95rem', margin: 0 }}>
                                    Choose a Spotify playlist to build your sequence.
                                </p>
                            ) : (
                                <ul className="list-unstyled mb-0" style={{ fontSize: '0.9rem' }}>
                                    {userSpotifyTracks.map((track, index) => {
                                        const sequenceIndex = sequenceIndexByTrackId.get(track.id);
                                        const inSequence = sequenceIndex !== undefined;
                                        const isCurrent =
                                            inSequence && sequenceIndex === currentTrackIndex;
                                        const bpm = Number(track?.bpm ?? track?.track_bpm);
                                        const bpmLabel = Number.isFinite(bpm) && bpm > 0
                                            ? `${Math.round(bpm)} BPM`
                                            : track?.bpmPending
                                              ? 'BPM…'
                                              : '—';
                                        return (
                                            <li
                                                key={track.songId || track.id || index}
                                                style={{
                                                    padding: '0.4rem 0',
                                                    borderBottom: '1px solid rgba(255,255,255,0.12)',
                                                    opacity: isCurrent ? 1 : inSequence ? 0.9 : 0.65,
                                                    fontWeight: isCurrent ? 600 : inSequence ? 500 : 400,
                                                }}
                                            >
                                                {track.title || track.name}
                                                <span style={{ opacity: 0.65 }}> — {track.artist}</span>
                                                <span
                                                    style={{
                                                        opacity: 0.75,
                                                        marginLeft: '0.35rem',
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}
                                                >
                                                    · {bpmLabel}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </Container>
            )}
            {playerSessionReady && (
                <Player
                    key={`sequence-mode-${currentAdaptationModeIndex}-${reactionPolicyInstance.policyId || 'policy'}`}
                    selectedFile={selectedFile}
                    sessionName="TestPlayer_20260518"
                    audioRef={audioRef}
                    initialReactionPolicyInstance={reactionPolicyInstance}
                    playlist={playlist}
                    currentTrackIndex={currentTrackIndex}
                    onTrackSelect={null}
                    onMusicPlay={handleMusicPlay}
                    onMusicPause={handleMusicPause}
                    deckAIsPlaying={deckAIsPlaying}
                    deckATrackStatusMessage={
                        !playbackReady
                            ? 'Connecting Spotify player...'
                            : selectedFile && streamLoading
                              ? 'Loading track...'
                              : undefined
                    }
                    deckATrackStatusLoading={!playbackReady || Boolean(selectedFile && streamLoading)}
                    fallbackDeckArtworkSrc={magicPlayerImage}
                    enableSecondDeck={false}
                    enableTrackNavigation={false}
                    enableStopButton={false}
                    showTutorialButton={true}
                    onTutorialButtonClick={() => setShowSequenceTutorial(true)}
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
                        adaptation_modes_sequence.length - 1,
                    );
                    setCurrentAdaptationModeIndex(nextModeIndex);
                    const nextMode =
                        randomizedAdaptationModesSequence[nextModeIndex] ??
                        adaptation_modes_sequence[nextModeIndex];
                    if (nextMode === 'Mode B') {
                        void fetchLatestEnergySurveyFromUserEndpoint(null);
                    }
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
                onHide={handleInitialSurveyComplete}
                disableSubmission={false}
            />
            {showSequenceTutorial && (
                <TutorialMessage
                    messages={getSequenceTutorialMessages(currentAdaptationModeIndex)}
                    position="top-center"
                    onClose={() => {
                        setShowSequenceTutorial(false);
                        requestSequenceStart();
                    }}
                />
            )}
        </>
    );
};

export default TestPlayerPage_20260518;
