import React, { useEffect, useState, useRef } from 'react';

/**
 * OrientedCamera Component
 * 
 * A reusable camera component that handles orientation changes properly.
 * Crops and fits the landscape camera stream to display correctly in both
 * portrait and landscape orientations.
 * 
 * Props:
 * - stream: MediaStream from getUserMedia
 * - className: Additional CSS classes for the container
 * - style: Additional inline styles for the container
 * - showOrientationDebug: Show orientation text for debugging (default: false)
 * - onVideoRef: Callback function to get the video element reference
 * - children: Optional canvas overlay or other elements to render on top
 */
const OrientedCamera = ({ 
    stream, 
    className = '', 
    style = {}, 
    showOrientationDebug = false,
    onVideoRef,
    children,
    objectPosition = 'center' // Add objectPosition prop
}) => {
    const videoRef = useRef(null);
    const [orientation, setOrientation] = useState(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');

    // Orientation change effect
    useEffect(() => {
        const handleOrientationChange = () => {
            const newOrientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
            console.log(`🔄 ORIENTATION CHANGE: ${window.innerWidth}x${window.innerHeight} -> ${newOrientation}`);
            setOrientation(newOrientation);
        };

        // Listen for orientation changes
        window.addEventListener('resize', handleOrientationChange);
        window.addEventListener('orientationchange', handleOrientationChange);

        return () => {
            window.removeEventListener('resize', handleOrientationChange);
            window.removeEventListener('orientationchange', handleOrientationChange);
        };
    }, []);

    // Handle stream assignment to video element when stream changes
    useEffect(() => {
        if (stream && videoRef.current && videoRef.current.srcObject !== stream) {
            console.log('Setting stream to video element in OrientedCamera');
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    // Expose video reference to parent component
    useEffect(() => {
        if (onVideoRef && videoRef.current) {
            onVideoRef(videoRef.current);
        }
    }, [onVideoRef, videoRef.current]);

    return (
        <>
            <style>
                {`
                    .oriented-camera-portrait:not(.custom-size) {
                        width: 60px !important;
                        height: 80px !important;
                        aspectRatio: 3/4 !important;
                    }
                    .oriented-camera-landscape:not(.custom-size) {
                        width: 80px !important;
                        height: 60px !important;
                        aspectRatio: 4/3 !important;
                    }
                    .oriented-camera-video {
                        transform: rotateY(180deg) !important;
                        -webkit-transform: rotateY(180deg) !important;
                        object-fit: cover !important;
                        object-position: ${objectPosition} !important;
                    }
                `}
            </style>
            <div 
                className={`oriented-camera-${orientation} ${(style.width || style.height) ? 'custom-size' : ''} d-flex align-items-center justify-content-center ${className}`}
                style={{ 
                    flexShrink: 0,
                    transition: 'all 0.3s ease',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    position: 'relative',
                    ...style
                }}
            >
                {stream ? (
                    <>
                        <video
                            autoPlay
                            playsInline
                            muted
                            ref={video => {
                                if (video) {
                                    videoRef.current = video;
                                    if (!video.srcObject && stream) {
                                        video.srcObject = stream;
                                    }
                                }
                            }}
                            type="video/webm,video/mp4,video/ogg"
                            style={{ 
                                width: '100%',
                                height: '100%',
                                borderRadius: '8px'
                            }}
                            className="oriented-camera-video"
                        />
                        {children}
                        {showOrientationDebug && (
                            <span style={{ 
                                position: 'absolute', 
                                top: '2px', 
                                right: '2px', 
                                fontSize: '0.4rem', 
                                color: '#888',
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                padding: '1px 2px',
                                borderRadius: '2px'
                            }}>
                                {orientation}
                            </span>
                        )}
                    </>
                ) : (
                    <div style={{ 
                        width: '100%', 
                        height: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        backgroundColor: '#1a1a1a',
                        borderRadius: '8px'
                    }}>
                        Loading camera...
                    </div>
                )}
            </div>
        </>
    );
};

export default OrientedCamera;
