/**
 * WebSocket Stress Test Utility
 * 
 * Duplicates a single user's landmark/pose data stream to multiple WebSocket connections
 * to simulate 1-50 concurrent users for stress testing.
 * 
 * Usage:
 * 1. Initialize with source frame callback
 * 2. Start stress test with number of users
 * 3. Hook into FacialLandmarkUserUI frame uploads
 */

import LandmarkWebSocket from './LandmarkWebSocket';

class WebSocketStressTest {
    constructor(sessionName, options = {}) {
        this.sessionName = sessionName;
        this.simulatedUsers = new Map(); // username -> { ws, connected, stats }
        this.isRunning = false;
        this.userCount = 0;
        this.stats = {
            totalFramesSent: 0,
            totalErrors: 0,
            connectedUsers: 0,
            disconnectedUsers: 0
        };
        this.onStatsUpdate = options.onStatsUpdate || null;
        this.timestampOffsetRange = options.timestampOffsetRange || 50; // ±50ms variation
        this.useDeterministicOffsets = options.useDeterministicOffsets !== false; // Default: true for consistent testing
        this.frameCounter = 0; // For deterministic ordering
    }

    /**
     * Generate a random 3-letter string (uppercase)
     */
    _generateRandomString() {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';
        for (let i = 0; i < 3; i++) {
            result += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return result;
    }

    /**
     * Start stress test with N simulated users
     * @param {number} userCount - Number of users to simulate (1-50)
     * @param {string} baseUsername - Base username to generate unique usernames from
     */
    async start(userCount, baseUsername = 'stress_user') {
        if (this.isRunning) {
            this.stop();
        }

        this.userCount = Math.max(1, Math.min(50, userCount));
        this.isRunning = true;
        this.stats.totalFramesSent = 0;
        this.stats.totalErrors = 0;
        this.stats.connectedUsers = 0;
        this.stats.disconnectedUsers = 0;

        // Create WebSocket connections for each simulated user
        const connectionPromises = [];
        for (let i = 0; i < this.userCount; i++) {
            const randomSuffix = this._generateRandomString();
            const username = `${baseUsername}_${randomSuffix}`;
            connectionPromises.push(this._createUserConnection(username, i));
        }

        // Wait for all connections (with timeout)
        await Promise.allSettled(connectionPromises);

        this._updateStats();
        return {
            success: this.stats.connectedUsers,
            failed: this.userCount - this.stats.connectedUsers
        };
    }

    /**
     * Create a WebSocket connection for a simulated user
     */
    _createUserConnection(username, index) {
        return new Promise((resolve) => {
            try {
                const ws = new LandmarkWebSocket(this.sessionName, {
                    mode: 'upload',
                    username: username,
                    onConnect: () => {
                        this.simulatedUsers.set(username, {
                            ws: ws,
                            connected: true,
                            stats: { framesSent: 0, errors: 0 }
                        });
                        this.stats.connectedUsers++;
                        this._updateStats();
                        resolve({ username, success: true });
                    },
                    onError: (error) => {
                        const userData = this.simulatedUsers.get(username);
                        if (userData) {
                            userData.connected = false;
                            userData.stats.errors++;
                            this.stats.totalErrors++;
                        } else {
                            this.stats.totalErrors++;
                            this.stats.disconnectedUsers++;
                        }
                        this._updateStats();
                        resolve({ username, success: false, error });
                    },
                    onDisconnect: () => {
                        const userData = this.simulatedUsers.get(username);
                        if (userData) {
                            userData.connected = false;
                            this.stats.disconnectedUsers++;
                            this._updateStats();

                            // Attempt reconnect if stress test is still running
                            if (this.isRunning) {
                                setTimeout(() => {
                                    this._reconnectUser(username);
                                }, 3000);
                            }
                        }
                    },
                    usePollingFallback: false
                });
            } catch (error) {
                this.stats.totalErrors++;
                this.stats.disconnectedUsers++;
                resolve({ username, success: false, error });
            }
        });
    }

    /**
     * Reconnect a disconnected user
     */
    _reconnectUser(username) {
        if (!this.isRunning) return;

        // Extract the suffix (3-letter string) from username
        const match = username.match(/_(.{3})$/);
        const index = match ? 0 : 0; // Index not needed for reconnection, just use 0

        this._createUserConnection(username, index);
    }

    /**
     * Duplicate a landmark frame to all simulated users
     * @param {Object} frameData - Original frame data from source user
     * @param {string} dataType - 'landmark' or 'pose'
     */
    duplicateFrame(frameData, dataType = 'landmark') {
        if (!this.isRunning || this.simulatedUsers.size === 0) {
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        // Increment frame counter for deterministic ordering
        this.frameCounter++;

        // Get sorted list of users for consistent ordering
        const userList = Array.from(this.simulatedUsers.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        // Send to each simulated user with deterministic variations
        userList.forEach(([username, userData], index) => {
            if (!userData.connected || !userData.ws.isConnected) {
                return;
            }

            try {
                // Use current timestamp for stress test frames (not the original frame's timestamp)
                // This ensures stress test users are treated equally to real users
                // Small deterministic offset per user for consistent ordering without affecting recency
                let timestampOffset;
                if (this.useDeterministicOffsets) {
                    // Deterministic: small sequential offset per user (ensures consistent ordering)
                    // Each user gets a fixed offset based on their index (0ms, 0.5ms, 1ms, ...)
                    // This ensures consistent selection order while still having slight variations
                    timestampOffset = index * 0.5; // 0.5ms increments for deterministic ordering
                } else {
                    // Random: original behavior (can cause inconsistent selection)
                    timestampOffset = this._getRandomOffset();
                }

                // Use current time instead of frameData.t to ensure stress test users
                // have recent timestamps like real users
                const currentTime = Date.now();
                const duplicatedFrame = {
                    ...frameData,
                    t: currentTime + timestampOffset
                };

                // Optionally add slight position variations for more realism (optional)
                // Disabled for stress testing to ensure consistency
                // if (frameData.p && Array.isArray(frameData.p)) {
                //     duplicatedFrame.p = this._addPositionNoise(frameData.p, 0.001); // ±0.1% noise
                // }

                const sent = userData.ws.uploadFrame(duplicatedFrame, dataType);
                if (sent) {
                    userData.stats.framesSent++;
                    successCount++;
                } else {
                    userData.stats.errors++;
                    errorCount++;
                }
            } catch (error) {
                userData.stats.errors++;
                errorCount++;
                this.stats.totalErrors++;
            }
        });

        this.stats.totalFramesSent += successCount;
        if (errorCount > 0) {
            this.stats.totalErrors += errorCount;
        }

        // Update stats periodically (throttled)
        if (this.stats.totalFramesSent % 10 === 0) {
            this._updateStats();
        }

        return { success: successCount, errors: errorCount };
    }

    /**
     * Get random timestamp offset for variation
     */
    _getRandomOffset() {
        return Math.floor(
            (Math.random() * 2 - 1) * this.timestampOffsetRange
        );
    }

    /**
     * Add slight position noise to landmarks (optional, for realism)
     */
    _addPositionNoise(points, noiseLevel = 0.001) {
        return points.map((point, index) => {
            // Only add noise to coordinate values (x, y), not other metadata
            if (index % 2 === 0 || index % 2 === 1) {
                const noise = (Math.random() * 2 - 1) * noiseLevel;
                return parseFloat((point + noise).toFixed(4));
            }
            return point;
        });
    }

    /**
     * Stop stress test and disconnect all simulated users
     */
    stop() {
        this.isRunning = false;

        // Disconnect all WebSocket connections
        for (const [username, userData] of this.simulatedUsers.entries()) {
            try {
                if (userData.ws) {
                    userData.ws.disconnect();
                }
            } catch (error) {
                // Ignore disconnect errors
            }
        }

        this.simulatedUsers.clear();
        this.userCount = 0;
        this._updateStats();
    }

    /**
     * Get current statistics
     */
    getStats() {
        const connectedCount = Array.from(this.simulatedUsers.values())
            .filter(u => u.connected && u.ws.isConnected).length;

        return {
            ...this.stats,
            connectedUsers: connectedCount,
            totalUsers: this.userCount,
            isRunning: this.isRunning,
            perUserStats: Array.from(this.simulatedUsers.entries()).map(([username, data]) => ({
                username,
                connected: data.connected && data.ws.isConnected,
                framesSent: data.stats.framesSent,
                errors: data.stats.errors
            }))
        };
    }

    /**
     * Update stats and notify callback
     */
    _updateStats() {
        if (this.onStatsUpdate) {
            this.onStatsUpdate(this.getStats());
        }
    }

    /**
     * Check if stress test is running
     */
    isActive() {
        return this.isRunning && this.simulatedUsers.size > 0;
    }
}

export default WebSocketStressTest;

