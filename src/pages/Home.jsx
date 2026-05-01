import React, { useState, useEffect, useRef, useCallback } from 'react';
import logo from '../images/logo.png';
import { useAuth } from '../contexts/AuthContext';
import { useTutorial } from '../contexts/TutorialContext';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Button, Image, Alert, Spinner } from 'react-bootstrap';
import TutorialMessage from '../components/TutorialMessage';
import LargeTutorialButton from '../buttons/LargeTutorialButton';
import TypewriterText from '../styles/TypewriterText';
import SignUpButton from '../buttons/SignUpButton';
import LoginButton from '../buttons/LoginButton';
import { Subtitle, Text, StyledCard } from '../styles/StyledComponents';
import { secondaryColor } from '../utils/DisplaySettings';
import { trackPageView } from '../hooks/pageViewTracker';

const Home = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const { idToken, handleLogout } = useAuth();
    const { isTutorialMode, toggleTutorialMode } = useTutorial();
    const navigate = useNavigate();

    const onLogout = () => {
        handleLogout();
        navigate('/');
    };

    const [homeTutorialDismissed, setHomeTutorialDismissed] = useState(false);

    // Music library state (from WelcomePlayerPage)
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const folderInputRef = useRef(null);

    const isLoggedIn = !!idToken;

    // Track page view on component mount
    useEffect(() => {
        trackPageView({
            pageName: 'home',
            additionalData: {
                has_auth_code: !!code,
                is_authenticated: isLoggedIn,
                is_tutorial_mode: isTutorialMode
            }
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Supported audio file extensions
    const supportedAudioExtensions = [
        '.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma', '.aiff', '.au'
    ];

    // Handle folder selection
    const handleFolderSelect = useCallback(async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        setLoading(true);
        setError('');

        try {
            const audioFiles = files.filter(file => {
                const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
                return ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma', '.aiff', '.au'].includes(extension);
            });

            window.selectedMusicFiles = audioFiles;
            navigate('/localplayer');
        } catch (err) {
            setError('Error loading folder');
            console.error('Folder loading error:', err);
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    return (
        <Container fluid className="mt-5 ps-md-5" style={{ marginTop: '8rem' }}>
            {isTutorialMode && !homeTutorialDismissed && (
                <TutorialMessage
                    messages={[
                        "Welcome to TuneTribes player! This is your home page where you can access all features.",
                        "Experience music with movement-responsive audio enhancement in the player.",
                        "Try Demo Tracks to get started, connect SoundCloud to stream, or login to use your own music files."
                    ]}
                    position="top-center"
                    onClose={() => setHomeTutorialDismissed(true)}
                />
            )}

            {/* Branding */}
            <Row className="justify-content-center">
                <Col xs={12} className="text-center">
                    <Image
                        src={logo}
                        alt="TuneTribes Logo"
                        fluid
                        style={{ maxWidth: '300px', marginBottom: '2rem' }}
                    />
                    <TypewriterText
                        text="Be part of music"
                        speed={100}
                        delay={500}
                    />
                </Col>
            </Row>

            {/* Player Options */}
            {!code && (
                <Row className="justify-content-center" style={{ marginTop: '3rem' }}>
                    <Col xs={12} sm={10} md={8} lg={6}>
                        <div className="text-center mb-4">
                            <Subtitle>
                                Experience music with movement-responsive audio enhancement
                            </Subtitle>
                        </div>

                        {/* Demo Tracks */}
                        <StyledCard className="mb-3">
                            <div className="text-center">
                                <Button
                                    variant="outline-light"
                                    onClick={() => navigate('/demoplayer')}
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

                        {/* SoundCloud */}
                        <StyledCard className="mb-3">
                            <div className="text-center">
                                <Button
                                    variant="outline-light"
                                    onClick={() => navigate('/soundcloudplayer')}
                                    size="lg"
                                    style={{
                                        borderColor: '#ff5500',
                                        color: '#ff5500',
                                        transition: 'all 0.3s ease',
                                        minWidth: '250px',
                                        padding: '1rem 2rem'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.backgroundColor = '#ff5500';
                                        e.target.style.borderColor = '#ff5500';
                                        e.target.style.color = 'white';
                                        e.target.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.backgroundColor = 'transparent';
                                        e.target.style.borderColor = '#ff5500';
                                        e.target.style.color = '#ff5500';
                                        e.target.style.transform = 'translateY(0)';
                                    }}
                                >
                                    SoundCloud
                                </Button>
                            </div>
                            <div className="text-center mt-2">
                                <Text style={{ fontSize: '0.85rem', color: '#ccc', opacity: 0.7 }}>
                                    Stream from your SoundCloud library
                                </Text>
                            </div>
                        </StyledCard>

                        {/* Local Music Folder */}
                        <StyledCard className="mb-3">
                            {isLoggedIn ? (
                                <>
                                    {/* Folder Selection -- logged in */}
                                    <div className="text-center mb-3">
                                        <input
                                            type="file"
                                            ref={folderInputRef}
                                            onChange={handleFolderSelect}
                                            webkitdirectory=""
                                            directory=""
                                            style={{ display: 'none' }}
                                        />
                                        <Button
                                            variant="outline-light"
                                            onClick={() => folderInputRef.current?.click()}
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
                                    <div className="text-center">
                                        <Text style={{ fontSize: '0.85rem', color: '#ccc', opacity: 0.7 }}>
                                            Supported: {supportedAudioExtensions.join(', ')}
                                        </Text>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Login prompt -- not logged in */}
                                    <div className="text-center mb-3">
                                        <Text style={{ margin: 0, fontSize: '0.95rem' }}>
                                            <strong>Local Music Folder</strong>
                                        </Text>
                                        <Text style={{ fontSize: '0.85rem', color: '#ccc', opacity: 0.7 }}>
                                            Login to play music from your device
                                        </Text>
                                    </div>
                                    <div className="d-flex justify-content-center gap-2">
                                        <SignUpButton />
                                        <LoginButton />
                                    </div>
                                </>
                            )}

                            {error && (
                                <Alert variant="danger" className="mt-3 mb-0">
                                    {error}
                                </Alert>
                            )}
                        </StyledCard>

                        {/* Logout + Tutorial row */}
                        <div className="d-flex justify-content-center gap-2 mt-4">
                            <LargeTutorialButton
                                onTutorialToggle={() => {
                                    setHomeTutorialDismissed(false);
                                    if (!isTutorialMode) {
                                        toggleTutorialMode();
                                    }
                                }}
                                disabled={isTutorialMode && !homeTutorialDismissed}
                            />
                            {isLoggedIn && (
                                <Button
                                    variant="outline-light"
                                    onClick={onLogout}
                                    style={{ fontSize: '0.9rem' }}
                                >
                                    Logout
                                </Button>
                            )}
                        </div>
                    </Col>
                </Row>
            )}
        </Container>
    );
}

export default Home;
