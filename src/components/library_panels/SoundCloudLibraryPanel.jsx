import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { Text } from '../../styles/StyledComponents';
import {
    getMyTracks,
    getMyLikes,
    getMyPlaylists,
    getPlaylistTracks,
    searchTracks,
    normalizeTrack,
} from '../../utils/soundcloudService';

const VIEW = Object.freeze({
    TRACKS: 'tracks',
    LIKES: 'likes',
    PLAYLISTS: 'playlists',
    SEARCH: 'search',
});

const SoundCloudLibraryPanel = ({ show, accessToken, onTrackSelect, onAddToPlaylist, playlist = [] }) => {
    const [view, setView] = useState(VIEW.TRACKS);
    const [tracks, setTracks] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
    const [playlistTracks, setPlaylistTracks] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const playlistIds = useMemo(() => new Set((playlist || []).map((t) => t?.id).filter(Boolean)), [playlist]);

    const toNormalized = useCallback((arr) => (Array.isArray(arr) ? arr.map(normalizeTrack) : []), []);

    const loadTracks = useCallback(async () => {
        if (!accessToken) return;
        setLoading(true);
        setError('');
        try {
            const data = await getMyTracks(accessToken, 100, 0);
            setTracks(toNormalized(data));
        } catch (e) {
            setError(e.message || 'Failed to load SoundCloud tracks');
        } finally {
            setLoading(false);
        }
    }, [accessToken, toNormalized]);

    const loadLikes = useCallback(async () => {
        if (!accessToken) return;
        setLoading(true);
        setError('');
        try {
            const data = await getMyLikes(accessToken, 100, 0);
            setTracks(toNormalized(data));
        } catch (e) {
            setError(e.message || 'Failed to load liked tracks');
        } finally {
            setLoading(false);
        }
    }, [accessToken, toNormalized]);

    const loadPlaylists = useCallback(async () => {
        if (!accessToken) return;
        setLoading(true);
        setError('');
        try {
            const data = await getMyPlaylists(accessToken, 100, 0);
            setPlaylists(Array.isArray(data) ? data : data?.collection || []);
        } catch (e) {
            setError(e.message || 'Failed to load playlists');
        } finally {
            setLoading(false);
        }
    }, [accessToken]);

    const loadPlaylistTracks = useCallback(
        async (playlistId) => {
            if (!accessToken || !playlistId) return;
            setLoading(true);
            setError('');
            try {
                const data = await getPlaylistTracks(playlistId, accessToken);
                setPlaylistTracks(toNormalized(data));
            } catch (e) {
                setError(e.message || 'Failed to load playlist tracks');
            } finally {
                setLoading(false);
            }
        },
        [accessToken, toNormalized],
    );

    const runSearch = useCallback(async () => {
        if (!accessToken || !searchQuery.trim()) return;
        setLoading(true);
        setError('');
        try {
            const data = await searchTracks(searchQuery.trim(), accessToken, 50, 0);
            setTracks(toNormalized(data));
        } catch (e) {
            setError(e.message || 'Search failed');
        } finally {
            setLoading(false);
        }
    }, [accessToken, searchQuery, toNormalized]);

    useEffect(() => {
        if (!show || !accessToken) return;
        if (view === VIEW.TRACKS) loadTracks();
        else if (view === VIEW.LIKES) loadLikes();
        else if (view === VIEW.PLAYLISTS) loadPlaylists();
    }, [show, accessToken, view, loadTracks, loadLikes, loadPlaylists]);

    if (!show) return null;

    return (
        <div>
            <div className="d-flex gap-2 flex-wrap mb-3">
                <Button size="sm" variant={view === VIEW.TRACKS ? 'light' : 'outline-light'} onClick={() => setView(VIEW.TRACKS)}>
                    My Tracks
                </Button>
                <Button size="sm" variant={view === VIEW.LIKES ? 'light' : 'outline-light'} onClick={() => setView(VIEW.LIKES)}>
                    Likes
                </Button>
                <Button
                    size="sm"
                    variant={view === VIEW.PLAYLISTS ? 'light' : 'outline-light'}
                    onClick={() => {
                        setSelectedPlaylistId(null);
                        setPlaylistTracks([]);
                        setView(VIEW.PLAYLISTS);
                    }}
                >
                    Playlists
                </Button>
                <Button size="sm" variant={view === VIEW.SEARCH ? 'light' : 'outline-light'} onClick={() => setView(VIEW.SEARCH)}>
                    Search
                </Button>
            </div>

            {view === VIEW.SEARCH && (
                <div className="d-flex gap-2 mb-3">
                    <Form.Control
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search SoundCloud tracks..."
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                runSearch();
                            }
                        }}
                    />
                    <Button variant="outline-light" onClick={runSearch}>
                        Search
                    </Button>
                </div>
            )}

            {error && (
                <div className="alert alert-danger py-2 mb-3">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="d-flex align-items-center gap-2 py-3">
                    <Spinner size="sm" animation="border" />
                    <Text style={{ margin: 0 }}>Loading...</Text>
                </div>
            ) : null}

            {view === VIEW.PLAYLISTS ? (
                <div>
                    <div className="d-flex gap-2 flex-wrap mb-2">
                        {(playlists || []).map((pl) => (
                            <Button
                                key={pl.id}
                                size="sm"
                                variant={selectedPlaylistId === pl.id ? 'light' : 'outline-light'}
                                onClick={() => {
                                    setSelectedPlaylistId(pl.id);
                                    void loadPlaylistTracks(pl.id);
                                }}
                            >
                                {pl.title || pl.permalink || `Playlist ${pl.id}`}
                            </Button>
                        ))}
                    </div>
                    {selectedPlaylistId && playlistTracks.length === 0 && !loading ? (
                        <Text style={{ opacity: 0.7 }}>No tracks found in this playlist.</Text>
                    ) : null}
                    {selectedPlaylistId && playlistTracks.length > 0 ? (
                        <TrackRows
                            rows={playlistTracks}
                            playlistIds={playlistIds}
                            onTrackSelect={onTrackSelect}
                            onAddToPlaylist={onAddToPlaylist}
                        />
                    ) : null}
                </div>
            ) : (
                <TrackRows rows={tracks} playlistIds={playlistIds} onTrackSelect={onTrackSelect} onAddToPlaylist={onAddToPlaylist} />
            )}
        </div>
    );
};

function TrackRows({ rows, playlistIds, onTrackSelect, onAddToPlaylist }) {
    if (!rows || rows.length === 0) {
        return <Text style={{ opacity: 0.7 }}>No tracks to display.</Text>;
    }
    return (
        <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            {rows.map((track) => {
                const inPlaylist = playlistIds.has(track?.id);
                return (
                    <div
                        key={`${track?.id}-${track?.name}`}
                        className="d-flex justify-content-between align-items-center border-bottom py-2"
                        style={{ borderColor: '#333' }}
                    >
                        <div style={{ minWidth: 0 }}>
                            <Text style={{ margin: 0, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {track?.name || 'Unknown track'}
                            </Text>
                            <Text style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>
                                {(track?.duration || 0).toFixed ? `${Math.round(track.duration)}s` : ''}
                            </Text>
                        </div>
                        <div className="d-flex gap-2">
                            <Button size="sm" variant="outline-light" onClick={() => onTrackSelect?.(track)}>
                                Play
                            </Button>
                            <Button
                                size="sm"
                                variant={inPlaylist ? 'secondary' : 'outline-light'}
                                onClick={() => onAddToPlaylist?.(track)}
                                disabled={inPlaylist}
                            >
                                {inPlaylist ? 'Added' : '+'}
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default SoundCloudLibraryPanel;
