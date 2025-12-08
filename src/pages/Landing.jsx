import React, { useState, useEffect } from 'react';
import login from '../images/login_notitle.png';
import EnvironmentVariables from '../utils/EnvironmentVariables';
import { useAuth } from '../contexts/AuthContext';
import { useTutorial } from '../contexts/TutorialContext';
import { useNavigate, Link } from 'react-router-dom';
import { Container, Row, Col, Button, Image } from 'react-bootstrap';
import TutorialMessage from '../components/TutorialMessage';
import { trackPageView } from '../hooks/pageViewTracker';
import { useExperiment } from '../hooks/useExperiment';
import { trackSimpleEvent } from '../hooks/simpleTracker';

const Landing = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const { idToken, handleLogout } = useAuth();
    const { isTutorialMode, toggleTutorialMode } = useTutorial();
    const navigate = useNavigate();
    const [selectedMusicStyle, setSelectedMusicStyle] = useState(null);


    // Experiment tracking (optional)
    const { trackEvent, experiment, isLoading } = useExperiment('landing_style_selection', null, 'landing');
    
    // Debug experiment state
    useEffect(() => {
        console.log('🧪 Landing page experiment state:', { experiment, isLoading });
    }, [experiment, isLoading]);

    const onLogout = () => {
        handleLogout();
        navigate('/');
    };

    const [homeTutorialDismissed, setHomeTutorialDismissed] = useState(false);

    // Track page view on component mount
    useEffect(() => {
        trackPageView({
            pageName: 'landing',
            additionalData: {
                has_auth_code: !!code,
                is_authenticated: !!idToken,
                is_tutorial_mode: isTutorialMode,
                selected_music_style: selectedMusicStyle
            }
        });
    }, []); // Only track once on mount

    const musicStyles = [
        { id: 'electro', name: 'Electro', session: 'demo-session-electro' },
        { id: 'pop', name: 'Pop', session: 'demo-session-pop' },
        { id: 'rock', name: 'Rock', session: 'demo-session-rock' },
        { id: 'latino', name: 'Latino', session: 'demo-session-latino' }
    ];

    const handleMusicStyleSelect = async (style) => {
        console.log('🎵 Music style selected:', style);
        setSelectedMusicStyle(style);
        
        // Track with simple tracking (no experiment required)
        await trackSimpleEvent({
            'interaction_type': 'music_style_selected',
            'element_id': `music_style_${style.id}`,
            'page_url': window.location.href,
            'music_style': style.id,
            'music_style_name': style.name,
            'session_name': style.session
        });
        
    };

    const handleNextClick = () => {
        if (selectedMusicStyle) {
            navigate(`/session/${selectedMusicStyle.session}`);
        }
    };

    return (
        <Container fluid className="mt-5 ps-md-5">

            <Row className="justify-content-center">
                <Col xs={12} className="text-center">
                    <Image 
                        src={login} 
                        alt="Login"
                        fluid
                    />
                </Col>
            </Row>

            {!code && (
                <Row className="justify-content-center mt-3">
                    <Col xs={12} sm={8} md={6} lg={4} className="text-center">
                        {idToken ? (
                            <Button 
                                variant="outline-light"
                                onClick={onLogout}
                            >
                                Logout
                            </Button>
                        ) : (
                            <>
                                <p>Welcome ! We will get you started right away with a demo session. What is your favorite style of music?</p>
                                
                                <div className="mb-4">
                                    {musicStyles.map((style) => (
                                        <Button
                                            key={style.id}
                                            variant={selectedMusicStyle?.id === style.id ? "primary" : "outline-light"}
                                            className="d-block w-100 mb-2"
                                            onClick={() => handleMusicStyleSelect(style)}
                                        >
                                            {style.name}
                                        </Button>
                                    ))}
                                </div>

{/*                                 <p className="mb-3">
                                    You agree to our <Link to="/privacy" className="text-white">Privacy Notice</Link> and <Link to="/terms" className="text-white">Terms of Use</Link>
                                </p> */}
                                
                                <Button 
                                    variant="outline-light"
                                    onClick={handleNextClick}
                                    disabled={!selectedMusicStyle}
                                >
                                    Next
                                </Button>
                            </>
                        )}
                    </Col>
                </Row>
            )}
            
            

            
        </Container>
    );
}

export default Landing;