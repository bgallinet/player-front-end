import React, { useEffect, useRef } from 'react';
import { Spinner } from 'react-bootstrap';
import { usePlayerAuthStatus } from '../../hooks/usePlayerAuthStatus';

/**
 * Blocks a player route until the correct provider account is connected.
 * If not authenticated, starts that provider's login flow.
 */
const RequirePlayerAuth = ({ authType, children }) => {
    const { isAuthenticated, isLoading, initiateLogin } = usePlayerAuthStatus(authType);
    const loginTriggeredRef = useRef(false);

    useEffect(() => {
        if (isLoading || isAuthenticated || loginTriggeredRef.current) return;
        loginTriggeredRef.current = true;
        initiateLogin();
    }, [isLoading, isAuthenticated, initiateLogin]);

    if (isLoading || !isAuthenticated) {
        return (
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '50vh',
                }}
            >
                <Spinner animation="border" />
            </div>
        );
    }

    return children;
};

export default RequirePlayerAuth;
