import React, { useState, useRef, useEffect } from 'react';
import { Image, Button } from 'react-bootstrap';
import Player from '../components/player/Player';
import TrackChoice, { getDefaultDemoTrackPayload } from '../components/library_panels/TrackChoice';
import EvaluationForm from '../components/EvaluationForm';
import LargeTutorialButton from '../buttons/LargeTutorialButton';
import SignUpButton from '../buttons/SignUpButton';
import { useAuth } from '../contexts/AuthContext';
import { useTutorial } from '../contexts/TutorialContext';
import magicPlayerImage from '../images/logo_small.png';

/** crossOrigin must be set before src so the first byte request uses CORS (required for Web Audio). */
function loadAudioElementSource(audioEl, url, options = {}) {
    if (!audioEl || !url) return;
    const anonymousCors = options.anonymousCors === true;
    audioEl.pause();
    audioEl.crossOrigin = anonymousCors ? 'anonymous' : null;
    audioEl.src = url;
    audioEl.load();
}

const DemoPlayerPage = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [currentTrackName, setCurrentTrackName] = useState('');
    const [error, setError] = useState('');
    const [showEvaluationForm, setShowEvaluationForm] = useState(false);
    const audioRef = useRef(null);
    const evaluationTimerRef = useRef(null);
    const { idToken } = useAuth();
    const { isTutorialMode, toggleTutorialMode } = useTutorial();
    
    // Duration in seconds before showing the evaluation form after play starts
    const EVALUATION_FORM_DELAY_SECONDS = 20 * 60;

    // Enable tutorial mode when user arrives on the page
    useEffect(() => {
        if (!isTutorialMode) {
            toggleTutorialMode();
        }
    }, []); // Empty dependency array - only run on mount

    // Evaluation form questions and input types
    const evaluationQuestions = [
        "How satisfied are you with the audio quality?",
        "How easy was it to use the facial landmark detection?",
        "How well did the emotion detection work?",
        "How would you rate the overall user experience?",
        "Please provide any additional feedback or suggestions."
    ];

    const evaluationInputTypes = [
        "scale",    // 0-10 scale for satisfaction
        "scale",    // 0-10 scale for ease of use
        "scale",    // 0-10 scale for emotion detection
        "scale",    // 0-10 scale for overall experience
        "comment"   // Text input for feedback
    ];

    // Initialize with default demo track (first entry in TrackChoice DEMO_TRACKS)
    useEffect(() => {
        const initialTrack = getDefaultDemoTrackPayload();
        setSelectedFile(initialTrack);
        setCurrentTrackName(initialTrack.name);
        
        // Load the initial track into audio element with a small delay to ensure it's mounted
        const timer = setTimeout(() => {
            if (audioRef.current) {
                loadAudioElementSource(audioRef.current, initialTrack.url, { anonymousCors: true });
            }
        }, 100);
        
        return () => {
            clearTimeout(timer);
            // Cleanup evaluation timer on unmount
            if (evaluationTimerRef.current) {
                clearTimeout(evaluationTimerRef.current);
            }
        };
    }, []);

    // Handle music play event - show form after delay
    const handleMusicPlay = () => {
        // Clear any existing timer
        if (evaluationTimerRef.current) {
            clearTimeout(evaluationTimerRef.current);
        }
        
        // Set timer to show evaluation form after the specified delay
        evaluationTimerRef.current = setTimeout(() => {
            setShowEvaluationForm(true);
        }, EVALUATION_FORM_DELAY_SECONDS * 1000);
    };

    // Handle music pause/stop - cancel the timer
    const handleMusicPause = () => {
        // Clear the timer if music is paused/stopped before the delay
        if (evaluationTimerRef.current) {
            clearTimeout(evaluationTimerRef.current);
            evaluationTimerRef.current = null;
        }
    };

    // Handle track selection from TrackChoice
    const handleTrackSelect = (file) => {
        setError('');
        
        if (file.isDemo) {
            // Demo track selected
            setSelectedFile(file);
            setCurrentTrackName(file.name);
            
            // Load the demo track into audio element
            if (audioRef.current) {
                loadAudioElementSource(audioRef.current, file.url, { anonymousCors: true });
            }
        } else {
            // Custom file uploaded
            const audioUrl = URL.createObjectURL(file);
            setSelectedFile(file);
            setCurrentTrackName(file.name);
            
            if (audioRef.current) {
                loadAudioElementSource(audioRef.current, audioUrl, { anonymousCors: false });
            }
        }
    };

    // Handle feedback button click - show evaluation form
    const handleFeedbackClick = () => {
        setShowEvaluationForm(true);
    };


    return (
        <Player
            selectedFile={selectedFile}
            isDemoTrack={true}
            pageName="demo-player"
            audioRef={audioRef}
            onMusicPlay={handleMusicPlay}
            onMusicPause={handleMusicPause}
            fallbackDeckArtworkSrc={magicPlayerImage}
        >
            {/* Welcome Image - Only show when no file is selected */}
            {!selectedFile && (
                <div className="text-center mb-4">
                    <Image
                        src={magicPlayerImage}
                        alt="Player logo"
                        fluid
                        style={{ maxWidth: '100%' }}
                    />
                </div>
            )}

            {/* Tutorial, Feedback, and Sign Up Buttons */}
            <div className="text-center mb-4">
                <div className="d-flex justify-content-center gap-2 flex-wrap">
                    <LargeTutorialButton 
                        style={{
                            padding: '0.75rem 1.5rem',
                            fontSize: '1rem',
                            whiteSpace: 'nowrap',
                            minWidth: 'fit-content',
                            textOverflow: 'unset',
                            overflow: 'visible'
                        }}
                    />
                    <Button
                        variant="outline-light"
                        onClick={handleFeedbackClick}
                        className="me-2"
                        style={{
                            padding: '0.75rem 1.5rem',
                            fontSize: '1rem',
                            whiteSpace: 'nowrap',
                            minWidth: 'fit-content'
                        }}
                    >
                        Feedback
                    </Button>
                    <SignUpButton />
                </div>
            </div>

            {/* Track Selection Component */}
            <TrackChoice
                onTrackSelect={handleTrackSelect}
                selectedFile={selectedFile}
                currentTrackName={currentTrackName}
                error={error}
            />

            {/* Evaluation Form - Modal overlay */}
            <EvaluationForm
                questions={evaluationQuestions}
                inputTypes={evaluationInputTypes}
                is_demo_session={true}
                sessionName={null}
                show={showEvaluationForm}
                onHide={() => setShowEvaluationForm(false)}
                disableSubmission={false}
            />
        </Player>
    );
};

export default DemoPlayerPage;
