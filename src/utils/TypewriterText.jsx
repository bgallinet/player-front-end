import React, { useState, useEffect } from 'react';
import { secondaryColor } from './DisplaySettings';

const TypewriterText = ({ 
    text, 
    speed = 100, 
    delay = 1000,
    style = {},
    className = ""
}) => {
    const [displayText, setDisplayText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        if (currentIndex < text.length) {
            const timer = setTimeout(() => {
                setDisplayText(prev => prev + text[currentIndex]);
                setCurrentIndex(prev => prev + 1);
            }, speed);
            return () => clearTimeout(timer);
        } else {
            setIsComplete(true);
        }
    }, [currentIndex, text, speed]);

    // Reset animation when text changes
    useEffect(() => {
        setDisplayText('');
        setCurrentIndex(0);
        setIsComplete(false);
    }, [text]);

    return (
        <div 
            className={className}
            style={{
                color: secondaryColor,
                fontSize: '1.5rem',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                minHeight: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...style
            }}
        >
            {displayText}
            {!isComplete && (
                <span 
                    style={{
                        animation: 'blink 1s infinite',
                        marginLeft: '2px'
                    }}
                >
                    |
                </span>
            )}
            <style>
                {`
                    @keyframes blink {
                        0%, 50% { opacity: 1; }
                        51%, 100% { opacity: 0; }
                    }
                `}
            </style>
        </div>
    );
};

export default TypewriterText;
