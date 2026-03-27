import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import Hls from 'hls.js';
import { Subtitle, StyledCard, Text } from '../utils/StyledComponents';
import { secondaryColor } from '../utils/DisplaySettings';
import ExpandReduceButton from '../components/buttons/ExpandReduceButton';
import Player from '../components/player/Player';
import PlaylistCard from '../components/player/PlaylistCard';
import SoundCloudLibraryPanel from '../library_panels/SoundCloudLibraryPanel';
import { useSoundCloudAuth } from '../contexts/SoundCloudAuthContext';
import { getStreamUrl } from '../utils/soundcloudService';

const SoundCloudPlayerPage = () => {
    const {
        accessToken,
        user,
        isAuthenticated,
        isLoading: authLoading,
        error: authError,
        initiateLogin,
        logout,
    } = useSoundCloudAuth();

    const [selectedFile, setSelectedFile] = useState(null);
    const [playlist, setPlaylist] = useState([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
    const [error, setError] = useState('');
    const [isSCLibraryExpanded, setIsSCLibraryExpanded] = useState(true);
    const [streamLoading, setStreamLoading] = useState(false);
    const audioRef = useRef(null);
    const deckBAudioRef = useRef(null);
    const hlsRef = useRef(null);
    const hlsDeckBRef = useRef(null);

    // Clean up HLS instance
    const destroyHls = useCallback(() => {
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
    }, []);

    const destroyDeckBHls = useCallback(() => {
        if (hlsDeckBRef.current) {
            hlsDeckBRef.current.destroy();
            hlsDeckBRef.current = null;
        }
    }, []);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            destroyHls();
            destroyDeckBHls();
        };
    }, [destroyHls, destroyDeckBHls]);

    const loadSoundCloudTrackIntoAudio = useCallback(async ({
        track,
        targetAudioRef,
        targetHlsRef,
        autoPlay = false,
        setLoadingState = null
    }) => {
        if (!track?.scTrack) {
            setError('Invalid track data.');
            return;
        }

        if (setLoadingState) {
            setLoadingState(true);
        }
        setError('');

        try {
            if (targetHlsRef.current) {
                targetHlsRef.current.destroy();
                targetHlsRef.current = null;
            }

            const stream = await getStreamUrl(track.scTrack, accessToken);
            if (!targetAudioRef.current) return;

            targetAudioRef.current.crossOrigin = 'anonymous';

            if (stream.isHls && Hls.isSupported()) {
                const hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: false,
                    xhrSetup: (xhr) => {
                        if (accessToken) {
                            xhr.setRequestHeader('Authorization', `OAuth ${accessToken}`);
                        }
                    },
                });

                targetHlsRef.current = hls;
                hls.loadSource(stream.url);
                hls.attachMedia(targetAudioRef.current);

                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    if (setLoadingState) {
                        setLoadingState(false);
                    }
                    if (autoPlay) {
                        targetAudioRef.current.play().catch((err) => {
                            console.error('Auto-play failed:', err);
                        });
                    }
                });

                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        console.error('HLS fatal error:', data);
                        setError('Stream playback error. Please try another track.');
                        if (setLoadingState) {
                            setLoadingState(false);
                        }
                        if (targetHlsRef.current) {
                            targetHlsRef.current.destroy();
                            targetHlsRef.current = null;
                        }
                    }
                });
            } else if (stream.isHls && targetAudioRef.current.canPlayType('application/vnd.apple.mpegurl')) {
                targetAudioRef.current.src = stream.url;
                targetAudioRef.current.load();
                if (setLoadingState) {
                    setLoadingState(false);
                }
                if (autoPlay) {
                    const playWhenReady = () => {
                        if (targetAudioRef.current && targetAudioRef.current.readyState >= 2) {
                            targetAudioRef.current.play().catch((err) => {
                                console.error('Auto-play failed:', err);
                            });
                        } else {
                            setTimeout(playWhenReady, 100);
                        }
                    };
                    setTimeout(playWhenReady, 200);
                }
            } else {
                targetAudioRef.current.src = stream.url;
                targetAudioRef.current.load();
                if (setLoadingState) {
                    setLoadingState(false);
                }
                if (autoPlay) {
                    const playWhenReady = () => {
                        if (targetAudioRef.current && targetAudioRef.current.readyState >= 2) {
                            targetAudioRef.current.play().catch((err) => {
                                console.error('Auto-play failed:', err);
                            });
                        } else {
                            setTimeout(playWhenReady, 100);
                        }
                    };
                    setTimeout(playWhenReady, 200);
                }
            }
        } catch (err) {
            console.error('Failed to load SoundCloud stream:', err);
            setError(err.message || 'Failed to load track. Please try again.');
            if (setLoadingState) {
                setLoadingState(false);
            }
        }
    }, [accessToken]);

    /**
     * Load a SoundCloud track into the audio element using HLS.js.
     * This resolves the streaming URL and sets up HLS playback.
     */
    const loadSoundCloudTrack = useCallback(async (track, autoPlay = false) => {
        await loadSoundCloudTrackIntoAudio({
            track,
            targetAudioRef: audioRef,
            targetHlsRef: hlsRef,
            autoPlay,
            setLoadingState: setStreamLoading
        });
    }, [loadSoundCloudTrackIntoAudio]);

    const handleLoadDeckBTrack = useCallback(async (track) => {
        await loadSoundCloudTrackIntoAudio({
            track,
            targetAudioRef: deckBAudioRef,
            targetHlsRef: hlsDeckBRef,
            autoPlay: false,
            setLoadingState: null
        });
    }, [loadSoundCloudTrackIntoAudio]);

    // Handle playlist change (reorder, remove, etc.)
    const handlePlaylistChange = useCallback((newPlaylist, newCurrentIndex) => {
        setPlaylist(newPlaylist);
        setCurrentTrackIndex(newCurrentIndex);
    }, []);

    // Handle track selection from playlist
    const handlePlaylistTrackSelect = useCallback(async (track, index, autoPlay = false) => {
        setError('');
        const wasPlaying = audioRef.current && !audioRef.current.paused;
        setSelectedFile(track);
        setCurrentTrackIndex(index);

        await loadSoundCloudTrack(track, wasPlaying || autoPlay);
    }, [loadSoundCloudTrack]);

    // Handle track selection from SoundCloud library (play immediately)
    const handleSCLibraryTrackSelect = useCallback(async (normalizedTrack) => {
        setError('');
        const wasPlaying = audioRef.current && !audioRef.current.paused;
        setSelectedFile(normalizedTrack);

        await loadSoundCloudTrack(normalizedTrack, wasPlaying);
    }, [loadSoundCloudTrack]);

    // Handle adding track to playlist from SoundCloud library
    const handleAddToPlaylist = useCallback((normalizedTrack) => {
        const newPlaylist = [...playlist, normalizedTrack];
        setPlaylist(newPlaylist);
    }, [playlist]);

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
                <span className="ms-3">Loading SoundCloud...</span>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="container-fluid mt-4 px-3">
                <div className="bg-dark rounded p-4" style={{ backgroundColor: '#1a1a1a' }}>
                    <div className="text-center py-5">
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>☁</div>
                        <Subtitle className="mb-3">Connect to SoundCloud</Subtitle>
                        <Text style={{ opacity: 0.7, maxWidth: '500px', margin: '0 auto 2rem' }}>
                            Log in with your SoundCloud account to browse your tracks, likes,
                            and playlists — then experience them with emotion-responsive audio effects.
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
                                borderColor: '#ff5500',
                                color: '#ff5500',
                                padding: '0.75rem 2rem',
                                fontSize: '1.1rem',
                                transition: 'all 0.3s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#ff5500';
                                e.target.style.color = 'white';
                                e.target.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = 'transparent';
                                e.target.style.color = '#ff5500';
                                e.target.style.transform = 'translateY(0)';
                            }}
                        >
                            Login with SoundCloud
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Authenticated player view
    return (
        <Player
            selectedFile={selectedFile}
            isDemoTrack={false}
            pageName="soundcloud-player"
            audioRef={audioRef}
            deckBAudioRef={deckBAudioRef}
            playlist={playlist}
            currentTrackIndex={currentTrackIndex}
            onPlaylistChange={handlePlaylistChange}
            onTrackSelect={handlePlaylistTrackSelect}
            onLoadDeckBTrack={handleLoadDeckBTrack}
            deckATrackStatusMessage={selectedFile && streamLoading ? 'Loading stream...' : undefined}
            deckATrackStatusLoading={Boolean(selectedFile && streamLoading)}
            autoStartLandmarkWithMusic
        >
            {/* Playlist Card — always visible (empty state inside card) */}
            <PlaylistCard
                playlist={playlist}
                onPlaylistChange={handlePlaylistChange}
                currentTrackIndex={currentTrackIndex}
                onTrackSelect={handlePlaylistTrackSelect}
                isPlaying={audioRef.current && !audioRef.current.paused}
            />

            {/* SoundCloud Library */}
            <StyledCard className="mb-4" data-soundcloud-library-card>
                <div className="d-flex align-items-center justify-content-between mb-3">
                    <Subtitle style={{ margin: 0, fontSize: '1.1rem' }}>
                        ☁ SoundCloud Library
                    </Subtitle>
                    <ExpandReduceButton
                        isExpanded={isSCLibraryExpanded}
                        onToggle={() => setIsSCLibraryExpanded(!isSCLibraryExpanded)}
                    />
                </div>

                {isSCLibraryExpanded && (
                    <SoundCloudLibraryPanel
                        show={true}
                        accessToken={accessToken}
                        onTrackSelect={handleSCLibraryTrackSelect}
                        onAddToPlaylist={handleAddToPlaylist}
                        playlist={playlist}
                    />
                )}
            </StyledCard>

            {/* Error Display */}
            {error && (
                <div className="alert alert-danger mb-4">
                    {error}
                </div>
            )}

            {/* User Info + Disconnect — page footer */}
            <div
                className="d-flex align-items-center justify-content-between mt-4 pt-3 mb-2 flex-wrap gap-2"
                style={{ borderTop: '1px solid #333' }}
            >
                <div className="d-flex align-items-center">
                    {user?.avatar_url && (
                        <img
                            src={user.avatar_url}
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
                        <span style={{ color: '#ff5500' }}>SoundCloud</span>
                        {user?.username && (
                            <span style={{ opacity: 0.7 }}> · {user.username}</span>
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
        </Player>
    );
};

export default SoundCloudPlayerPage;
