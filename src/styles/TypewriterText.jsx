import React, { useState, useEffect } from 'react';
import { secondaryColor } from '../utils/DisplaySettings';

const TypewriterText = ({ 
    text, 
    speed = 20, 
    delay = 0,
    style = {},
    className = ""
}) => {
    const [displayText, setDisplayText] = useState('');
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        const content = typeof text === 'string' ? text : '';
        if (!content.length) {
            setDisplayText('');
            setIsComplete(true);
            return;
        }

        setDisplayText('');
        setIsComplete(false);

        const safeSpeed = Math.max(1, Number(speed) || 1);
        const safeDelay = Math.max(0, Number(delay) || 0);
        let animationFrameId = null;
        let startTimeMs = null;

        const tick = (timestampMs) => {
            if (startTimeMs === null) {
                startTimeMs = timestampMs;
            }
            const elapsedMs = timestampMs - startTimeMs;
            if (elapsedMs < safeDelay) {
                animationFrameId = window.requestAnimationFrame(tick);
                return;
            }

            const typingElapsedMs = elapsedMs - safeDelay;
            const nextCharCount = Math.min(
                content.length,
                Math.floor(typingElapsedMs / safeSpeed)
            );
            setDisplayText(content.slice(0, nextCharCount));

            if (nextCharCount >= content.length) {
                setIsComplete(true);
                return;
            }
            animationFrameId = window.requestAnimationFrame(tick);
        };

        animationFrameId = window.requestAnimationFrame(tick);
        return () => {
            if (animationFrameId !== null) {
                window.cancelAnimationFrame(animationFrameId);
            }
        };
    }, [text, speed, delay]);

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
