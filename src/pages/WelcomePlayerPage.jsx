import React, { useState, useRef, useCallback } from 'react';
import { Container, Row, Col, Button, Alert, Spinner, Card } from 'react-bootstrap';
import { Title, Subtitle, Text, StyledCard } from '../utils/StyledComponents';
import { secondaryColor } from '../utils/DisplaySettings';
import { useNavigate } from 'react-router-dom';
import { trackPageView } from '../hooks/pageViewTracker';

const WelcomePlayerPage = () => {
    const navigate = useNavigate();
    
    // Music library state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const folderInputRef = useRef(null);
    const hasTrackedPageView = useRef(false);

    // Check if user is logged in
    const isLoggedIn = !!localStorage.getItem('idToken');

    // Track page view on component mount
    React.useEffect(() => {
        if (!hasTrackedPageView.current) {
            hasTrackedPageView.current = true;
            trackPageView({
                pageName: 'welcome',
                additionalData: {
                    is_welcome_page: true
                }
            });
        }
    }, []);

    const handleDemoTrackClick = () => {
        navigate('/demoplayer');
    };

    // Supported audio file extensions
    const supportedAudioExtensions = [
        '.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma', '.aiff', '.au'
    ];

    // Check if file is a supported audio format
    const isAudioFile = useCallback((fileName) => {
        const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
        return supportedAudioExtensions.includes(extension);
    }, []);

    // Handle folder selection
    const handleFolderSelect = useCallback(async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        setLoading(true);
        setError('');
        
        try {
            // Store the selected files in localStorage for LocalPlayerPage to access
            const audioFiles = files.filter(file => {
                const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
                return ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma', '.aiff', '.au'].includes(extension);
            });
            
            // Store files data for LocalPlayerPage - store actual File objects
            window.selectedMusicFiles = audioFiles;
            
            // Navigate directly to the player with folder context
            navigate('/localplayer');
        } catch (err) {
            setError('Error loading folder');
            console.error('Folder loading error:', err);
        } finally {
            setLoading(false);
        }
    }, [navigate]);


    return (
        <Container fluid className="mt-4 px-3">
            <div className="bg-dark rounded p-4" style={{ backgroundColor: '#1a1a1a' }}>

                <div className="text-center">
                    <Subtitle className="mb-4">
                        Experience music with movement-responsive audio enhancement
                    </Subtitle>
                </div>

                {/* Demo Tracks Card */}
                <div className="row justify-content-center mb-4">
                    <div className="col-md-8">
                        <StyledCard>
                            <div className="text-center">
                                <Button
                                    variant="outline-light"
                                    onClick={handleDemoTrackClick}
                                    size="lg"
                                    style={{
                                        borderColor: secondaryColor,
                                        transition: 'all 0.3s ease',
                                        minWidth: '250px',
                                        padding: '1rem 2rem'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.backgroundColor = secondaryColor;
                                        e.target.style.borderColor = secondaryColor;
                                        e.target.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.backgroundColor = 'transparent';
                                        e.target.style.borderColor = secondaryColor;
                                        e.target.style.transform = 'translateY(0)';
                                    }}
                                >
                                    Demo Tracks
                                </Button>
                            </div>
                        </StyledCard>
                    </div>
                </div>

                {/* Music Library Card */}
                <div className="row justify-content-center">
                    <div className="col-md-8">
                        <StyledCard>
                            
                            {/* Login requirement message */}
                            {!isLoggedIn && (
                                <div className="text-center mb-3">
                                    <Alert variant="warning" style={{ color: 'white' }}>
                                        <strong>Login Required:</strong> Please log in to access your music library and create playlists.
                                    </Alert>
                                </div>
                            )}

                            {/* Folder Selection */}
                            <div className="text-center mb-3">
                                <input
                                    type="file"
                                    ref={folderInputRef}
                                    onChange={handleFolderSelect}
                                    webkitdirectory=""
                                    directory=""
                                    style={{ display: 'none' }}
                                    disabled={!isLoggedIn}
                                />
                                
                                <Button
                                    variant="outline-light"
                                    onClick={() => folderInputRef.current?.click()}
                                    disabled={!isLoggedIn}
                                    size="lg"
                                    style={{
                                        borderColor: secondaryColor,
                                        transition: 'all 0.3s ease',
                                        opacity: isLoggedIn ? 1 : 0.5,
                                        minWidth: '250px',
                                        padding: '1rem 2rem'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (isLoggedIn) {
                                            e.target.style.backgroundColor = secondaryColor;
                                            e.target.style.borderColor = secondaryColor;
                                            e.target.style.transform = 'translateY(-2px)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (isLoggedIn) {
                                            e.target.style.backgroundColor = 'transparent';
                                            e.target.style.borderColor = secondaryColor;
                                            e.target.style.transform = 'translateY(0)';
                                        }
                                    }}
                                >
                                    {loading ? (
                                        <>
                                            <Spinner animation="border" size="sm" className="me-2" />
                                            Loading...
                                        </>
                                    ) : (
                                        'Choose Music Folder'
                                    )}
                                </Button>
                            </div>

                            {/* Supported formats info */}
                            <div className="text-center mb-3">
                                <Text style={{ fontSize: '0.9rem', color: '#ccc' }}>
                                    <strong>Supported formats:</strong> {supportedAudioExtensions.join(', ')}
                                </Text>
                            </div>

                            {/* Error display */}
                            {error && (
                                <Alert variant="danger" className="mb-3">
                                    {error}
                                </Alert>
                            )}

                        </StyledCard>
                    </div>
                </div>
            </div>
        </Container>
    );
};

export default WelcomePlayerPage;
