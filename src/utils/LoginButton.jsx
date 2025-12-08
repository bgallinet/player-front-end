import React from 'react';
import { Button } from 'react-bootstrap';
import { initiateLogin } from './Auth';

/**
 * LoginButton Component - Direct Login to Cognito
 * 
 * This component provides a simple login button that directly
 * redirects users to the Cognito authentication page.
 */
const LoginButton = () => {
    const handleLoginClick = () => {
        initiateLogin();
    };

    return (
        <Button 
            variant="outline-light"
            onClick={handleLoginClick}
        >
            Login
        </Button>
    );
};

export default LoginButton;
