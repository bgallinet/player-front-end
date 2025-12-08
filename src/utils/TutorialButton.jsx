import React, { useState } from 'react';
import { useTutorial } from '../contexts/TutorialContext';
import { secondaryColor } from './DisplaySettings';
import tutorialIcon from '../images/tutorialicon.png';

/**
 * TutorialButton Component
 * 
 * A reusable button component for showing/hiding tutorials across the application.
 * Handles tutorial mode state and dismissal state automatically with hover effects.
 * 
 * Props:
 * - tutorialDismissed: boolean - Whether the tutorial has been dismissed
 * - setTutorialDismissed: function - Function to set the dismissed state
 * - size: string - Button size (default: '2rem')
 * - style: object - Additional styles
 * - className: string - Additional CSS classes
 * - disabled: boolean - Whether the button should be disabled
 * - showTooltip: boolean - Whether to show tooltip (default: true)
 * - tooltipText: string - Tooltip text (default: 'Tutorial')
 * 
 * Usage:
 * <TutorialButton 
 *   tutorialDismissed={playerTutorialDismissed}
 *   setTutorialDismissed={setPlayerTutorialDismissed}
 *   size="3rem"
 *   showTooltip={true}
 *   tooltipText="Tutorial"
 * />
 */

const TutorialButton = ({ 
    tutorialDismissed, 
    setTutorialDismissed, 
    size = '2rem',
    style = {},
    className = '',
    disabled = false,
    showTooltip = true,
    tooltipText = 'Tutorial'
}) => {
    const { isTutorialMode, toggleTutorialMode } = useTutorial();
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseEnter = () => {
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    const handleClick = () => {
        if (disabled || (isTutorialMode && !tutorialDismissed)) return;
        
        setTutorialDismissed(false);
        if (!isTutorialMode) {
            toggleTutorialMode();
        }
    };

    const buttonStyle = {
        width: size,
        height: size,
        cursor: disabled || (isTutorialMode && !tutorialDismissed) ? 'not-allowed' : 'pointer',
        opacity: isHovered ? 0.8 : (disabled || (isTutorialMode && !tutorialDismissed) ? 0.5 : 1),
        userSelect: 'none',
        padding: '0.5rem',
        borderRadius: '0.25rem',
        transition: 'all 0.2s ease',
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isHovered ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        ...style
    };

    const iconStyle = {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        filter: isHovered ? `brightness(1.2) drop-shadow(0 0 4px ${secondaryColor})` : 'none'
    };

    return (
        <div
            className={className}
            style={buttonStyle}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            title={showTooltip ? tooltipText : undefined}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick();
                }
            }}
        >
            <img
                src={tutorialIcon}
                alt="Tutorial"
                style={iconStyle}
                draggable={false}
            />
        </div>
    );
};

export default TutorialButton;
