import React, { useState } from 'react';
import { secondaryColor } from './DisplaySettings';
import backIcon from '../images/backicon.png';

const PreviousButton = ({
    onClick,
    className = '',
    style = {},
    size = '2rem',
    showTooltip = true,
    tooltipText = 'Previous',
    isEnabled = true
}) => {
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseEnter = () => {
        if (isEnabled) {
            setIsHovered(true);
        }
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    const buttonStyle = {
        width: size,
        height: size,
        cursor: isEnabled ? 'pointer' : 'not-allowed',
        opacity: isEnabled ? (isHovered ? 0.8 : 1) : 0.3,
        userSelect: 'none',
        padding: '0.5rem',
        borderRadius: '0.25rem',
        transition: 'all 0.2s ease',
        transform: isEnabled && isHovered ? 'scale(1.1)' : 'scale(1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isEnabled && isHovered ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        ...style
    };

    const iconStyle = {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        filter: isEnabled && isHovered ? `brightness(1.2) drop-shadow(0 0 4px ${secondaryColor})` : 'none'
    };

    return (
        <div
            className={className}
            style={buttonStyle}
            onClick={isEnabled ? onClick : null}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            title={showTooltip ? tooltipText : undefined}
        >
            <img
                src={backIcon}
                alt="Previous"
                style={iconStyle}
                draggable={false}
            />
        </div>
    );
};

export default PreviousButton;
