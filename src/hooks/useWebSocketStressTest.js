/**
 * React hook for WebSocket stress testing
 * 
 * Integrates with FacialLandmarkUserUI to duplicate frames
 */

import { useRef, useEffect } from 'react';
import WebSocketStressTest from './WebSocketStressTest';
import { getSessionNameFromUrl } from './sessionUtils';

export const useWebSocketStressTest = (enabled = false, userCount = 10) => {
    const stressTestRef = useRef(null);
    const sessionNameRef = useRef(null);

    useEffect(() => {
        if (!enabled) {
            // Cleanup if disabled
            if (stressTestRef.current) {
                stressTestRef.current.stop();
                stressTestRef.current = null;
            }
            return;
        }

        // Get session name
        const session = getSessionNameFromUrl();
        sessionNameRef.current = session;

        if (!session) {
            return;
        }

        // Initialize stress test
        const stressTest = new WebSocketStressTest(session, {
            onStatsUpdate: () => {
                // Stats updated (can be used for UI updates if needed)
            }
        });

        stressTestRef.current = stressTest;

        // Start stress test
        stressTest.start(userCount, 'stress_user').then((result) => {
            if (result.success < userCount) {
                console.warn(
                    `Stress test started with ${result.success}/${userCount} users connected`
                );
            }
        });

        // Cleanup on unmount or when disabled
        return () => {
            if (stressTestRef.current) {
                stressTestRef.current.stop();
                stressTestRef.current = null;
            }
        };
    }, [enabled, userCount]);

    /**
     * Duplicate a frame to all simulated users
     */
    const duplicateFrame = (frameData, dataType = 'landmark') => {
        if (stressTestRef.current && stressTestRef.current.isActive()) {
            stressTestRef.current.duplicateFrame(frameData, dataType);
        }
    };

    /**
     * Get current statistics
     */
    const getStats = () => {
        return stressTestRef.current ? stressTestRef.current.getStats() : null;
    };

    /**
     * Check if stress test is active
     */
    const isActive = () => {
        return stressTestRef.current ? stressTestRef.current.isActive() : false;
    };

    return {
        duplicateFrame,
        getStats,
        isActive,
        stressTest: stressTestRef.current
    };
};

export default useWebSocketStressTest;

