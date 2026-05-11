import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';

const RequireAuth = ({ children }) => {
    const location = useLocation();
    const { idToken, isAuthInitializing } = useAuth();

    if (isAuthInitializing) {
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

    if (!idToken) {
        return (
            <Navigate
                to="/"
                replace
                state={{ from: location.pathname, authRequired: true }}
            />
        );
    }

    return children;
};

export default RequireAuth;
