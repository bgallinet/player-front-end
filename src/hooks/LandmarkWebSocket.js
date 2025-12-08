/**
 * WebSocket client for real-time landmark data streaming.
 * Replaces polling with server-pushed, pre-filtered data.
 * 
 * Architecture:
 * - Connects to /ws/landmarks?session_name=X
 * - Receives only selected 9 users' frames (server-side filtering)
 * - Zero client-side filtering needed
 */

class LandmarkWebSocket {
    constructor(sessionName, options = {}) {
        this.sessionName = sessionName;
        this.mode = options.mode || 'view'; // 'view', 'upload', or 'both'
        this.username = options.username || null; // Required for upload mode
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
        this.reconnectDelay = options.reconnectDelay || 3000;
        this.onFrameCallback = options.onFrame || null;
        this.onErrorCallback = options.onError || null;
        this.onConnectCallback = options.onConnect || null;
        this.onDisconnectCallback = options.onDisconnect || null;
        this.onUploadConfirmationCallback = options.onUploadConfirmation || null;
        this.onSelectionChangedCallback = options.onSelectionChanged || null;
        this.usePollingFallback = options.usePollingFallback !== false; // Default true
        this.fallbackToPolling = false;
        this.isConnected = false;
        
        // Get WebSocket URL (supports dev/test/prod)
        this.wsUrl = this._getWebSocketUrl();
        
        this.connect();
    }
    
    /**
     * Ensures correct WebSocket protocol
     * - For domain URLs: Always use wss:// (secure WebSocket) - works from both HTTP and HTTPS pages
     * - For ALB direct URLs: Use ws:// for HTTP, wss:// for HTTPS
     * - Handles URLs with or without protocol
     */
    _ensureSecureWebSocket(url) {
        const isHttpsPage = window.location.protocol === 'https:';
        const isDomainUrl = url && !url.includes('elb.amazonaws.com') && !url.includes('localhost') && !url.includes('127.0.0.1');
        
        // If URL doesn't have protocol, add appropriate one
        if (!url.match(/^(ws|wss):\/\//)) {
            // Domain URLs always use WSS (ALB redirects HTTP to HTTPS anyway, so ws:// won't work)
            // ALB direct URLs: use ws:// for HTTP, wss:// for HTTPS
            if (isDomainUrl) {
                return `wss://${url}`;
            } else {
                // ALB direct or localhost
                const protocol = isHttpsPage ? 'wss:' : 'ws:';
                return `${protocol}//${url}`;
            }
        }
        
        // If URL has protocol, ensure it's correct
        if (isDomainUrl && url.startsWith('ws://')) {
            // Domain URLs should use WSS (ALB redirects HTTP to HTTPS)
            return url.replace('ws://', 'wss://');
        } else if (isHttpsPage && url.startsWith('ws://')) {
            // HTTPS page requires WSS
            return url.replace('ws://', 'wss://');
        } else if (!isDomainUrl && !isHttpsPage && url.startsWith('wss://')) {
            // HTTP page with ALB direct URL should use WS (if ALB supports it)
            return url.replace('wss://', 'ws://');
        }
        
        return url;
    }
    
    _getWebSocketUrl() {
        // Priority order:
        // 1. REACT_APP_WEBSOCKET_URL environment variable (.env file) - highest priority
        // 2. EnvironmentVariables.WebSocketURL (from config file) - works for both localhost and production
        // 3. Auto-detect localhost → use localhost:5000 for local dev (only if no URL configured)
        // 4. Fallback: use window.location (for same-origin in production)
        
        // Build query params
        const params = new URLSearchParams({
            session_name: this.sessionName
        });
        
        if (this.mode !== 'view') {
            params.append('mode', this.mode);
        }
        
        if (this.username && (this.mode === 'upload' || this.mode === 'both')) {
            params.append('username', this.username);
        }
        
        const queryString = params.toString();
        
        // Priority 1: Environment variable (.env file) - highest priority
        if (process.env.REACT_APP_WEBSOCKET_URL) {
            let baseUrl = process.env.REACT_APP_WEBSOCKET_URL.replace(/\/$/, '');
            // Ensure protocol is correct based on page protocol
            baseUrl = this._ensureSecureWebSocket(baseUrl);
            const fullUrl = `${baseUrl}/ws/landmarks?${queryString}`;
            return fullUrl;
        }
        
        // Priority 2: EnvironmentVariables config file
        // Use domain URL for both HTTP and HTTPS pages:
        // - HTTP pages → ws://domain (works even when ALB redirects HTTP to HTTPS, as ws:// bypasses redirect)
        // - HTTPS pages → wss://domain (secure WebSocket)
        // Fallback to ALB direct only if domain is not available
        let envWsUrl = null;
        try {
            const { WebSocketURL, WebSocketTestURL } = require('../utils/EnvironmentVariables');
            const isHttpsPage = window.location.protocol === 'https:';
            
            // Prefer domain URL if available (works for both HTTP and HTTPS)
            // Browser allows ws:// connections even from HTTP pages
            if (WebSocketURL && WebSocketURL.trim() !== '') {
                envWsUrl = WebSocketURL;
            } else if (WebSocketTestURL && WebSocketTestURL.trim() !== '') {
                // Fallback to ALB direct if domain not configured
                envWsUrl = WebSocketTestURL;
            }
        } catch (e) {
            // Import failed, skip
        }
        
        if (envWsUrl) {
            // Ensure protocol is correct based on page protocol
            // This handles: HTTP pages → ws://, HTTPS pages → wss://
            const baseUrl = this._ensureSecureWebSocket(envWsUrl);
            const fullUrl = `${baseUrl}/ws/landmarks?${queryString}`;
            return fullUrl;
        }
        
        // Priority 3: Auto-detect localhost → use backend port (only if no URL configured)
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            const backendPort = process.env.REACT_APP_BACKEND_PORT || '5000';
            // localhost over HTTPS is uncommon, but handle it
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            return `${protocol}//localhost:${backendPort}/ws/landmarks?${queryString}`;
        }
        
        // Priority 4: Fallback - use same origin (for production on same domain)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const port = window.location.port ? `:${window.location.port}` : '';
        return `${protocol}//${hostname}${port}/ws/landmarks?${queryString}`;
    }
    
