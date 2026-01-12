import React, { useState, useRef, useCallback } from 'react';
import { Image } from 'react-bootstrap';
import { Subtitle, StyledCard } from '../utils/StyledComponents';
import ExpandReduceButton from '../utils/ExpandReduceButton';
import { secondaryColor } from '../utils/DisplaySettings';
import Player from '../components/player/Player';
import PlaylistCard from '../components/player/PlaylistCard';
import MusicLibraryPanel from '../components/player/MusicLibraryPanel';
import magicPlayerImage from '../images/magicplayer.png';

const LocalPlayerPage = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [playlist, setPlaylist] = useState([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
    const [isFromLibrary, setIsFromLibrary] = useState(false);
    const [error, setError] = useState('');
    const audioRef = useRef(null);

    // Check if we have a placeholder file (folder selection without specific file)
    const isPlaceholderFile = useCallback(() => {
        return selectedFile && selectedFile.name && selectedFile.name.includes(' - Music Library');
    }, [selectedFile]);


    // Handle playlist change (reorder, remove, etc.)
    const handlePlaylistChange = useCallback((newPlaylist, newCurrentIndex) => {
        setPlaylist(newPlaylist);
        setCurrentTrackIndex(newCurrentIndex);
    }, []);

    // Handle track selection from playlist
    const handlePlaylistTrackSelect = useCallback(async (track, index, autoPlay = false) => {
        setError('');
        
        // Store the current playing state
        const wasPlaying = audioRef.current && !audioRef.current.paused;
        
        setSelectedFile(track.file);
        setIsFromLibrary(true);
        setCurrentTrackIndex(index);
        
        // Create audio URL and load it
        const audioUrl = URL.createObjectURL(track.file);
        if (audioRef.current) {
            audioRef.current.src = audioUrl;
            audioRef.current.load();
            
            // If the player was playing or this is auto-play, automatically start the new track
            if (wasPlaying || autoPlay) {
                try {
                    const playNewTrack = () => {
                        if (audioRef.current && audioRef.current.readyState >= 2) {
                            audioRef.current.play().then(() => {
                                // Playback started successfully
                            }).catch((error) => {
                                console.error('Auto-play failed:', error);
                                setError(`Failed to auto-play: ${error.message}`);
                            });
                        } else {
                            setTimeout(playNewTrack, 100);
                        }
                    };
                    
                    setTimeout(playNewTrack, 200);
                } catch (error) {
                    console.error('Error setting up auto-play:', error);
                }
            }
        }
    }, []);

    // Handle music library file selection
    const handleMusicLibraryFileSelect = useCallback(async (file) => {
        setError('');
        
        // Store the current playing state
        const wasPlaying = audioRef.current && !audioRef.current.paused;
        
        setSelectedFile(file);
        setIsFromLibrary(true);
        
        // Create audio URL and load it
        const audioUrl = URL.createObjectURL(file);
        if (audioRef.current) {
            audioRef.current.src = audioUrl;
            audioRef.current.load();
            
            // If the player was playing, automatically start the new track
            if (wasPlaying) {
                try {
                    const playNewTrack = () => {
                        if (audioRef.current && audioRef.current.readyState >= 2) {
                            audioRef.current.play().then(() => {
                                // Playback started successfully
                            }).catch((error) => {
                                console.error('Auto-play failed:', error);
                                setError(`Failed to auto-play: ${error.message}`);
                            });
                        } else {
                            setTimeout(playNewTrack, 100);
                        }
                    };
                    
                    setTimeout(playNewTrack, 200);
                } catch (error) {
                    console.error('Error setting up auto-play:', error);
                }
            }
        }
    }, []);

    // Handle adding track to playlist
    const handleAddToPlaylist = useCallback((file) => {
        const newTrack = {
            file: file,
            name: file.name,
            duration: 0, // Will be updated when loaded
            id: Date.now() + Math.random() // Unique ID
        };
        
        const newPlaylist = [...playlist, newTrack];
        setPlaylist(newPlaylist);
    }, [playlist]);

    // Handle when a music library folder is loaded
    const handleMusicLibraryFolderLoaded = useCallback((folderName) => {
        // Create a placeholder file to enable the main interface
        const placeholderFile = new File([''], `${folderName} - Music Library`, { type: 'audio/mp3' });
        
        // Set the library mode
        setSelectedFile(placeholderFile);
        setIsFromLibrary(true);
        
        // Clear any existing audio source since no specific file is selected
        if (audioRef.current) {
            audioRef.current.src = '';
            audioRef.current.load();
        }
    }, []);

    // Check if user is logged in for demo session logic
    const isDemoSession = !localStorage.getItem('idToken');

    // Auto-create placeholder file when component mounts (folder was selected)
    React.useEffect(() => {
        if (!selectedFile) {
            const placeholderFile = new File([''], 'Selected Music Folder - Music Library', { type: 'audio/mp3' });
            setSelectedFile(placeholderFile);
            setIsFromLibrary(true);
        }
    }, [selectedFile]);

    // Store the selected folder from WelcomePlayerPage
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [musicFiles, setMusicFiles] = useState([]);
    const [isMusicLibraryExpanded, setIsMusicLibraryExpanded] = useState(false);

    // Load music files from global variable when component mounts
    React.useEffect(() => {
        if (window.selectedMusicFiles && window.selectedMusicFiles.length > 0) {
            setMusicFiles(window.selectedMusicFiles);
            console.log('Loaded music files:', window.selectedMusicFiles.length);
        }
    }, []);

    return (
        <Player
            selectedFile={selectedFile}
            isDemoTrack={false}
            pageName="local-player"
            audioRef={audioRef}
            playlist={playlist}
            currentTrackIndex={currentTrackIndex}
            onPlaylistChange={handlePlaylistChange}
            onTrackSelect={handlePlaylistTrackSelect}
        >
            {/* Welcome Image - Only show when no file is selected */}
            {!selectedFile && (
                <div className="text-center mb-4">
                    <Image
                        src={magicPlayerImage}
                        alt="Magic Player"
                        fluid
                        style={{ maxWidth: '100%' }}
                    />
                </div>
            )}

            {/* File Selection Display */}
            {selectedFile && !isPlaceholderFile() && (
                <div className="text-center mb-4">
                    <Subtitle style={{ margin: 0 }}>
                        <strong>Playing:</strong> {selectedFile.name}
                    </Subtitle>
                </div>
            )}

            {/* Playlist Card - Only show when in library mode and playlist has tracks */}
            {isFromLibrary && (playlist.length > 0 || selectedFile) && (
                <PlaylistCard
                    playlist={playlist}
                    onPlaylistChange={handlePlaylistChange}
                    currentTrackIndex={currentTrackIndex}
                    onTrackSelect={handlePlaylistTrackSelect}
                    isPlaying={audioRef.current && !audioRef.current.paused}
                />
            )}

            {/* Music Library Card - Always show since folder is always selected */}
            <StyledCard className="mb-4" data-music-library-card>
                <div className="d-flex align-items-center justify-content-between mb-3">
                    <Subtitle style={{ margin: 0, fontSize: '1.1rem' }}>
                        📁 Music Library
                    </Subtitle>
                    <ExpandReduceButton
                        isExpanded={isMusicLibraryExpanded}
                        onToggle={() => setIsMusicLibraryExpanded(!isMusicLibraryExpanded)}
                    />
                </div>
                
                {isMusicLibraryExpanded && (
                    <MusicLibraryPanel
                        show={true}
                        onHide={() => {}}
                        onFileSelect={handleMusicLibraryFileSelect}
                        onAddToPlaylist={handleAddToPlaylist}
                        onFolderLoaded={handleMusicLibraryFolderLoaded}
                        isDemoSession={isDemoSession}
                        musicFiles={musicFiles}
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
        </Player>
    );
};

export default LocalPlayerPage;
