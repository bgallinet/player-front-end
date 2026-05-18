import React, { useState, useEffect, useRef, useCallback } from 'react';
import logo from '../images/logo.png';
import { useAuth } from '../contexts/AuthContext';
import { useTutorial } from '../contexts/TutorialContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Container, Row, Col, Button, Image, Alert, Spinner } from 'react-bootstrap';
import TutorialMessage from '../components/TutorialMessage';
import TypewriterText from '../styles/TypewriterText';
import LoginButton from '../buttons/LoginButton';
import { Subtitle, Text } from '../styles/StyledComponents';
import { secondaryColor } from '../utils/DisplaySettings';
import { trackPageView } from '../hooks/pageViewTracker';
const Home = () => {
    const showSoundCloudPlayer = false;
    const showSpotifyPlayer = true;
    const showLocalPlayer = false;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const { idToken, handleLogout } = useAuth();
    const { isTutorialMode } = useTutorial();
    const navigate = useNavigate();
    const location = useLocation();

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
    const authRequired = Boolean(location.state?.authRequired);

    // Track page view on component mount
    useEffect(() => {
        trackPageView({
            pageName: 'home',
            additionalData: {
                has_auth_code: !!code,
                is_authenticated: isLoggedIn
            }
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
                        "Sign up or log in to access local and SoundCloud playback with movement-responsive audio enhancement."
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
                        text="Music that moves with you."
                        speed={100}
                        delay={500}
                    />
                </Col>
            </Row>

            {/* Player Options */}
            {!code && (
                <Row className="justify-content-center" style={{ marginTop: '3rem' }}>
                    <Col xs={12} sm={10} md={8} lg={6}>
                        {authRequired && !isLoggedIn && (
                            <Alert variant="warning" className="mb-3 text-center">
                                Please log in to access player pages.
                            </Alert>
                        )}

                        {!isLoggedIn ? (
                            <div className="text-center mb-4">
                                <LoginButton />
                            </div>
                        ) : (
                            <>
                                <div className="d-flex flex-column align-items-center gap-3 mb-3">
                                    <Button
                                        variant="outline-light"
                                        onClick={() => navigate('/testplayer')}
                                        size="lg"
                                        style={{ minWidth: '250px', padding: '1rem 2rem' }}
                                    >
                                        Start Test
                                    </Button>
                                    {showSoundCloudPlayer && (
                                        <Button
                                            variant="outline-light"
                                            onClick={() => navigate('/soundcloudplayer')}
                                            size="lg"
                                            style={{
                                                borderColor: '#ff5500',
                                                color: '#ff5500',
                                                minWidth: '250px',
                                                padding: '1rem 2rem'
                                            }}
                                        >
                                            SoundCloud
                                        </Button>
                                    )}
                                    {showSpotifyPlayer && (
                                        <Button
                                            variant="outline-light"
                                            onClick={() => navigate('/spotifyplayer')}
                                            size="lg"
                                            style={{
                                                borderColor: '#1DB954',
                                                color: '#1DB954',
                                                minWidth: '250px',
                                                padding: '1rem 2rem'
                                            }}
                                        >
                                            Spotify
                                        </Button>
                                    )}
                                    {showLocalPlayer && (
                                        <>
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
                                                    minWidth: '250px',
                                                    padding: '1rem 2rem'
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
                                        </>
                                    )}
                                </div>
                                {error && (
                                    <Alert variant="danger" className="mb-3">
                                        {error}
                                    </Alert>
                                )}
                            </>
                        )}

                        {/* Logout row */}
                        <div className="d-flex justify-content-center gap-2 mt-4">
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
