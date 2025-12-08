/**
 * WebSocket Stress Test Panel
 * 
 * UI component for controlling WebSocket stress testing.
 * Duplicates current user's stream to 1-50 simulated users.
 */

import React, { useState, useEffect, useRef } from 'react';
import WebSocketStressTest from '../../hooks/WebSocketStressTest';
import { getSessionNameFromUrl } from '../../hooks/sessionUtils';

const WebSocketStressTestPanel = ({ 
    enabled = false // Whether stress test panel is visible
}) => {
    const [isRunning, setIsRunning] = useState(false);
    const [userCount, setUserCount] = useState(1);
    const [stats, setStats] = useState(null);
    const [sessionName, setSessionName] = useState(null);
    const stressTestRef = useRef(null);

    useEffect(() => {
        // Get session name from URL
        const session = getSessionNameFromUrl();
        setSessionName(session);

        // Cleanup on unmount
        return () => {
            if (stressTestRef.current) {
                stressTestRef.current.stop();
            }
            // Remove global callback
            if (window.__stressTestDuplicateFrame) {
                delete window.__stressTestDuplicateFrame;
            }
        };
    }, []);

    /**
     * Start stress test
     */
    const handleStart = async () => {
        if (!sessionName) {
            alert('No session name found. Please navigate to a session page.');
            return;
        }

        try {
            const stressTest = new WebSocketStressTest(sessionName, {
                onStatsUpdate: (newStats) => {
                    setStats(newStats);
                }
            });

            stressTestRef.current = stressTest;

            // Set up global callback for frame duplication
            window.__stressTestDuplicateFrame = (frameData, dataType) => {
                if (stressTest.isActive()) {
                    stressTest.duplicateFrame(frameData, dataType);
                }
            };

            const result = await stressTest.start(userCount, 'stress_user');
            setIsRunning(true);

            if (result.success < userCount) {
                alert(
                    `Started stress test with ${result.success}/${userCount} users connected. ` +
                    `Failed: ${result.failed}`
                );
            }
        } catch (error) {
            alert(`Failed to start stress test: ${error.message}`);
        }
    };

    /**
     * Stop stress test
     */
    const handleStop = () => {
        if (stressTestRef.current) {
            stressTestRef.current.stop();
            stressTestRef.current = null;
        }
        setIsRunning(false);
        setStats(null);
        
        // Remove global callback
        if (window.__stressTestDuplicateFrame) {
            delete window.__stressTestDuplicateFrame;
        }
    };

    if (!enabled) {
        return null;
    }

    return (
        <div style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            background: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            zIndex: 10000,
            minWidth: '300px',
            fontFamily: 'monospace',
            fontSize: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
        }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', borderBottom: '1px solid #555', paddingBottom: '5px' }}>
                WebSocket Stress Test
            </h3>

            {!isRunning ? (
                <div>
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>
                            Simulated Users: {userCount}
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="50"
                            value={userCount}
                            onChange={(e) => setUserCount(parseInt(e.target.value))}
                            style={{ width: '100%' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#aaa' }}>
                            <span>1</span>
                            <span>50</span>
                        </div>
                    </div>

                    <button
                        onClick={handleStart}
                        style={{
                            width: '100%',
                            padding: '8px',
                            background: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        Start Stress Test
                    </button>
                </div>
            ) : (
                <div>
                    <div style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span>Status:</span>
                            <span style={{ color: '#4CAF50' }}>● Running</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span>Connected:</span>
                            <span>{stats?.connectedUsers || 0}/{stats?.totalUsers || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span>Frames Sent:</span>
                            <span>{stats?.totalFramesSent || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span>Errors:</span>
                            <span style={{ color: stats?.totalErrors > 0 ? '#f44336' : '#4CAF50' }}>
                                {stats?.totalErrors || 0}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleStop}
                        style={{
                            width: '100%',
                            padding: '8px',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        Stop Stress Test
                    </button>
                </div>
            )}

            <div style={{ marginTop: '10px', fontSize: '10px', color: '#aaa', borderTop: '1px solid #555', paddingTop: '5px' }}>
                Session: {sessionName || 'N/A'}
            </div>
        </div>
    );
};

export default WebSocketStressTestPanel;

