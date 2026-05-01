/**
 * SoundCloudLibraryPanel Component
 * 
 * Provides a browsing interface for SoundCloud content, similar to MusicLibraryPanel
 * but for streaming tracks instead of local files.
 * 
 * FEATURES:
 * - Search SoundCloud tracks
 * - Browse user's own tracks
 * - Browse user's liked tracks
 * - Browse user's playlists
 * - Play and add-to-playlist buttons per track
 * - Track artwork, title, artist, and duration display
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Button, Form, Spinner, Nav } from 'react-bootstrap';
import { Subtitle, Text } from '../../styles/StyledComponents';
import { secondaryColor } from '../../utils/DisplaySettings';
import {
    searchTracks,
    getMyTracks,
    getMyLikes,
    getMyPlaylists,
    getPlaylistTracks,
    normalizeTrack,
    formatDuration,
    soundCloudTrackIdForApi,
} from '../../utils/soundcloudService';

const PAGE_SIZE = 30;

/** Scroll region for long track / playlist lists (flex-friendly + touch momentum). */
const SCROLLABLE_LIST_STYLE = {
    flex: '1 1 auto',
    minHeight: 0,
    maxHeight: 'min(55vh, 520px)',
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
};

const SoundCloudLibraryPanel = ({
    show,
    accessToken,
    onTrackSelect,
    onAddToPlaylist,
    playlist = [],
}) => {
    const [activeTab, setActiveTab] = useState('search');
    const [searchTerm, setSearchTerm] = useState('');
    const [tracks, setTracks] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Check if a SoundCloud track is already in the playlist
    const isTrackInPlaylist = useCallback((scTrack) => {
        const trackId = soundCloudTrackIdForApi(scTrack) ?? scTrack.urn ?? scTrack.id;
        return playlist.some((t) => t.id === trackId);
    }, [playlist]);

    // Load tracks based on active tab
    const loadTracks = useCallback(async (resetOffset = true) => {
        if (!accessToken && activeTab !== 'search') return;

        setLoading(true);
        setError('');
        const currentOffset = resetOffset ? 0 : offset;

        try {
            let result = [];

            switch (activeTab) {
                case 'search':
                    if (!searchTerm.trim()) {
                        setTracks([]);
                        setLoading(false);
                        return;
                    }
                    result = await searchTracks(searchTerm, accessToken, PAGE_SIZE, currentOffset);
                    break;
                case 'mytracks':
                    result = await getMyTracks(accessToken, PAGE_SIZE, currentOffset);
                    if (result.collection) result = result.collection;
                    break;
                case 'likes':
                    result = await getMyLikes(accessToken, PAGE_SIZE, currentOffset);
                    break;
                case 'playlists':
                    if (selectedPlaylist) {
                        result = await getPlaylistTracks(selectedPlaylist.id, accessToken);
                    } else {
                        const playlistData = await getMyPlaylists(accessToken, PAGE_SIZE, currentOffset);
                        const playlistList = playlistData.collection || playlistData;
                        setPlaylists(Array.isArray(playlistList) ? playlistList : []);
                        setLoading(false);
                        return;
                    }
                    break;
                default:
                    break;
            }

            const trackList = Array.isArray(result) ? result : [];
            setHasMore(trackList.length === PAGE_SIZE);

            if (activeTab === 'playlists' && selectedPlaylist) {
                const expected = selectedPlaylist.track_count ?? selectedPlaylist.tracks_count;
                const countsMatch =
                    expected == null ? null : Number(expected) === trackList.length;
                console.info('[SoundCloud playlist UI]', {
                    tracksInList: trackList.length,
                    playlistTrackCount: expected ?? '(not on playlist object)',
                    countsMatch: countsMatch === null ? 'n/a' : countsMatch ? 'yes' : 'NO',
                    tip:
                        'Fetch/pagination logs: localStorage.setItem("DEBUG_SC_PLAYLIST","1") then reload — filter console by [SoundCloud playlist]',
                });
            }

            if (resetOffset) {
                setTracks(trackList);
                setOffset(PAGE_SIZE);
            } else {
                setTracks(prev => [...prev, ...trackList]);
                setOffset(prev => prev + PAGE_SIZE);
            }
        } catch (err) {
            console.error('Failed to load SoundCloud tracks:', err);
            setError(err.message || 'Failed to load tracks.');
        } finally {
            setLoading(false);
        }
    }, [accessToken, activeTab, searchTerm, offset, selectedPlaylist]);

    // Load on tab change
    useEffect(() => {
        if (show && activeTab !== 'search') {
            setSelectedPlaylist(null);
            loadTracks(true);
        }
    }, [activeTab, show]); // eslint-disable-line react-hooks/exhaustive-deps

    // Handle search submit
    const handleSearch = useCallback((e) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            loadTracks(true);
        }
    }, [searchTerm, loadTracks]);

    // Handle track click (play immediately)
    const handleTrackClick = useCallback((scTrack) => {
        const normalized = normalizeTrack(scTrack);
        onTrackSelect(normalized);
    }, [onTrackSelect]);

    // Handle drag start to load a track into a deck
    const handleTrackDragStart = useCallback((e, scTrack) => {
        const normalized = normalizeTrack(scTrack);
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', normalized.name || normalized.title || 'soundcloud-track');
        e.dataTransfer.setData('application/x-soundbloom-track', JSON.stringify(normalized));
        window.draggedTrack = normalized;
    }, []);

    // Handle add to playlist
    const handleAddToPlaylist = useCallback((scTrack, e) => {
        e.stopPropagation();
        if (!isTrackInPlaylist(scTrack)) {
            const normalized = normalizeTrack(scTrack);
            onAddToPlaylist(normalized);
        }
    }, [onAddToPlaylist, isTrackInPlaylist]);

    // Handle playlist selection
    const handlePlaylistClick = useCallback((pl) => {
        setSelectedPlaylist(pl);
        setTracks([]);
        setOffset(0);
    }, []);

    // Load playlist tracks when selected
    useEffect(() => {
        if (selectedPlaylist) {
            loadTracks(true);
        }
    }, [selectedPlaylist]); // eslint-disable-line react-hooks/exhaustive-deps

    // Get high-res artwork URL
    const getArtworkUrl = useCallback((url) => {
        if (!url) return null;
        return url.replace('-large', '-t200x200');
    }, []);

    if (!show) return null;

    return (
        <div style={{
            width: '100%',
            backgroundColor: 'transparent',
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 auto',
            minHeight: 0,
        }}>
            {/* Tab Navigation */}
            <Nav
                variant="tabs"
                activeKey={activeTab}
                onSelect={(key) => setActiveTab(key)}
                className="mb-3"
                style={{ borderBottomColor: '#333' }}
            >
                <Nav.Item>
                    <Nav.Link
                        eventKey="search"
                        style={{
                            color: activeTab === 'search' ? secondaryColor : '#999',
                            backgroundColor: activeTab === 'search' ? '#2a2a2a' : 'transparent',
                            borderColor: activeTab === 'search' ? `${secondaryColor} ${secondaryColor} #2a2a2a` : 'transparent',
                            fontSize: '0.85rem',
                        }}
                    >
                        Search
                    </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                    <Nav.Link
                        eventKey="mytracks"
                        style={{
                            color: activeTab === 'mytracks' ? secondaryColor : '#999',
                            backgroundColor: activeTab === 'mytracks' ? '#2a2a2a' : 'transparent',
                            borderColor: activeTab === 'mytracks' ? `${secondaryColor} ${secondaryColor} #2a2a2a` : 'transparent',
                            fontSize: '0.85rem',
                        }}
                    >
                        My Tracks
                    </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                    <Nav.Link
                        eventKey="likes"
                        style={{
                            color: activeTab === 'likes' ? secondaryColor : '#999',
                            backgroundColor: activeTab === 'likes' ? '#2a2a2a' : 'transparent',
                            borderColor: activeTab === 'likes' ? `${secondaryColor} ${secondaryColor} #2a2a2a` : 'transparent',
                            fontSize: '0.85rem',
                        }}
                    >
                        Likes
                    </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                    <Nav.Link
                        eventKey="playlists"
                        style={{
                            color: activeTab === 'playlists' ? secondaryColor : '#999',
                            backgroundColor: activeTab === 'playlists' ? '#2a2a2a' : 'transparent',
                            borderColor: activeTab === 'playlists' ? `${secondaryColor} ${secondaryColor} #2a2a2a` : 'transparent',
                            fontSize: '0.85rem',
                        }}
                    >
                        Playlists
                    </Nav.Link>
                </Nav.Item>
            </Nav>

            {/* Search Bar (always visible on search tab) */}
            {activeTab === 'search' && (
                <Form onSubmit={handleSearch} className="mb-3">
                    <div className="d-flex gap-2">
                        <Form.Control
                            type="text"
                            placeholder="Search SoundCloud..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                borderColor: secondaryColor,
                                fontSize: '0.9rem',
                                backgroundColor: '#2a2a2a',
                                color: 'white',
                            }}
                        />
                        <Button
                            type="submit"
                            variant="outline-light"
                            disabled={loading || !searchTerm.trim()}
                            style={{
                                borderColor: secondaryColor,
                                fontSize: '0.85rem',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {loading ? <Spinner size="sm" /> : 'Search'}
                        </Button>
                    </div>
                </Form>
            )}

            {/* Playlist breadcrumb */}
            {activeTab === 'playlists' && selectedPlaylist && (
                <div className="d-flex align-items-center mb-2">
                    <span
                        onClick={() => { setSelectedPlaylist(null); setTracks([]); loadTracks(true); }}
                        style={{
                            cursor: 'pointer',
                            color: secondaryColor,
                            fontSize: '0.85rem',
                            textDecoration: 'underline',
                        }}
                    >
                        Playlists
                    </span>
                    <span style={{ margin: '0 0.5rem', color: '#666' }}>/</span>
                    <Text style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold' }}>
                        {selectedPlaylist.title}
                    </Text>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="alert alert-danger" style={{ fontSize: '0.8rem' }}>
                    {error}
                </div>
            )}

            {/* Loading Indicator */}
            {loading && tracks.length === 0 && (
                <div className="text-center py-3">
                    <Spinner size="sm" className="me-2" />
                    <Text style={{ opacity: 0.8, fontSize: '0.8rem', display: 'inline' }}>Loading...</Text>
                </div>
            )}

            {/* Playlist List (when no playlist is selected) */}
            {activeTab === 'playlists' && !selectedPlaylist && !loading && (
                <div style={SCROLLABLE_LIST_STYLE}>
                    {playlists.length === 0 ? (
                        <div className="text-center py-4">
                            <Text style={{ opacity: 0.6, fontSize: '0.8rem' }}>
                                No playlists found.
                            </Text>
                        </div>
                    ) : (
                        playlists.map((pl) => (
                            <div
                                key={pl.id}
                                className="d-flex align-items-center p-2 mb-1 rounded"
                                style={{
                                    backgroundColor: '#2a2a2a',
                                    border: '1px solid #333',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    fontSize: '0.8rem',
                                }}
                                onClick={() => handlePlaylistClick(pl)}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#3a3a3a';
                                    e.currentTarget.style.borderColor = secondaryColor;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#2a2a2a';
                                    e.currentTarget.style.borderColor = '#333';
                                }}
                            >
                                {/* Playlist Artwork */}
                                {pl.artwork_url && (
                                    <img
                                        src={getArtworkUrl(pl.artwork_url)}
                                        alt=""
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '4px',
                                            marginRight: '0.75rem',
                                            objectFit: 'cover',
                                        }}
                                    />
                                )}
                                {!pl.artwork_url && (
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '4px',
                                        marginRight: '0.75rem',
                                        backgroundColor: '#444',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.2rem',
                                    }}>
                                        📋
                                    </div>
                                )}
                                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                    <Text style={{
                                        margin: 0,
                                        fontWeight: 'bold',
                                        fontSize: '0.8rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {pl.title}
                                    </Text>
                                    <Text style={{ margin: 0, fontSize: '0.7rem', opacity: 0.7 }}>
                                        {pl.track_count || 0} tracks
                                    </Text>
                                </div>
                                <div style={{ fontSize: '1rem', opacity: 0.6 }}>→</div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Track List */}
            {(activeTab !== 'playlists' || selectedPlaylist) && !loading && (
                <div style={SCROLLABLE_LIST_STYLE}>
                    {tracks.length === 0 && !loading ? (
                        <div className="text-center py-4">
                            <Text style={{ opacity: 0.6, fontSize: '0.8rem' }}>
                                {activeTab === 'search'
                                    ? (searchTerm ? 'No tracks found.' : 'Search for tracks on SoundCloud.')
                                    : 'No tracks found.'}
                            </Text>
                        </div>
                    ) : (
                        <>
                            {tracks.map((track, index) => (
                                <div
                                    key={`${track.id ?? 'sc'}-${index}`}
                                    draggable
                                    onDragStart={(e) => handleTrackDragStart(e, track)}
                                    onDragEnd={() => {
                                        setTimeout(() => {
                                            window.draggedTrack = null;
                                        }, 100);
                                    }}
                                    className="d-flex align-items-center p-2 mb-1 rounded"
                                    style={{
                                        backgroundColor: '#2a2a2a',
                                        border: '1px solid #333',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        fontSize: '0.8rem',
                                    }}
                                    onClick={() => handleTrackClick(track)}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#3a3a3a';
                                        e.currentTarget.style.borderColor = secondaryColor;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#2a2a2a';
                                        e.currentTarget.style.borderColor = '#333';
                                    }}
                                >
                                    {/* Track Artwork */}
                                    {track.artwork_url ? (
                                        <img
                                            src={getArtworkUrl(track.artwork_url)}
                                            alt=""
                                            style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '4px',
                                                marginRight: '0.75rem',
                                                objectFit: 'cover',
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '4px',
                                            marginRight: '0.75rem',
                                            backgroundColor: '#444',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1.2rem',
                                        }}>
                                            🎵
                                        </div>
                                    )}

                                    {/* Track Info */}
                                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                        <Text style={{
                                            margin: 0,
                                            fontWeight: 'bold',
                                            fontSize: '0.8rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {track.title}
                                        </Text>
                                        <Text style={{ margin: 0, fontSize: '0.7rem', opacity: 0.7 }}>
                                            {track.user?.username || 'Unknown'} · {formatDuration(track.duration)}
                                        </Text>
                                    </div>

                                    {/* Add to Playlist Button */}
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        {!isTrackInPlaylist(track) ? (
                                            <Button
                                                variant="outline-light"
                                                size="sm"
                                                onClick={(e) => handleAddToPlaylist(track, e)}
                                                style={{
                                                    borderColor: secondaryColor,
                                                    padding: '0.1rem 0.3rem',
                                                    fontSize: '0.7rem',
                                                    minWidth: '24px',
                                                    height: '24px',
                                                }}
                                                title="Add to Playlist"
                                            >
                                                +
                                            </Button>
                                        ) : (
                                            <div
                                                style={{
                                                    padding: '0.1rem 0.3rem',
                                                    fontSize: '0.7rem',
                                                    minWidth: '24px',
                                                    height: '24px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#28a745',
                                                    fontWeight: 'bold',
                                                }}
                                                title="Already in Playlist"
                                            >
                                                ✓
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Load More Button */}
                            {hasMore && tracks.length > 0 && (
                                <div className="text-center py-2">
                                    <Button
                                        variant="outline-light"
                                        size="sm"
                                        onClick={() => loadTracks(false)}
                                        disabled={loading}
                                        style={{
                                            borderColor: secondaryColor,
                                            fontSize: '0.8rem',
                                        }}
                                    >
                                        {loading ? <Spinner size="sm" /> : 'Load More'}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default SoundCloudLibraryPanel;
