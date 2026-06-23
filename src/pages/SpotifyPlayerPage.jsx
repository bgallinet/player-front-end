import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { Subtitle, StyledCard, Text } from '../styles/StyledComponents';
import { secondaryColor } from '../utils/DisplaySettings';
import ExpandReduceButton from '../buttons/ExpandReduceButton';
import {
    GETSONGBPM_ATTRIBUTION_LINK_STYLE,
    GETSONGBPM_ATTRIBUTION_SITE_NAME,
    GETSONGBPM_ATTRIBUTION_URL,
    getGetSongBpmAttributionStyle,
} from '../utils/getsongBpmAttribution';
import Player from '../components/player/Player';
import PlaylistCard from '../components/library_panels/PlaylistCard';
import SpotifyLibraryPanel from '../components/library_panels/SpotifyLibraryPanel';
import { useSpotifyAuth } from '../contexts/SpotifyAuthContext';
import { useSpotifyWebPlayback } from '../hooks/useSpotifyWebPlayback';
import { bridgeAudioElementToSpotify } from '../utils/spotifyPlayback';
import {
    enrichSpotifyTrackWithBpm,
    dispatchTrackBpmDetected,
} from '../utils/spotifyBpm';

const SPOTIFY_GREEN = '#1DB954';

const SpotifyPlayerPage = () => {
    const {
        accessToken,
        user,
        isAuthenticated,
        isLoading: authLoading,
        error: authError,
        initiateLogin,
        logout,
    } = useSpotifyAuth();

    const {
        isReady: playbackReady,
        isPaused: spotifyIsPaused,
        error: playbackError,
        playUri,
        pause,
        resume,
        seek,
        getCurrentState,
    } = useSpotifyWebPlayback(accessToken);

    const [selectedFile, setSelectedFile] = useState(null);
    const [playlist, setPlaylist] = useState([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
    const [error, setError] = useState('');
    const [isLibraryExpanded, setIsLibraryExpanded] = useState(true);
    const [streamLoading, setStreamLoading] = useState(false);
    const audioRef = useRef(null);
    const bpmDetectGenByTrackRef = useRef(new Map());

    const spotifyTransport = useRef({ playUri, pause, resume, seek, getCurrentState });
    spotifyTransport.current = { playUri, pause, resume, seek, getCurrentState };

    useEffect(() => {
        const el = audioRef.current;
        if (!el || !playbackReady) return undefined;
        return bridgeAudioElementToSpotify(el, spotifyTransport.current);
    }, [playbackReady, playUri, pause, resume, seek, getCurrentState]);

    const patchTrackInState = useCallback((trackId, patch) => {
        if (!trackId) return;
        setPlaylist((prev) => prev.map((t) => (t?.id === trackId ? { ...t, ...patch } : t)));
        setSelectedFile((prev) => (prev?.id === trackId ? { ...prev, ...patch } : prev));
    }, []);

    const spotifyMarket = user?.country || undefined;

    const applyResolvedBpmToTrack = useCallback(
        (trackId, enriched) => {
            if (!trackId || !enriched?.bpm) return;

            dispatchTrackBpmDetected(audioRef.current, enriched.bpm);

            const patch = {
                bpm: enriched.bpm,
                track_bpm: enriched.bpm,
                bpmSource: enriched.bpmSource || 'preview',
                bpmPending: false,
                preview_url: enriched.preview_url ?? undefined,
                spTrack: enriched.spTrack,
            };
            patchTrackInState(trackId, patch);
        },
        [patchTrackInState],
    );

    const detectTrackBpm = useCallback(
        (track, { allowMediaElement = true } = {}) => {
            const trackId = track?.id;
            if (!trackId) return;

            const existing = Number(track?.bpm ?? track?.track_bpm);
            if (Number.isFinite(existing) && existing > 0) return;

            const nextGen = (bpmDetectGenByTrackRef.current.get(trackId) || 0) + 1;
            bpmDetectGenByTrackRef.current.set(trackId, nextGen);

            patchTrackInState(trackId, { bpmPending: true });

            void enrichSpotifyTrackWithBpm(track, {
                accessToken,
                market: spotifyMarket,
                allowMediaElement,
            }).then((enriched) => {
                if (bpmDetectGenByTrackRef.current.get(trackId) !== nextGen) return;
                if (enriched?.bpm) {
                    applyResolvedBpmToTrack(trackId, enriched);
                    return;
                }
                patchTrackInState(trackId, { bpmPending: false });
            });
        },
        [accessToken, applyResolvedBpmToTrack, patchTrackInState, spotifyMarket],
    );

    const loadSpotifyTrack = useCallback(
        async (track, autoPlay = false) => {
            const uri = track?.uri || track?.spTrack?.uri;
            if (!uri) {
                setError('Invalid track data.');
                return;
            }
            if (!playbackReady) {
                setError('Spotify player is still connecting. Please wait a moment.');
                return;
            }

            setStreamLoading(true);
            setError('');

            try {
                if (audioRef.current?._setSpotifyTrack) {
                    audioRef.current._setSpotifyTrack(uri);
                }
                await spotifyTransport.current.playUri(uri);
                // Spotify plays via SDK, not audioEl.play() — sync deck UI + analytics
                audioRef.current?.dispatchEvent(new Event('play'));
                detectTrackBpm(track, { allowMediaElement: true });
            } catch (err) {
                console.error('Failed to load Spotify track:', err);
                setError(
                    err.message || 'Failed to load track. Spotify Premium may be required.',
                );
            } finally {
                setStreamLoading(false);
            }
        },
        [playbackReady, detectTrackBpm],
    );

    // Handle playlist change (reorder, remove, drop from library, etc.)
    const handlePlaylistChange = useCallback(
        (newPlaylist, newCurrentIndex) => {
            setPlaylist((prev) => {
                const prevList = prev || [];
                const toDetect = [];
                if (newPlaylist.length > prevList.length) {
                    for (let i = prevList.length; i < newPlaylist.length; i += 1) {
                        toDetect.push(newPlaylist[i]);
                    }
                } else {
                    const prevIds = new Set(prevList.map((t) => t?.id).filter(Boolean));
                    for (const track of newPlaylist) {
                        if (track?.id && !prevIds.has(track.id)) {
                            toDetect.push(track);
                        }
                    }
                }
                queueMicrotask(() => {
                    toDetect.forEach((track) => detectTrackBpm(track));
                });
                return newPlaylist;
            });
            setCurrentTrackIndex(newCurrentIndex);
        },
        [detectTrackBpm],
    );

    // Handle track selection from playlist
    const handlePlaylistTrackSelect = useCallback(async (track, index, autoPlay = false) => {
        setError('');
        setSelectedFile(track);
        setCurrentTrackIndex(index);
        detectTrackBpm(track);

        await loadSpotifyTrack(track, autoPlay);
    }, [loadSpotifyTrack, detectTrackBpm]);

    const handleLibraryTrackSelect = useCallback(
        async (normalizedTrack) => {
            setError('');
            setSelectedFile(normalizedTrack);
            detectTrackBpm(normalizedTrack);
            await loadSpotifyTrack(normalizedTrack, true);
        },
        [loadSpotifyTrack, detectTrackBpm],
    );

    // Handle adding track to playlist from Spotify library (+ button)
    const handleAddToPlaylist = useCallback(
        (normalizedTrack) => {
            handlePlaylistChange([...playlist, normalizedTrack], currentTrackIndex);
        },
        [playlist, currentTrackIndex, handlePlaylistChange],
    );

    const deckAIsPlaying =
        isAuthenticated &&
        playbackReady &&
        !spotifyIsPaused &&
        Boolean(selectedFile?.uri || selectedFile?.spTrack?.uri);

    // Render login screen if not authenticated
    if (authLoading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '50vh',
                color: 'white',
            }}>
                <Spinner animation="border" style={{ color: secondaryColor }} />
                <span className="ms-3">Loading Spotify...</span>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="container-fluid mt-4 px-3">
                <div className="bg-dark rounded p-4" style={{ backgroundColor: '#1a1a1a' }}>
                    <div className="text-center py-5">
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>☁</div>
                        <Subtitle className="mb-3">Connect to Spotify</Subtitle>
                        <Text style={{ opacity: 0.7, maxWidth: '500px', margin: '0 auto 2rem' }}>
                            Log in with your Spotify account to browse saved tracks and playlists.
                            Playback requires Spotify Premium via the Web Playback SDK.
                        </Text>
                        {authError && (
                            <div className="alert alert-danger mb-3" style={{ maxWidth: '500px', margin: '0 auto 1rem' }}>
                                {authError}
                            </div>
                        )}
                        <Button
                            variant="outline-light"
                            size="lg"
                            onClick={initiateLogin}
                            style={{
                                borderColor: SPOTIFY_GREEN,
                                color: SPOTIFY_GREEN,
                                padding: '0.75rem 2rem',
                                fontSize: '1.1rem',
                                transition: 'all 0.3s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = SPOTIFY_GREEN;
                                e.target.style.color = 'white';
                                e.target.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = 'transparent';
                                e.target.style.color = SPOTIFY_GREEN;
                                e.target.style.transform = 'translateY(0)';
                            }}
                        >
                            Login with Spotify
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Authenticated player view
    return (
        <>
            <Player
                selectedFile={selectedFile}
                sessionName="SpotifyPlayer"
                audioRef={audioRef}
                playlist={playlist}
                currentTrackIndex={currentTrackIndex}
                onPlaylistChange={handlePlaylistChange}
                onTrackSelect={handlePlaylistTrackSelect}
                deckAIsPlaying={deckAIsPlaying}
                enableSecondDeck={false}
                deckATrackStatusMessage={
                    !playbackReady
                        ? 'Connecting Spotify player...'
                        : selectedFile && streamLoading
                          ? 'Loading track...'
                          : undefined
                }
                deckATrackStatusLoading={!playbackReady || Boolean(selectedFile && streamLoading)}
                autoStartLandmarkWithMusic
            >
            {/* Playlist Card — always visible (empty state inside card) */}
            <PlaylistCard
                playlist={playlist}
                onPlaylistChange={handlePlaylistChange}
                currentTrackIndex={currentTrackIndex}
                onTrackSelect={handlePlaylistTrackSelect}
                isPlaying={deckAIsPlaying}
                spotifyAccessToken={accessToken}
            />

            {/* Spotify Library */}
            <StyledCard className="mb-4" data-soundcloud-library-card>
                <div className="d-flex align-items-center justify-content-between mb-3">
                    <Subtitle style={{ margin: 0, fontSize: '1.1rem' }}>
                        Spotify Library
                    </Subtitle>
                    <ExpandReduceButton
                        isExpanded={isLibraryExpanded}
                        onToggle={() => setIsLibraryExpanded(!isLibraryExpanded)}
                    />
                </div>

                {isLibraryExpanded && (
                    <SpotifyLibraryPanel
                        show={true}
                        accessToken={accessToken}
                        onTrackSelect={handleLibraryTrackSelect}
                        onAddToPlaylist={handleAddToPlaylist}
                        playlist={playlist}
                    />
                )}
            </StyledCard>

            {/* Error Display */}
            {(error || playbackError) && (
                <div className="alert alert-danger mb-4">{error || playbackError}</div>
            )}

            {/* User Info + Disconnect — page footer */}
                <div
                    className="d-flex align-items-center justify-content-between mt-4 pt-3 mb-2 flex-wrap gap-2"
                    style={{ borderTop: '1px solid #333' }}
                >
                <div className="d-flex align-items-center">
                    {(user?.images?.[0]?.url || user?.avatar_url) && (
                        <img
                            src={user.images?.[0]?.url || user.avatar_url}
                            alt=""
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                marginRight: '0.75rem',
                            }}
                        />
                    )}
                    <Text style={{ margin: 0, fontSize: '0.9rem' }}>
                        <span style={{ color: SPOTIFY_GREEN }}>Spotify</span>
                        {(user?.display_name || user?.id) && (
                            <span style={{ opacity: 0.7 }}> · {user.display_name || user.id}</span>
                        )}
                    </Text>
                </div>
                <Button
                    variant="outline-light"
                    size="sm"
                    onClick={logout}
                    style={{
                        borderColor: '#666',
                        fontSize: '0.8rem',
                        padding: '0.25rem 0.5rem',
                    }}
                >
                    Disconnect
                </Button>
                </div>
                <p style={getGetSongBpmAttributionStyle({ marginTop: '0.75rem' })}>
                    Tempo data from{' '}
                    <a
                        href={GETSONGBPM_ATTRIBUTION_URL}
                        rel="noopener noreferrer"
                        target="_blank"
                        style={GETSONGBPM_ATTRIBUTION_LINK_STYLE}
                    >
                        {GETSONGBPM_ATTRIBUTION_SITE_NAME}
                    </a>
                </p>
            </Player>
        </>
    );
};

export default SpotifyPlayerPage;
