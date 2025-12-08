import React, { useState, useEffect } from 'react';
import logo from '../images/logo.png';
import { useAuth } from '../contexts/AuthContext';
import { useTutorial } from '../contexts/TutorialContext';
import { useNavigate, Link } from 'react-router-dom';
import { Container, Row, Col, Button, Image } from 'react-bootstrap';
import TutorialMessage from '../components/TutorialMessage';
import LargeTutorialButton from '../utils/LargeTutorialButton';
import TypewriterText from '../utils/TypewriterText';
import SignUpButton from '../utils/SignUpButton';
import LoginButton from '../utils/LoginButton';
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

    // Track page view on component mount
    useEffect(() => {
        trackPageView({
            pageName: 'home',
            additionalData: {
                has_auth_code: !!code,
                is_authenticated: !!idToken,
                is_tutorial_mode: isTutorialMode
            }
        });
    }, []); // Only track once on mount

    return (
        <Container fluid className="mt-5 ps-md-5" style={{ marginTop: '8rem' }}>
            {isTutorialMode && !homeTutorialDismissed && (
                <TutorialMessage 
                    messages={[
                        "Welcome to TuneTribes player! This is your home page where you can sign up, login, and access all features.",
                        "Experience music with movement-responsive audio enhancement in the player.",
                        "You can customize audio mappings to create your own personal audio experience."
                    ]}
                    position="top-center"
                    onClose={() => setHomeTutorialDismissed(true)}
                />
            )}
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

            {!code && (
                <Row className="justify-content-center" style={{ marginTop: '6rem' }}>
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
                                <p>  Welcome ! Sign up or login to use all functionalities. </p>
                                <div className="d-flex justify-content-center gap-2 mb-3">
                                    <SignUpButton />
                                    <LoginButton />
                                </div>
                                <LargeTutorialButton 
                                    onTutorialToggle={() => {
                                        setHomeTutorialDismissed(false);
                                        if (!isTutorialMode) {
                                            toggleTutorialMode();
                                        }
                                    }}
                                    disabled={isTutorialMode && !homeTutorialDismissed}
                                />
                            </>
                        )}
                    </Col>
                </Row>
            )}
            
            

            
        </Container>
    );
}

export default Home;