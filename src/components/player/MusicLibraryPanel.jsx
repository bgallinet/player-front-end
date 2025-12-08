/**
 * MusicLibraryPanel Component - Side Panel Music Library Browser
 * 
 * This component provides a persistent side panel for music library navigation
 * that works alongside the main player without interfering with the experience.
 * Features include:
 * 
 * SIDE PANEL DESIGN:
 * - Fixed position panel that doesn't block the main player
 * - Resizable and collapsible interface
 * - Always visible when music library is loaded
 * - Smooth animations and transitions
 * 
 * NAVIGATION:
 * - Tree-like folder navigation
 * - Breadcrumb navigation
 * - Search functionality
 * - File metadata display
 * 
 * INTEGRATION:
 * - Non-blocking file selection
 * - Real-time track switching
 * - Maintains player state during navigation
 * - Responsive design for different screen sizes
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button, Form, Alert, Spinner } from 'react-bootstrap';
import { Subtitle, Text } from '../../utils/StyledComponents';
import { secondaryColor } from '../../utils/DisplaySettings';
import ExpandReduceButton from '../../utils/ExpandReduceButton';

const MusicLibraryPanel = ({ show, onHide, onFileSelect, onAddToPlaylist, onFolderLoaded, isDemoSession = false, musicFiles = [], playlist = [] }) => {
    const [currentPath, setCurrentPath] = useState('');
    const [folderContents, setFolderContents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [navigationHistory, setNavigationHistory] = useState([]);
    const [isExpanded, setIsExpanded] = useState(true);

    // Supported audio file extensions
    const supportedAudioExtensions = [
        '.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma', '.aiff', '.au'
    ];

    // Check if file is a supported audio format
    const isAudioFile = useCallback((fileName) => {
        const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
        return supportedAudioExtensions.includes(extension);
    }, []);

    // Format file size for display
    const formatFileSize = useCallback((bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }, []);


    // Convert nested folder structure to flat array (only current level)
    const convertToFlatStructure = useCallback((structure, basePath) => {
        const result = [];
        
        // Add folders first
        Object.keys(structure).forEach(key => {
            const item = structure[key];
            if (item.type === 'folder') {
                const folderPath = basePath ? `${basePath}/${key}` : key;
                result.push({
                    name: key,
                    type: 'folder',
                    path: folderPath,
                    contents: item.contents,
                    files: item.files || []
                });
            }
        });
        
        // Add files from current level
        if (structure.files) {
            structure.files.forEach(file => {
                result.push(file);
            });
        }
        
        // Sort folders and files alphabetically
        result.sort((a, b) => a.name.localeCompare(b.name));
        
        return result;
    }, []);

    // Load folder contents using File System Access API
    const loadFolderContents = useCallback(async (directoryHandle, folderName, isInitialSelection = false) => {
        try {
            const contents = [];
            const folders = [];
            const files = [];
            
            // Calculate the new path
            const newPath = isInitialSelection ? folderName : (currentPath ? `${currentPath}/${folderName}` : folderName);

            // Iterate through directory contents
            for await (const [name, handle] of directoryHandle.entries()) {
                if (handle.kind === 'directory') {
                    folders.push({
                        name,
                        type: 'folder',
                        handle,
                        path: `${newPath}/${name}`
                    });
                } else if (handle.kind === 'file' && isAudioFile(name)) {
                    const file = await handle.getFile();
                    files.push({
                        name,
                        type: 'file',
                        size: file.size,
                        file,
                        handle,
                        path: `${newPath}/${name}`
                    });
                }
            }

            // Sort folders and files alphabetically
            folders.sort((a, b) => a.name.localeCompare(b.name));
            files.sort((a, b) => a.name.localeCompare(b.name));

            contents.push(...folders, ...files);
            
            // Folder contents loaded
            
            setFolderContents(contents);
            setCurrentPath(newPath);
            
            // Handle navigation history
            if (isInitialSelection) {
                // For initial selection, set up the root folder in navigation history
                setNavigationHistory([{
                    name: folderName,
                    handle: directoryHandle,
                    path: folderName
                }]);
                
                // Notify parent that folder is loaded
                if (onFolderLoaded) {
                    onFolderLoaded(folderName);
                }
            } else {
                // For navigation, add to existing history
                setNavigationHistory(prev => [...prev, {
                    name: folderName,
                    handle: directoryHandle,
                    path: newPath
                }]);
            }

        } catch (error) {
            // Silent error handling
            setError('Failed to load folder contents. Please try again.');
        }
    }, [currentPath, isAudioFile]);

    // Navigate to a subfolder
    const navigateToFolder = useCallback(async (folderItem) => {
        if (folderItem.type === 'folder') {
            setLoading(true);
            setError('');
            try {
                // Check if this is a File System Access API folder or our custom structure
                if (folderItem.handle) {
                    // File System Access API folder
                    await loadFolderContents(folderItem.handle, folderItem.name);
                } else if (folderItem.contents) {
                    // Custom folder structure from webkitdirectory
                    const folderContents = convertToFlatStructure(folderItem.contents, folderItem.path);
                    setFolderContents(folderContents);
                    setCurrentPath(folderItem.path);
                    
                    // Add to navigation history
                    setNavigationHistory(prev => [...prev, {
                        name: folderItem.name,
                        path: folderItem.path,
                        contents: folderItem.contents
                    }]);
                }
            } catch (error) {
                // Silent error handling
                setError('Failed to navigate to folder.');
            } finally {
                setLoading(false);
            }
        }
    }, [loadFolderContents, convertToFlatStructure]);

    // Navigate back to parent folder
    const navigateBack = useCallback(async () => {
        if (navigationHistory.length > 0) {
            setLoading(true);
            setError('');
            try {
                const parentHistory = [...navigationHistory];
                const currentFolder = parentHistory.pop();
                
                if (parentHistory.length > 0) {
                    const parentFolder = parentHistory[parentHistory.length - 1];
                    
                    // Check if this is a File System Access API folder or custom structure
                    if (parentFolder.handle && parentFolder.handle.kind === 'directory') {
                        // Real File System Access API handle
                        await loadFolderContents(parentFolder.handle, parentFolder.name);
                    } else if (parentFolder.handle && parentFolder.handle.contents) {
                        // Custom structure with fake handle
                        const folderContents = convertToFlatStructure(parentFolder.handle.contents, parentFolder.path);
                        setFolderContents(folderContents);
                        setCurrentPath(parentFolder.path);
                    } else if (parentFolder.contents) {
                        // Direct custom structure
                        const folderContents = convertToFlatStructure(parentFolder.contents, parentFolder.path);
                        setFolderContents(folderContents);
                        setCurrentPath(parentFolder.path);
                    }
                } else {
                    // Go back to root - reload the original folder structure
                    if (musicFiles.length > 0) {
                        const folderStructure = createFolderStructureFromFiles(musicFiles);
                        setFolderContents(folderStructure);
                        setCurrentPath('Music Library');
                    } else {
                        setFolderContents([]);
                        setCurrentPath('Music Library');
                    }
                }
                
                setNavigationHistory(parentHistory);
            } catch (error) {
                // Silent error handling
                setError('Failed to navigate back.');
            } finally {
                setLoading(false);
            }
        }
    }, [navigationHistory, loadFolderContents, convertToFlatStructure]);

    // Navigate to specific folder in history
    const navigateToHistoryItem = useCallback(async (index) => {
        if (index >= 0 && index < navigationHistory.length) {
            setLoading(true);
            setError('');
            try {
                const targetFolder = navigationHistory[index];
                const newHistory = navigationHistory.slice(0, index + 1);
                
                // Check if this is a File System Access API folder or custom structure
                if (targetFolder.handle && targetFolder.handle.kind === 'directory') {
                    // Real File System Access API handle
                    await loadFolderContents(targetFolder.handle, targetFolder.name);
                } else if (targetFolder.handle && targetFolder.handle.contents) {
                    // Custom structure with fake handle
                    const folderContents = convertToFlatStructure(targetFolder.handle.contents, targetFolder.path);
                    setFolderContents(folderContents);
                    setCurrentPath(targetFolder.path);
                } else if (targetFolder.contents) {
                    // Direct custom structure
                    const folderContents = convertToFlatStructure(targetFolder.contents, targetFolder.path);
                    setFolderContents(folderContents);
                    setCurrentPath(targetFolder.path);
                }
                
                setNavigationHistory(newHistory);
            } catch (error) {
                // Silent error handling
                setError('Failed to navigate to folder.');
            } finally {
                setLoading(false);
            }
        }
    }, [navigationHistory, loadFolderContents, convertToFlatStructure]);

    // Handle file selection
    const handleFileClick = useCallback((fileItem) => {
        if (fileItem.type === 'file') {
            onFileSelect(fileItem.file);
        }
    }, [onFileSelect]);

    // Check if a file is already in the playlist
    const isFileInPlaylist = useCallback((file) => {
        return playlist.some(track => 
            track.file && track.file.name === file.name && track.file.size === file.size
        );
    }, [playlist]);

    // Handle add to playlist
    const handleAddToPlaylist = useCallback((fileItem, e) => {
        e.stopPropagation();
        if (fileItem.type === 'file' && onAddToPlaylist && !isFileInPlaylist(fileItem.file)) {
            onAddToPlaylist(fileItem.file);
        }
    }, [onAddToPlaylist, isFileInPlaylist]);

    // Handle drag start for playlist
    const handleDragStart = useCallback((e, fileItem) => {
        if (fileItem.type === 'file') {
            // Drag started for file
            
            // Store the file reference globally so it can be accessed by the drop handler
            window.draggedFile = fileItem.file;
            
            // Set drag data
            e.dataTransfer.setData('text/plain', fileItem.file.name);
            e.dataTransfer.effectAllowed = 'copy';
            
            // File stored globally
        }
    }, []);

    // Handle drag end to cleanup
    const handleDragEnd = useCallback((e) => {
        // Clear the global reference after a short delay to allow drop handler to access it
        setTimeout(() => {
            window.draggedFile = null;
        }, 100);
    }, []);

    // Filter contents based on search term
    const filteredContents = useCallback(() => {
        if (!searchTerm.trim()) {
            return folderContents;
        }
        
        const term = searchTerm.toLowerCase();
        return folderContents.filter(item => 
            item.name.toLowerCase().includes(term)
        );
    }, [folderContents, searchTerm]);

    // Initialize folder when component mounts
    useEffect(() => {
        if (show && folderContents.length === 0 && musicFiles.length > 0) {
            // Process the music files and create folder structure
            processMusicFiles();
        }
    }, [show, folderContents.length, musicFiles]);

    // Process music files and create folder structure
    const processMusicFiles = useCallback(() => {
        setLoading(true);
        setError('');
        
        try {
            // Create folder structure from music files
            const folderStructure = createFolderStructureFromFiles(musicFiles);
            
            // Find the first folder in the structure
            const rootFolder = folderStructure.find(item => item.type === 'folder');
            
            if (rootFolder && rootFolder.contents) {
                // Navigate directly into the root folder
                const folderContents = convertToFlatStructure(rootFolder.contents, rootFolder.path);
                setFolderContents(folderContents);
                setCurrentPath(rootFolder.path);
                setNavigationHistory([{
                    name: rootFolder.name,
                    path: rootFolder.path,
                    contents: rootFolder.contents
                }]);
                // Navigated into root folder
            } else {
                // No folders, just files - show them directly
                setCurrentPath('Music Library');
                setFolderContents(folderStructure);
                setNavigationHistory([{
                    name: 'Music Library',
                    path: 'Music Library',
                    files: folderStructure
                }]);
                // No folders found, showing files directly
            }
            
            // Processed music files
        } catch (error) {
            // Silent error handling
            setError('Failed to process music files.');
        } finally {
            setLoading(false);
        }
    }, [musicFiles, convertToFlatStructure]);

    // Create folder structure from music files
    const createFolderStructureFromFiles = useCallback((files) => {
        // Build hierarchical folder structure
        const folderStructure = {};
        
        // Creating folder structure
        
        files.forEach((file) => {
            const relativePath = file.webkitRelativePath || file.name;
            const pathParts = relativePath.split('/');
            const fileName = pathParts.pop();
            
            // Processing file
            
            // Navigate/create folder structure
            let currentLevel = folderStructure;
            pathParts.forEach(part => {
                if (!currentLevel[part]) {
                    currentLevel[part] = { type: 'folder', contents: {}, files: [] };
                }
                currentLevel = currentLevel[part].contents;
            });
            
            // Add file to the appropriate folder
            if (!currentLevel.files) {
                currentLevel.files = [];
            }
            currentLevel.files.push({
                name: fileName,
                type: 'file',
                size: file.size,
                file: file,
                path: relativePath
            });
        });
        
        // Created folder structure
        
        // Convert to flat structure for root level display
        const flatStructure = convertToFlatStructure(folderStructure, '');
        // Converted to flat structure
        
        return flatStructure;
    }, [convertToFlatStructure]);

    if (!show) return null;

    return (
        <div
            style={{
                width: '100%',
                backgroundColor: 'transparent',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* File Browser Screen */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            {/* Navigation Bar */}
                            <div style={{ padding: '1rem', borderBottom: '1px solid #333' }}>
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    {/* Breadcrumb Navigation */}
                                    <div className="d-flex align-items-center flex-grow-1" style={{ fontSize: '1rem' }}>
                                        <span
                                            onClick={() => navigateToHistoryItem(0)}
                                            style={{ 
                                                textDecoration: 'underline',
                                                cursor: 'pointer',
                                                fontSize: '1rem',
                                                color: 'white',
                                                marginRight: '0.25rem',
                                                transition: 'opacity 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => e.target.style.opacity = '0.7'}
                                            onMouseLeave={(e) => e.target.style.opacity = '1'}
                                        >
                                            🏠
                                        </span>
                                        
                                        {navigationHistory.slice(1).map((item, index) => (
                                            <React.Fragment key={index + 1}>
                                                <span style={{ margin: '0 0.25rem', opacity: 0.6 }}>/</span>
                                                <span
                                                    onClick={() => navigateToHistoryItem(index + 1)}
                                                    style={{ 
                                                        textDecoration: 'underline',
                                                        cursor: 'pointer',
                                                        fontSize: '1rem',
                                                        color: 'white',
                                                        transition: 'opacity 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.opacity = '0.7'}
                                                    onMouseLeave={(e) => e.target.style.opacity = '1'}
                                                >
                                                    {item.name}
                                                </span>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                    
                                </div>
                                
                                {/* Search Bar */}
                                <Form.Control
                                    type="text"
                                    placeholder="Search files..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{
                                        borderColor: secondaryColor,
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>
                            
                            {/* Error Display */}
                            {error && (
                                <Alert variant="danger" style={{ margin: '1rem', fontSize: '0.8rem' }}>
                                    {error}
                                </Alert>
                            )}
                            
                            {/* Loading Indicator */}
                            {loading && (
                                <div className="text-center py-3">
                                    <Spinner size="sm" className="me-2" />
                                    <Text style={{ opacity: 0.8, fontSize: '0.8rem' }}>Loading...</Text>
                                </div>
                            )}
                            
                            {/* File and Folder List */}
                            {!loading && (
                                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                                    {filteredContents().length === 0 ? (
                                        <div className="text-center py-4">
                                            <Text style={{ opacity: 0.6, fontSize: '0.8rem' }}>
                                                {searchTerm ? 'No files match your search.' : 'No audio files found in this folder.'}
                                            </Text>
                                        </div>
                                    ) : (
                                        <div>
                                            {filteredContents().map((item, index) => (
                                                <div
                                                    key={index}
                                                    draggable={item.type === 'file'}
                                                    onDragStart={(e) => item.type === 'file' ? handleDragStart(e, item) : null}
                                                    onDragEnd={handleDragEnd}
                                                    className="d-flex align-items-center p-2 mb-1 rounded"
                                                    style={{
                                                        backgroundColor: '#2a2a2a',
                                                        border: '1px solid #333',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        fontSize: '0.8rem'
                                                    }}
                                                    onClick={() => item.type === 'folder' ? navigateToFolder(item) : handleFileClick(item)}
                                                    onMouseEnter={(e) => {
                                                        e.target.style.backgroundColor = '#3a3a3a';
                                                        e.target.style.borderColor = secondaryColor;
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.target.style.backgroundColor = '#2a2a2a';
                                                        e.target.style.borderColor = '#333';
                                                    }}
                                                >
                                                    <div style={{ fontSize: '1.2rem', marginRight: '0.75rem' }}>
                                                        {item.type === 'folder' ? '📁' : '🎵'}
                                                    </div>
                                                    
                                                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                                        <Text style={{ margin: 0, fontWeight: 'bold', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {item.name}
                                                        </Text>
                                                        {item.type === 'file' && (
                                                            <Text style={{ margin: 0, fontSize: '0.7rem', opacity: 0.7 }}>
                                                                {formatFileSize(item.size)}
                                                            </Text>
                                                        )}
                                                    </div>
                                                    
                                                    {item.type === 'folder' ? (
                                                        <div style={{ fontSize: '1rem', opacity: 0.6 }}>
                                                            →
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                            {!isFileInPlaylist(item.file) ? (
                                                                <Button
                                                                    variant="outline-light"
                                                                    size="sm"
                                                                    onClick={(e) => handleAddToPlaylist(item, e)}
                                                                    style={{
                                                                        borderColor: secondaryColor,
                                                                        padding: '0.1rem 0.3rem',
                                                                        fontSize: '0.7rem',
                                                                        minWidth: '24px',
                                                                        height: '24px'
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
                                                                        fontWeight: 'bold'
                                                                    }}
                                                                    title="Already in Playlist"
                                                                >
                                                                    ✓
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            
            </div>
        </div>
    );
};

export default MusicLibraryPanel;
