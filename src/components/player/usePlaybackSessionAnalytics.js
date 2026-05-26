import { useCallback, useEffect, useRef } from 'react';
import { trackSimpleEvent, trackSimpleEventOnUnload } from '../../hooks/simpleTracker';

const ACTIVE_PLAYBACK_SESSION_KEY = 'active_music_playback_session_v1';
const PLAYBACK_HEARTBEAT_MS = 5000;
const PLAYBACK_DEBUG_LAST_KEY = 'playback_analytics_last_debug_v1';
const debugPlaybackAnalytics = (...args) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log('[PlaybackAnalytics]', ...args);
    }
};
const persistPlaybackDebug = (label, payload = {}) => {
    if (process.env.NODE_ENV === 'production') {
        return;
    }
    try {
        localStorage.setItem(
            PLAYBACK_DEBUG_LAST_KEY,
            JSON.stringify({
                label,
                at_ms: Date.now(),
                payload,
            })
        );
    } catch {
        // Ignore debug persistence failures.
    }
};

export function usePlaybackSessionAnalytics({
    sessionName,
    resolveTrackName,
    resolveTrackId,
    /** Optional per-session extras merged into metadata.experiment_config (e.g. Mode B BPM). */
    resolvePlaybackExperimentConfig,
}) {
    const playbackSessionActiveRef = useRef(false);
    const playbackSessionStartMsRef = useRef(0);
    const playbackSessionHeartbeatRef = useRef(null);
    const unloadFlushSentRef = useRef(false);
    const isPageTerminatingRef = useRef(false);

    const buildPlaybackMetadata = useCallback(() => {
        const trackId = resolveTrackId?.() ?? null;
        const metadata = trackId
            ? { track_id: trackId, song_name: resolveTrackName() }
            : {};

        const experimentConfig = resolvePlaybackExperimentConfig?.();
        if (
            experimentConfig &&
            typeof experimentConfig === 'object' &&
            !Array.isArray(experimentConfig) &&
            Object.keys(experimentConfig).length > 0
        ) {
            metadata.experiment_config = experimentConfig;
        }

        return Object.keys(metadata).length > 0 ? metadata : undefined;
    }, [resolvePlaybackExperimentConfig, resolveTrackId, resolveTrackName]);

    const persistPlaybackSnapshot = useCallback((lastSeenAtMs = Date.now()) => {
        if (!playbackSessionActiveRef.current || !playbackSessionStartMsRef.current) {
            return;
        }
        try {
            const payload = {
                page_name: sessionName,
                session_name: sessionName,
                track_name: resolveTrackName(),
                started_at_ms: playbackSessionStartMsRef.current,
                last_seen_at_ms: lastSeenAtMs,
            };
            localStorage.setItem(ACTIVE_PLAYBACK_SESSION_KEY, JSON.stringify(payload));
        } catch {
            // Ignore persistence failures.
        }
    }, [resolveTrackName, sessionName]);

    const startPlaybackSession = useCallback(() => {
        if (playbackSessionActiveRef.current) return;
        isPageTerminatingRef.current = false;
        playbackSessionActiveRef.current = true;
        unloadFlushSentRef.current = false;
        playbackSessionStartMsRef.current = Date.now();
        debugPlaybackAnalytics('start', {
            sessionName,
            started_at_ms: playbackSessionStartMsRef.current,
            track_name: resolveTrackName(),
        });
        persistPlaybackDebug('start', {
            sessionName,
            started_at_ms: playbackSessionStartMsRef.current,
            track_name: resolveTrackName(),
        });
        persistPlaybackSnapshot(playbackSessionStartMsRef.current);

        if (playbackSessionHeartbeatRef.current) {
            clearInterval(playbackSessionHeartbeatRef.current);
        }
        playbackSessionHeartbeatRef.current = setInterval(() => {
            persistPlaybackSnapshot(Date.now());
        }, PLAYBACK_HEARTBEAT_MS);
    }, [persistPlaybackSnapshot]);

    const endPlaybackSession = useCallback(async (endReason) => {
        if (!playbackSessionActiveRef.current || !playbackSessionStartMsRef.current) {
            return;
        }

        const endedAt = Date.now();
        const startedAt = playbackSessionStartMsRef.current;
        const durationMs = Math.max(0, endedAt - startedAt);
        playbackSessionActiveRef.current = false;
        unloadFlushSentRef.current = false;
        playbackSessionStartMsRef.current = 0;

        if (playbackSessionHeartbeatRef.current) {
            clearInterval(playbackSessionHeartbeatRef.current);
            playbackSessionHeartbeatRef.current = null;
        }

        try {
            localStorage.removeItem(ACTIVE_PLAYBACK_SESSION_KEY);
        } catch {
            // Ignore cleanup errors.
        }

        const analyticsPayload = {
            interaction_type: 'music_playback_session',
            element_id: 'deck_A_playback_session',
            page_url: window.location.href,
            session_name: sessionName,
            page_name: sessionName,
            track_name: resolveTrackName(),
            duration_ms: durationMs,
            end_reason: endReason,
            started_at_ms: startedAt,
            ended_at_ms: endedAt,
            metadata: buildPlaybackMetadata(),
        };

        if (isPageTerminatingRef.current || document.visibilityState === 'hidden') {
            debugPlaybackAnalytics('end-keepalive', analyticsPayload);
            persistPlaybackDebug('end-keepalive', analyticsPayload);
            trackSimpleEventOnUnload(analyticsPayload);
            return;
        }

        debugPlaybackAnalytics('end-async', analyticsPayload);
        persistPlaybackDebug('end-async', analyticsPayload);
        await trackSimpleEvent(analyticsPayload);
    }, [buildPlaybackMetadata, resolveTrackName, sessionName]);

    const flushPlaybackSessionOnUnload = useCallback((endReason) => {
        if (!playbackSessionActiveRef.current || !playbackSessionStartMsRef.current) {
            return;
        }
        if (unloadFlushSentRef.current) {
            return;
        }

        const endedAt = Date.now();
        const startedAt = playbackSessionStartMsRef.current;
        const durationMs = Math.max(0, endedAt - startedAt);
        debugPlaybackAnalytics('flush-unload', {
            endReason,
            started_at_ms: startedAt,
            ended_at_ms: endedAt,
            duration_ms: durationMs,
            track_name: resolveTrackName(),
        });
        persistPlaybackDebug('flush-unload', {
            endReason,
            started_at_ms: startedAt,
            ended_at_ms: endedAt,
            duration_ms: durationMs,
            track_name: resolveTrackName(),
        });

        unloadFlushSentRef.current = true;
        playbackSessionActiveRef.current = false;
        playbackSessionStartMsRef.current = 0;

        if (playbackSessionHeartbeatRef.current) {
            clearInterval(playbackSessionHeartbeatRef.current);
            playbackSessionHeartbeatRef.current = null;
        }

        const analyticsPayload = {
            interaction_type: 'music_playback_session',
            element_id: 'deck_A_playback_session',
            page_url: window.location.href,
            session_name: sessionName,
            page_name: sessionName,
            track_name: resolveTrackName(),
            duration_ms: durationMs,
            end_reason: endReason,
            started_at_ms: startedAt,
            ended_at_ms: endedAt,
            metadata: buildPlaybackMetadata(),
        };

        // Keep a pending snapshot so next launch can recover if keepalive delivery fails on close.
        try {
            localStorage.setItem(ACTIVE_PLAYBACK_SESSION_KEY, JSON.stringify({
                page_name: sessionName,
                session_name: sessionName,
                track_name: resolveTrackName(),
                started_at_ms: startedAt,
                last_seen_at_ms: endedAt,
                ended_at_ms: endedAt,
                end_reason: endReason,
                pending_unload_flush: true,
            }));
        } catch {
            // Ignore persistence failures.
        }

        trackSimpleEventOnUnload(analyticsPayload);
    }, [buildPlaybackMetadata, resolveTrackName, sessionName]);

    useEffect(() => {
        if (process.env.NODE_ENV !== 'production') {
            try {
                const lastDebug = localStorage.getItem(PLAYBACK_DEBUG_LAST_KEY);
                if (lastDebug) {
                    debugPlaybackAnalytics('last-debug-on-load', JSON.parse(lastDebug));
                }
            } catch {
                // Ignore debug read failures.
            }
        }

        try {
            const persisted = localStorage.getItem(ACTIVE_PLAYBACK_SESSION_KEY);
            if (!persisted) return;
            const snapshot = JSON.parse(persisted);
            const startedAt = Number(snapshot?.started_at_ms) || 0;
            const endedAt = Number(snapshot?.ended_at_ms) || 0;
            const lastSeenAt = Number(snapshot?.last_seen_at_ms) || startedAt;
            const recoveredEndedAt = endedAt >= startedAt ? endedAt : lastSeenAt;
            if (startedAt > 0 && recoveredEndedAt >= startedAt) {
                const recoveredDuration = Math.max(0, recoveredEndedAt - startedAt);
                if (recoveredDuration > 0) {
                    void trackSimpleEvent({
                        interaction_type: 'music_playback_session',
                        element_id: 'deck_A_playback_session',
                        page_url: window.location.href,
                        session_name: snapshot?.session_name || sessionName,
                        page_name: snapshot?.page_name || sessionName,
                        track_name: snapshot?.track_name || 'unknown_track',
                        duration_ms: recoveredDuration,
                        end_reason: snapshot?.end_reason || 'browser_closed_or_tab_ended',
                        started_at_ms: startedAt,
                        ended_at_ms: recoveredEndedAt,
                    });
                }
            }
            localStorage.removeItem(ACTIVE_PLAYBACK_SESSION_KEY);
        } catch {
            // Ignore malformed persisted snapshots.
        }
    }, [sessionName]);

    useEffect(() => {
        const persistOnPageExit = () => {
            persistPlaybackSnapshot(Date.now());
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                persistOnPageExit();
            }
        };

        const onBeforeUnload = () => {
            isPageTerminatingRef.current = true;
            debugPlaybackAnalytics('event', 'beforeunload');
            persistPlaybackDebug('event-beforeunload');
            flushPlaybackSessionOnUnload('window_beforeunload');
        };
        const onPageHide = () => {
            isPageTerminatingRef.current = true;
            debugPlaybackAnalytics('event', 'pagehide');
            persistPlaybackDebug('event-pagehide');
            flushPlaybackSessionOnUnload('window_pagehide');
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        window.addEventListener('pagehide', onPageHide);
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            window.removeEventListener('pagehide', onPageHide);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            persistOnPageExit();
            if (playbackSessionHeartbeatRef.current) {
                clearInterval(playbackSessionHeartbeatRef.current);
                playbackSessionHeartbeatRef.current = null;
            }
        };
    }, [flushPlaybackSessionOnUnload, persistPlaybackSnapshot]);

    return {
        startPlaybackSession,
        endPlaybackSession,
    };
}
