import React from 'react';
import { Button } from 'react-bootstrap';
import { useTutorial } from '../contexts/TutorialContext';
import tutorialIcon from '../images/tutorialicon.png';

const LargeTutorialButton = ({ onTutorialToggle, disabled = false, style = {} }) => {
    const { isTutorialMode, toggleTutorialMode } = useTutorial();

    const handleClick = () => {
        if (onTutorialToggle) {
            onTutorialToggle();
        } else {
            toggleTutorialMode();
        }
    };

    return (
        <Button 
            variant={isTutorialMode ? "outline-warning" : "outline-light"}
            onClick={handleClick}
            disabled={disabled}
            style={{ 
                marginLeft: '0.5rem',
                ...style 
            }}
        >
            <img 
                src={tutorialIcon} 
                alt="Tutorial" 
                style={{ 
                    width: '1rem', 
                    height: '1rem',
                    marginRight: '0.5rem'
                }} 
            />
            Tutorial
        </Button>
    );
};

export default LargeTutorialButton;
