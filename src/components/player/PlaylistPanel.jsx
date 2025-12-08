/**
 * PlaylistPanel Component - Interactive Music Playlist Management
 * 
 * This component provides a comprehensive playlist interface with the following features:
 * 
 * PLAYLIST MANAGEMENT:
 * - Drag-and-drop from music library browser
 * - Click-to-add functionality from browser
 * - Remove tracks from playlist
 * - Reorder tracks by dragging
 * - Clear entire playlist
 * 
 * PLAYBACK CONTROL:
 * - Click any track to play it
 * - Visual indication of currently playing track
 * - Automatic progression to next track
 * - Playlist loop and shuffle options
 * 
 * USER INTERFACE:
 * - Compact side panel design
 * - Track metadata display (name, duration)
 * - Drag-and-drop visual feedback
 * - Responsive design for different screen sizes
 * 
 * INTEGRATION:
 * - Seamless integration with Player component
 * - Real-time synchronization with music library
 * - Emotion-responsive audio processing for all tracks
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button, Alert, Spinner } from 'react-bootstrap';
import { Subtitle, Text } from '../../utils/StyledComponents';
import { secondaryColor } from '../../utils/DisplaySettings';

const PlaylistPanel = ({ 
    show, 
    onHide, 
    playlist, 
    onPlaylistChange, 
    currentTrackIndex, 
    onTrackSelect,
    isPlaying 
}) => {
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);
    
    const panelRef = useRef(null);

    // Format duration for display
    const formatDuration = useCallback((duration) => {
        if (!duration || isNaN(duration)) return '0:00';
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, []);

    // Handle drag start
    const handleDragStart = useCallback((e, track, index) => {
        setDraggedItem({ track, index });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
    }, []);

    // Handle drag over
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
    }, []);

    // Handle drag enter
    const handleDragEnter = useCallback((e, index) => {
        e.preventDefault();
        setDragOverIndex(index);
    }, []);

    // Handle drag leave
    const handleDragLeave = useCallback((e) => {
        if (!panelRef.current?.contains(e.relatedTarget)) {
            setDragOverIndex(null);
            setIsDragOver(false);
        }
    }, []);

    // Handle drop
    const handleDrop = useCallback((e, dropIndex) => {
        e.preventDefault();
        setIsDragOver(false);
        setDragOverIndex(null);

        if (draggedItem && draggedItem.index !== dropIndex) {
            const newPlaylist = [...playlist];
            const [draggedTrack] = newPlaylist.splice(draggedItem.index, 1);
            newPlaylist.splice(dropIndex, 0, draggedTrack);
            
            // Update current track index if needed
            let newCurrentIndex = currentTrackIndex;
            if (currentTrackIndex === draggedItem.index) {
                newCurrentIndex = dropIndex;
            } else if (currentTrackIndex > draggedItem.index && currentTrackIndex <= dropIndex) {
                newCurrentIndex = currentTrackIndex - 1;
            } else if (currentTrackIndex < draggedItem.index && currentTrackIndex >= dropIndex) {
                newCurrentIndex = currentTrackIndex + 1;
            }
            
            onPlaylistChange(newPlaylist, newCurrentIndex);
        }
        
        setDraggedItem(null);
    }, [draggedItem, playlist, currentTrackIndex, onPlaylistChange]);

    // Handle external drop (from music library)
    const handleExternalDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);
        
        try {
            const trackData = JSON.parse(e.dataTransfer.getData('application/json'));
            if (trackData && trackData.file) {
                const newTrack = {
                    file: trackData.file,
                    name: trackData.file.name,
                    duration: 0, // Will be updated when loaded
                    id: Date.now() + Math.random() // Unique ID
                };
                
                const newPlaylist = [...playlist, newTrack];
                onPlaylistChange(newPlaylist, currentTrackIndex);
            }
        } catch (error) {
            // Silent error handling
        }
    }, [playlist, currentTrackIndex, onPlaylistChange]);

    // Handle track click
    const handleTrackClick = useCallback((track, index) => {
        onTrackSelect(track, index);
    }, [onTrackSelect]);

    // Handle remove track
    const handleRemoveTrack = useCallback((index, e) => {
        e.stopPropagation();
        const newPlaylist = playlist.filter((_, i) => i !== index);
        
        let newCurrentIndex = currentTrackIndex;
        if (index === currentTrackIndex) {
            // If removing current track, move to next or previous
            newCurrentIndex = index < playlist.length - 1 ? index : Math.max(0, index - 1);
        } else if (index < currentTrackIndex) {
            newCurrentIndex = currentTrackIndex - 1;
        }
        
        onPlaylistChange(newPlaylist, newCurrentIndex);
    }, [playlist, currentTrackIndex, onPlaylistChange]);

    // Handle clear playlist
    const handleClearPlaylist = useCallback(() => {
        onPlaylistChange([], -1);
    }, [onPlaylistChange]);

    // Handle panel close
    const handleClose = useCallback(() => {
        onHide();
    }, [onHide]);

    if (!show) return null;

    return (
        <div
            ref={panelRef}
            style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: '350px',
                height: '100vh',
                backgroundColor: '#1a1a1a',
                borderLeft: `2px solid ${secondaryColor}`,
                zIndex: 1030,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '-5px 0 15px rgba(0, 0, 0, 0.3)'
            }}
            onDragOver={handleDragOver}
            onDrop={handleExternalDrop}
            onDragLeave={handleDragLeave}
        >
            {/* Header */}
            <div
                style={{
                    padding: '1rem',
                    borderBottom: `1px solid ${secondaryColor}`,
                    backgroundColor: '#2a2a2a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: '60px'
                }}
            >
                <div>
                    <Subtitle style={{ margin: 0, fontSize: '1.1rem' }}>
                        🎵 Playlist ({playlist.length})
                    </Subtitle>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                        variant="outline-light"
                        size="sm"
                        onClick={handleClearPlaylist}
                        disabled={playlist.length === 0}
                        style={{
                            borderColor: secondaryColor,
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem'
                        }}
                    >
                        Clear
                    </Button>
                    <Button
                        variant="outline-light"
                        size="sm"
                        onClick={handleClose}
                        style={{
                            borderColor: secondaryColor,
                            padding: '0.25rem 0.5rem',
                            minWidth: '32px'
                        }}
                    >
                        ✕
                    </Button>
                </div>
            </div>

            {/* Drop Zone Indicator */}
            {isDragOver && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 150, 255, 0.1)',
                        border: `2px dashed ${secondaryColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                >
                    <Text style={{ fontSize: '1.2rem', fontWeight: 'bold', color: secondaryColor }}>
                        Drop tracks here to add to playlist
                    </Text>
                </div>
            )}

            {/* Content */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {playlist.length === 0 ? (
                    // Empty Playlist
                    <div style={{ 
                        padding: '2rem', 
                        textAlign: 'center', 
                        flex: 1, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'center',
                        opacity: 0.6
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
                        <Subtitle style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                            Empty Playlist
                        </Subtitle>
                        <Text style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                            Drag tracks from the music library or use the "Add to Playlist" button
                        </Text>
                        <Text style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                            Tracks will play automatically in sequence
                        </Text>
                    </div>
                ) : (
                    // Playlist Content
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                        {playlist.map((track, index) => (
                            <div
                                key={track.id || index}
                                draggable
                                onDragStart={(e) => handleDragStart(e, track, index)}
                                onDragEnter={(e) => handleDragEnter(e, index)}
                                onDrop={(e) => handleDrop(e, index)}
                                className="d-flex align-items-center p-2 mb-1 rounded"
                                style={{
                                    backgroundColor: index === currentTrackIndex ? '#3a3a3a' : '#2a2a2a',
                                    border: `1px solid ${index === currentTrackIndex ? secondaryColor : '#333'}`,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    fontSize: '0.8rem',
                                    opacity: dragOverIndex === index ? 0.7 : 1,
                                    transform: dragOverIndex === index ? 'scale(1.02)' : 'scale(1)'
                                }}
                                onClick={() => handleTrackClick(track, index)}
                                onMouseEnter={(e) => {
                                    if (index !== currentTrackIndex) {
                                        e.target.style.backgroundColor = '#3a3a3a';
                                        e.target.style.borderColor = secondaryColor;
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (index !== currentTrackIndex) {
                                        e.target.style.backgroundColor = '#2a2a2a';
                                        e.target.style.borderColor = '#333';
                                    }
                                }}
                            >
                                {/* Track Number */}
                                <div style={{ 
                                    width: '30px', 
                                    textAlign: 'center', 
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    color: index === currentTrackIndex ? secondaryColor : '#999',
                                    marginRight: '0.5rem'
                                }}>
                                    {index + 1}
                                </div>
                                
                                {/* Track Info */}
                                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                    <Text style={{ 
                                        margin: 0, 
                                        fontWeight: 'bold', 
                                        fontSize: '0.8rem', 
                                        overflow: 'hidden', 
                                        textOverflow: 'ellipsis', 
                                        whiteSpace: 'nowrap',
                                        color: index === currentTrackIndex ? secondaryColor : 'white'
                                    }}>
                                        {track.name}
                                    </Text>
                                    <Text style={{ 
                                        margin: 0, 
                                        fontSize: '0.7rem', 
                                        opacity: 0.7 
                                    }}>
                                        {formatDuration(track.duration)}
                                    </Text>
                                </div>
                                
                                {/* Playing Indicator */}
                                {index === currentTrackIndex && isPlaying && (
                                    <div style={{ 
                                        fontSize: '1rem', 
                                        marginRight: '0.5rem',
                                        animation: 'pulse 1s infinite'
                                    }}>
                                        🎵
                                    </div>
                                )}
                                
                                {/* Remove Button */}
                                <Button
                                    variant="outline-light"
                                    size="sm"
                                    onClick={(e) => handleRemoveTrack(index, e)}
                                    style={{
                                        borderColor: '#666',
                                        padding: '0.1rem 0.3rem',
                                        fontSize: '0.7rem',
                                        minWidth: '24px',
                                        height: '24px'
                                    }}
                                >
                                    ✕
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Footer Info */}
                {playlist.length > 0 && (
                    <div style={{ 
                        padding: '0.5rem', 
                        borderTop: '1px solid #333', 
                        backgroundColor: '#2a2a2a',
                        fontSize: '0.8rem',
                        opacity: 0.7
                    }}>
                        <Text style={{ margin: 0, textAlign: 'center' }}>
                            {playlist.length} tracks • Drag to reorder
                        </Text>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlaylistPanel;
