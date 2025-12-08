/**
 * PlaylistCard Component - Integrated Music Playlist Management
 * 
 * This component provides playlist functionality integrated into the main player layout
 * using StyledCard instead of a fixed side panel.
 * 
 * FEATURES:
 * - Drag-and-drop from music library browser
 * - Click-to-add functionality from browser
 * - Remove tracks from playlist
 * - Reorder tracks by dragging
 * - Clear entire playlist
 * - Click any track to play it
 * - Visual indication of currently playing track
 * - Automatic progression to next track
 * 
 * DESIGN:
 * - Uses StyledCard for consistent styling with the app
 * - Integrated into main player layout below controls
 * - Responsive design that works on all screen sizes
 * - Compact but functional interface
 */

import React, { useState, useRef, useCallback } from 'react';
import { Button, Alert } from 'react-bootstrap';
import { Subtitle, Text } from '../../utils/StyledComponents';
import { StyledCard } from '../../utils/StyledComponents';
import { secondaryColor } from '../../utils/DisplaySettings';

const PlaylistCard = ({ 
    playlist, 
    onPlaylistChange, 
    currentTrackIndex, 
    onTrackSelect,
    isPlaying 
}) => {
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);
    
    const cardRef = useRef(null);

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
        
        // Add visual feedback
        e.target.style.opacity = '0.5';
    }, []);

    // Handle drag over for external drops
    const handleCardDragOver = useCallback((e) => {
        // Only handle external drags (from music library), not internal track reordering
        if (!draggedItem) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setIsDragOver(true);
            // Drag over playlist card (external)
        }
    }, [draggedItem]);

    // Handle drag over for track reordering
    const handleTrackDragOver = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.stopPropagation();
    }, []);

    // Handle drag enter for track reordering
    const handleTrackDragEnter = useCallback((e, index) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverIndex(index);
    }, []);

    // Handle drag leave
    const handleDragLeave = useCallback((e) => {
        if (!cardRef.current?.contains(e.relatedTarget)) {
            setDragOverIndex(null);
            // Only clear external drag over state if not doing internal reordering
            if (!draggedItem) {
                setIsDragOver(false);
            }
        }
    }, [draggedItem]);

    // Handle drop for track reordering
    const handleTrackDrop = useCallback((e, dropIndex) => {
        e.preventDefault();
        e.stopPropagation();
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

    // Handle drag end
    const handleDragEnd = useCallback((e) => {
        e.target.style.opacity = '1';
        setDraggedItem(null);
        setDragOverIndex(null);
        setIsDragOver(false);
    }, []);

    // Handle external drop (from music library)
    const handleExternalDrop = useCallback((e) => {
        // Only handle external drops (from music library), not internal track reordering
        if (!draggedItem) {
            e.preventDefault();
            setIsDragOver(false);
            
            // Drop event triggered (external)
            
            try {
                // Check if we have a file from the global reference
                if (window.draggedFile) {
                    const file = window.draggedFile;
                    // Adding file to playlist
                    
                    const newTrack = {
                        file: file,
                        name: file.name,
                        duration: 0, // Will be updated when loaded
                        id: Date.now() + Math.random() // Unique ID
                    };
                    
                    const newPlaylist = [...playlist, newTrack];
                    onPlaylistChange(newPlaylist, currentTrackIndex);
                    
                    // Clear the global reference
                    window.draggedFile = null;
                    // File added successfully to playlist
                } else {
                    // Fallback: try to get data from text/plain
                    const fileName = e.dataTransfer.getData('text/plain');
                    if (fileName) {
                        // File name received but cannot reconstruct file object
                    } else {
                        // No file data found in drop event
                    }
                }
            } catch (error) {
                // Silent error handling
            }
        }
    }, [playlist, currentTrackIndex, onPlaylistChange, draggedItem]);

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

    // Always render the card, even when empty, to allow drag-and-drop

    return (
        <StyledCard 
            ref={cardRef}
            onDragOver={handleCardDragOver}
            onDrop={handleExternalDrop}
            onDragLeave={handleDragLeave}
            style={{ position: 'relative' }}
        >
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
                        borderRadius: '0.9375rem',
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

            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-3">
                <Subtitle style={{ margin: 0, fontSize: '1.1rem' }}>
                    🎵 Playlist ({playlist.length})
                </Subtitle>
                <Button
                    variant="outline-light"
                    size="sm"
                    onClick={handleClearPlaylist}
                    style={{
                        borderColor: secondaryColor,
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.8rem'
                    }}
                >
                    Clear All
                </Button>
            </div>

            {/* Playlist Content */}
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
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
                    <>
                        {playlist.map((track, index) => (
                    <div
                        key={track.id || index}
                        draggable
                        onDragStart={(e) => handleDragStart(e, track, index)}
                        onDragOver={handleTrackDragOver}
                        onDragEnter={(e) => handleTrackDragEnter(e, index)}
                        onDrop={(e) => handleTrackDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        className="d-flex align-items-center p-2 mb-2 rounded"
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
                        {/* Drag Handle */}
                        <div style={{ 
                            width: '20px', 
                            textAlign: 'center', 
                            fontSize: '1rem',
                            color: '#666',
                            marginRight: '0.5rem',
                            cursor: 'grab'
                        }}>
                            ⋮⋮
                        </div>
                        
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
                    </>
                )}
            </div>
            
            {/* Footer Info */}
            {playlist.length > 0 && (
                <div style={{ 
                    marginTop: '0.5rem', 
                    paddingTop: '0.5rem', 
                    borderTop: '1px solid #333', 
                    fontSize: '0.8rem',
                    opacity: 0.7,
                    textAlign: 'center'
                }}>
                    <Text style={{ margin: 0 }}>
                        Drag tracks from music library or use the "+" button • Drag to reorder
                    </Text>
                </div>
            )}
        </StyledCard>
    );
};

export default PlaylistCard;