    connect() {
        // Close any existing connection before creating a new one
        if (this.ws) {
            try {
                // Don't trigger onclose callback when manually closing
                const oldOnClose = this.ws.onclose;
                this.ws.onclose = null;
                this.ws.close(1000, 'Reconnecting');
                this.ws = null;
                this.isConnected = false;
            } catch (error) {
                // Ignore errors when closing old connection
                this.ws = null;
                this.isConnected = false;
            }
        }
        
        // Prevent duplicate connections
        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            return;
        }
        
        try {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.fallbackToPolling = false;
                
                if (this.onConnectCallback) {
                    this.onConnectCallback();
                }
                
                // Send ping to keep connection alive
                this._startHeartbeat();
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'connected') {
                        // Connection confirmed with mode info
                        if (this.onConnectCallback) {
                            this.onConnectCallback(data);
                        }
                    } else if (data.type === 'frame') {
                        // New frame from selected user (view mode) - can be landmark or pose
                        const frameDataType = data.data_type || 'landmark';
                        if (this.onFrameCallback) {
                            // Pass data_type as third parameter to callback
                            this.onFrameCallback(data.user_id, data.frame, frameDataType);
                        }
                    } else if (data.type === 'frame_uploaded') {
                        // Frame upload confirmed (upload mode)
                        if (this.onUploadConfirmationCallback) {
                            this.onUploadConfirmationCallback(data);
                        }
                    } else if (data.type === 'pong') {
                        // Heartbeat response - connection alive
                    } else if (data.type === 'selected_users') {
                        // Debug info about selected users (no action needed)
                    } else if (data.type === 'selection_changed') {
                        // Backend selection changed - notify callback if available
                        if (this.onSelectionChangedCallback) {
                            this.onSelectionChangedCallback(data);
                        }
                    } else if (data.type === 'error') {
                        if (this.onErrorCallback) {
                            this.onErrorCallback(new Error(data.message));
                        }
                    }
                } catch (error) {
                    // Silently handle parsing errors
                }
            };
            
            this.ws.onerror = (error) => {
                if (this.onErrorCallback) {
                    this.onErrorCallback(error);
                }
            };
            
            this.ws.onclose = (event) => {
                this.isConnected = false;
                
                // Clear heartbeat interval
                if (this.heartbeatInterval) {
                    clearInterval(this.heartbeatInterval);
                    this.heartbeatInterval = null;
                }
                
                if (this.onDisconnectCallback) {
                    this.onDisconnectCallback(event);
                }
                
                // Auto-reconnect unless clean close (code 1000) or max attempts reached
                // Also reconnect on unexpected closes (network issues, server restart, etc.)
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
                    
                    setTimeout(() => {
                        // Only reconnect if we don't have a new connection already
                        if (!this.ws || (this.ws.readyState !== WebSocket.CONNECTING && this.ws.readyState !== WebSocket.OPEN)) {
                        this.connect();
                        }
                    }, delay);
                } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    if (this.usePollingFallback && !this.fallbackToPolling) {
                        this.fallbackToPolling = true;
                        if (this.onErrorCallback) {
                            this.onErrorCallback(new Error('WebSocket connection failed, using polling fallback'));
                        }
                    }
                }
            };
            
        } catch (error) {
            if (this.usePollingFallback && !this.fallbackToPolling) {
                this.fallbackToPolling = true;
                if (this.onErrorCallback) {
                    this.onErrorCallback(error);
                }
            }
        }
    }
    
    _startHeartbeat() {
        // Clear any existing heartbeat interval
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        // Send ping every 30 seconds to keep connection alive
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                    this.ws.send(JSON.stringify({
                        type: 'ping',
                        timestamp: Date.now()
                    }));
                } catch (error) {
                    // If send fails, connection is likely dead - trigger reconnect
                    this.isConnected = false;
                    if (this.heartbeatInterval) {
                        clearInterval(this.heartbeatInterval);
                        this.heartbeatInterval = null;
                    }
                    // Trigger reconnect
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
                        setTimeout(() => {
                            this.connect();
                        }, delay);
                    }
                }
            } else {
                // Connection not open - clear heartbeat
                if (this.heartbeatInterval) {
                    clearInterval(this.heartbeatInterval);
                    this.heartbeatInterval = null;
                }
            }
        }, 30000);
    }
    
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
            return true;
        } else {
            return false;
        }
    }
    
    uploadFrame(frameData, dataType = 'landmark') {
        // Convenience method for uploading frames (landmark or pose)
        if (this.mode !== 'upload' && this.mode !== 'both') {
            return false;
        }
        return this.send({
            type: 'upload_frame',
            frame: frameData,
            data_type: dataType  // 'landmark' or 'pose'
        });
    }
    
    disconnect() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        
        this.isConnected = false;
    }
    
    getConnectionState() {
        if (!this.ws) return 'CLOSED';
        
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING:
                return 'CONNECTING';
            case WebSocket.OPEN:
                return 'OPEN';
            case WebSocket.CLOSING:
                return 'CLOSING';
            case WebSocket.CLOSED:
                return 'CLOSED';
            default:
                return 'UNKNOWN';
        }
    }
}

export default LandmarkWebSocket;