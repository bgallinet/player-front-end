import React, { useState } from 'react';
import { secondaryColor } from './DisplaySettings';
import settingsIcon from '../images/settingsicon.png';

/**
 * SettingsButton Component
 * 
 * A reusable button component for showing/hiding settings across the application.
 * Handles settings modal state and provides consistent styling with hover effects.
 * 
 * Props:
 * - showSettings: boolean - Whether the settings modal is currently shown
 * - onToggleSettings: function - Function to toggle the settings modal
 * - size: string - Button size (default: '2rem')
 * - style: object - Additional styles
 * - className: string - Additional CSS classes
 * - disabled: boolean - Whether the button should be disabled
 * - showTooltip: boolean - Whether to show tooltip (default: true)
 * - tooltipText: string - Tooltip text (default: 'Settings')
 * 
 * Usage:
 * <SettingsButton 
 *   showSettings={showEmotionMappingSettings}
 *   onToggleSettings={setShowEmotionMappingSettings}
 *   size="3rem"
 *   showTooltip={true}
 *   tooltipText="Emotion-to-Audio Mappings"
 * />
 */

const SettingsButton = ({ 
    showSettings, 
    onToggleSettings, 
    size = '2rem',
    style = {},
    className = '',
    disabled = false,
    showTooltip = true,
    tooltipText = 'Settings'
}) => {
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseEnter = () => {
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    const handleClick = () => {
        if (disabled) return;
        
        onToggleSettings(!showSettings);
    };

    const buttonStyle = {
        width: size,
        height: size,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: isHovered ? 0.8 : (disabled ? 0.5 : 1),
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
                src={settingsIcon}
                alt="Settings"
                style={iconStyle}
                draggable={false}
            />
        </div>
    );
};

export default SettingsButton;
