import React, { useState } from 'react';
import { secondaryColor } from './DisplaySettings';
import soundSettingsIcon from '../images/soundsettingsicon.png';

const AudioDeviceButton = ({
    onClick,
    className = '',
    style = {},
    size = '2rem',
    showTooltip = true,
    tooltipText = 'Audio Device Settings'
}) => {
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseEnter = () => {
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    const buttonStyle = {
        width: size,
        height: size,
        cursor: 'pointer',
        opacity: isHovered ? 0.8 : 1,
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
            onClick={onClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            title={showTooltip ? tooltipText : undefined}
        >
            <img
                src={soundSettingsIcon}
                alt="Audio Device Settings"
                style={iconStyle}
                draggable={false}
            />
        </div>
    );
};

export default AudioDeviceButton;
