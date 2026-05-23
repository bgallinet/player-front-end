import React, { useCallback, useEffect, useState } from 'react';
import { Button, Modal, Spinner } from 'react-bootstrap';
import { Text } from '../../styles/StyledComponents';
import { getMyBrowsablePlaylists, getPlaylistTracks, normalizeTrack } from '../../utils/spotifyService';

const SPOTIFY_GREEN = '#1DB954';

/**
 * Full-screen modal: pick one of the user's Spotify playlists before the test session starts.
 */
const SpotifyPlaylistChoice = ({
    show,
    accessToken,
    onPlaylistChosen,
    onError,
    selectionError = '',
}) => {
    const [playlists, setPlaylists] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [loadingTracks, setLoadingTracks] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!show || !accessToken) return;
        let cancelled = false;
        setLoadingList(true);
        setError('');
        void getMyBrowsablePlaylists(accessToken)
            .then(({ playlists: browsable }) => {
                if (cancelled) return;
                setPlaylists(browsable || []);
            })
            .catch((err) => {
                if (cancelled) return;
                const message = err?.message || 'Failed to load playlists';
                setError(message);
                onError?.(message);
            })
            .finally(() => {
                if (!cancelled) setLoadingList(false);
            });
        return () => {
            cancelled = true;
        };
    }, [show, accessToken, onError]);

    const handleSelect = useCallback(
        async (playlist) => {
            if (!accessToken || !playlist?.id || loadingTracks) return;
            setLoadingTracks(true);
            setError('');
            try {
                const raw = await getPlaylistTracks(playlist.id, accessToken);
                const tracks = (Array.isArray(raw) ? raw : []).map(normalizeTrack).filter((t) => t?.uri);
                if (!tracks.length) {
                    throw new Error('This playlist has no playable tracks.');
                }
                await Promise.resolve(onPlaylistChosen(tracks, playlist));
            } catch (err) {
                const message = err?.message || 'Failed to load playlist tracks';
                setError(message);
                onError?.(message);
            } finally {
                setLoadingTracks(false);
            }
        },
        [accessToken, loadingTracks, onPlaylistChosen, onError],
    );

    const displayError = error || selectionError;
    const selectDisabled = loadingTracks;

    return (
        <Modal
            show={show}
            backdrop="static"
            keyboard={false}
            centered
            size="lg"
            contentClassName="bg-dark text-light border-secondary"
        >
            <Modal.Header closeButton={false} className="border-secondary">
                <Modal.Title>Choose a playlist</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <Text style={{ opacity: 0.85, marginBottom: '1rem' }}>
                    Select one of your Spotify playlists for this test session.
                </Text>
                {displayError && <div className="alert alert-danger py-2">{displayError}</div>}
                {loadingList && (
                    <div className="text-center py-4">
                        <Spinner animation="border" style={{ color: SPOTIFY_GREEN }} />
                        <div className="mt-2">Loading your playlists…</div>
                    </div>
                )}
                {!loadingList && !loadingTracks && playlists.length === 0 && !displayError && (
                    <Text style={{ opacity: 0.7 }}>No playlists found on your account.</Text>
                )}
                <div className="d-flex flex-column gap-2">
                    {playlists.map((pl) => (
                        <Button
                            key={pl.id}
                            variant="outline-light"
                            disabled={selectDisabled}
                            onClick={() => handleSelect(pl)}
                            style={{
                                borderColor: SPOTIFY_GREEN,
                                color: SPOTIFY_GREEN,
                                textAlign: 'left',
                                whiteSpace: 'normal',
                            }}
                        >
                            {pl.name}
                            {typeof pl.tracks?.total === 'number' ? (
                                <span style={{ opacity: 0.65, marginLeft: '0.5rem' }}>
                                    ({pl.tracks.total} tracks)
                                </span>
                            ) : null}
                        </Button>
                    ))}
                </div>
                {loadingTracks && (
                    <div className="text-center py-3">
                        <Spinner animation="border" size="sm" style={{ color: SPOTIFY_GREEN }} />
                        <span className="ms-2">Loading tracks…</span>
                    </div>
                )}
            </Modal.Body>
        </Modal>
    );
};

export default SpotifyPlaylistChoice;
