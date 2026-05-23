import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import logo from '../images/logo.png';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Container, Row, Col, Button, Image, Alert, Spinner } from 'react-bootstrap';
import TypewriterText from '../styles/TypewriterText';
import { secondaryColor } from '../utils/DisplaySettings';
import { trackPageView } from '../hooks/pageViewTracker';
import { usePlayerAuthStatus } from '../hooks/usePlayerAuthStatus';
import { PLAYER_DESTINATIONS } from '../utils/playerAuthConfig';

const Home = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const { handleLogout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const folderInputRef = useRef(null);
    const pendingLocalPathRef = useRef(null);

    const tunetribesAuth = usePlayerAuthStatus('tunetribes');
    const spotifyAuth = usePlayerAuthStatus('spotify');
    const soundcloudAuth = usePlayerAuthStatus('soundcloud');

    const authStatusByType = useMemo(
        () => ({
            tunetribes: tunetribesAuth,
            spotify: spotifyAuth,
            soundcloud: soundcloudAuth,
        }),
        [tunetribesAuth, spotifyAuth, soundcloudAuth],
    );

    const onLogout = () => {
        handleLogout();
        navigate('/');
    };

    useEffect(() => {
        trackPageView({
            pageName: 'home',
            additionalData: {
                has_auth_code: !!code,
                is_authenticated_tunetribes: tunetribesAuth.isAuthenticated,
            },
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const isDestinationAuthed = useCallback(
        (destination) => {
            const status = authStatusByType[destination.auth];
            return Boolean(status?.isAuthenticated);
        },
        [authStatusByType],
    );

    const handlePlayerClick = useCallback(
        (destination) => {
            setError('');
            if (!isDestinationAuthed(destination)) {
                authStatusByType[destination.auth]?.initiateLogin();
                return;
            }

            if (destination.id === 'local') {
                pendingLocalPathRef.current = destination.path;
                folderInputRef.current?.click();
                return;
            }

            navigate(destination.path);
        },
        [authStatusByType, isDestinationAuthed, navigate],
    );

    const handleFolderSelect = useCallback(
        async (event) => {
            const files = Array.from(event.target.files);
            if (files.length === 0) return;

            const targetPath = pendingLocalPathRef.current || '/localplayer';
            pendingLocalPathRef.current = null;

            if (!isDestinationAuthed(PLAYER_DESTINATIONS[0])) {
                tunetribesAuth.initiateLogin();
                return;
            }

            setLoading(true);
            setError('');

            try {
                const audioFiles = files.filter((file) => {
                    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
                    return ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma', '.aiff', '.au'].includes(
                        extension,
                    );
                });

                window.selectedMusicFiles = audioFiles;
                navigate(targetPath);
            } catch (err) {
                setError('Error loading folder');
                console.error('Folder loading error:', err);
            } finally {
                setLoading(false);
            }
        },
        [isDestinationAuthed, navigate, tunetribesAuth],
    );

    return (
        <Container fluid className="mt-5 ps-md-5" style={{ marginTop: '8rem' }}>
            <Row className="justify-content-center">
                <Col xs={12} className="text-center">
                    <Image
                        src={logo}
                        alt="TuneTribes Logo"
                        fluid
                        style={{ maxWidth: '300px', marginBottom: '2rem' }}
                    />
                    <TypewriterText text="Music that moves with you." speed={100} delay={500} />
                </Col>
            </Row>

            {!code && (
                <Row className="justify-content-center" style={{ marginTop: '3rem' }}>
                    <Col xs={12} sm={10} md={8} lg={6}>
                        {location.state?.error && (
                            <Alert variant="danger" className="mb-3 text-center">
                                {location.state.error}
                            </Alert>
                        )}

                        {tunetribesAuth.isLoading ? (
                            <div className="d-flex justify-content-center py-4">
                                <Spinner animation="border" />
                            </div>
                        ) : !tunetribesAuth.isAuthenticated ? (
                            <div className="d-flex flex-column align-items-center gap-3 text-center">
                                <Button
                                    variant="outline-light"
                                    size="lg"
                                    onClick={tunetribesAuth.initiateLogin}
                                    style={{ minWidth: '250px', padding: '1rem 2rem', borderColor: secondaryColor }}
                                >
                                    Log in
                                </Button>
                            </div>
                        ) : (
                            <>
                                <input
                                    type="file"
                                    ref={folderInputRef}
                                    onChange={handleFolderSelect}
                                    webkitdirectory=""
                                    directory=""
                                    style={{ display: 'none' }}
                                />

                                <div className="d-flex flex-column align-items-center gap-3 mb-3">
                                    {PLAYER_DESTINATIONS.map((destination) => {
                                        const style = destination.style || {
                                            borderColor: secondaryColor,
                                        };
                                        const authed = isDestinationAuthed(destination);
                                        const loginHint = authed ? '' : ' (click to login first)';
                                        const buttonLabel = `${destination.label}${loginHint}`;
                                        return (
                                            <Button
                                                key={destination.id}
                                                variant="outline-light"
                                                size="lg"
                                                onClick={() => handlePlayerClick(destination)}
                                                style={{
                                                    minWidth: '250px',
                                                    padding: '1rem 2rem',
                                                    ...style,
                                                    opacity: authed ? 1 : 0.92,
                                                }}
                                            >
                                                {destination.id === 'local' && loading ? (
                                                    <>
                                                        <Spinner
                                                            animation="border"
                                                            size="sm"
                                                            className="me-2"
                                                        />
                                                        Loading...
                                                    </>
                                                ) : (
                                                    buttonLabel
                                                )}
                                            </Button>
                                        );
                                    })}
                                </div>

                                {error && (
                                    <Alert variant="danger" className="mb-3">
                                        {error}
                                    </Alert>
                                )}

                                <div className="d-flex justify-content-center gap-2 mt-4">
                                    <Button
                                        variant="outline-light"
                                        onClick={onLogout}
                                        style={{ fontSize: '0.9rem' }}
                                    >
                                        Log out of TuneTribes
                                    </Button>
                                </div>
                            </>
                        )}
                    </Col>
                </Row>
            )}
        </Container>
    );
};

export default Home;
