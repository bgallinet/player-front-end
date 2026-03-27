import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import { useTutorial } from '../contexts/TutorialContext';
import tutorialIcon from '../images/tutorialicon.png';
import TypewriterText from '../utils/TypewriterText';

const TutorialMessage = ({ messages, position = 'top-center', onClose }) => {
    const { isTutorialMode, disableTutorialMode } = useTutorial();
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

    if (!isTutorialMode) return null;

    // Handle single string input for backward compatibility
    const messageArray = Array.isArray(messages) ? messages : [messages];
    const isLastMessage = currentMessageIndex === messageArray.length - 1;
    const currentMessage = messageArray[currentMessageIndex];

    const handleNext = () => {
        if (isLastMessage) {
            onClose();
        } else {
            setCurrentMessageIndex(prev => prev + 1);
        }
    };

    const getPositionStyle = () => {
        switch (position) {
            case 'top-left':
                return { top: '1rem', left: '1rem' };
            case 'top-right':
                return { top: '1rem', right: '1rem' };
            case 'bottom-left':
                return { bottom: '1rem', left: '1rem' };
            case 'bottom-right':
                return { bottom: '1rem', right: '1rem' };
            case 'center':
                return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
            case 'top-center':
            default:
                return { top: '1rem', left: '50%', transform: 'translateX(-50%)' };
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                ...getPositionStyle(),
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                color: 'white',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: `2px solid white`,
                boxShadow: `0 0 1rem rgba(255, 255, 255, 0.4)`,
                width: '300px',
                minWidth: '300px',
                zIndex: 2000,
                fontSize: '0.9rem',
                lineHeight: '1.4'
            }}
        >
            <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <img 
                    src={tutorialIcon} 
                    alt="Tutorial" 
                    style={{ 
                        width: '1rem', 
                        height: '1rem'
                    }} 
                />
            </div>
            <div style={{ marginBottom: '1rem', minHeight: '120px' }}>
                <TypewriterText 
                    text={currentMessage}
                    speed={20}
                    delay={100}
                    style={{
                        color: 'white',
                        fontSize: '0.9rem',
                        fontWeight: 'normal',
                        fontFamily: 'inherit',
                        minHeight: '120px',
                        display: 'block',
                        textAlign: 'left',
                        lineHeight: '1.4'
                    }}
                />
            </div>
            {messageArray.length > 1 && (
                <div style={{ 
                    marginBottom: '1rem', 
                    fontSize: '0.8rem', 
                    color: '#ccc',
                    textAlign: 'center' 
                }}>
                    {currentMessageIndex + 1} of {messageArray.length}
                </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <Button
                    size="sm"
                    variant="outline-light"
                    onClick={handleNext}
                    style={{ 
                        fontSize: '0.8rem',
                        color: 'white',
                        borderColor: 'white',
                        backgroundColor: 'transparent'
                    }}
                >
                    {isLastMessage ? 'Got it' : 'Next'}
                </Button>
                <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={disableTutorialMode}
                    style={{ 
                        fontSize: '0.8rem',
                        color: 'white',
                        borderColor: '#dc3545',
                        backgroundColor: 'transparent'
                    }}
                >
                    Disable Tutorial
                </Button>
            </div>
        </div>
    );
};

export default TutorialMessage; 