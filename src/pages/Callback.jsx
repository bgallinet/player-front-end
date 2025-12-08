import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { fetchTokens } from '../utils/Auth';
import UserAPI from '../utils/UserAPI';
import EnvironmentVariables from '../utils/EnvironmentVariables';

export default function Callback() {
    const { handleLogin } = useAuth();
    const navigate = useNavigate();
    const processedRef = useRef(false);

    useEffect(() => {
        const processAuth = async () => {
            // Prevent double processing
            if (processedRef.current) return;
            processedRef.current = true;

            try {
                const params = new URLSearchParams(window.location.search);
                const code = params.get('code');
                
                if (!code) {
                    throw new Error('No authorization code found');
                }

                console.log('code', code);

                // Check if we're in prod environment for PKCE flow
                if (EnvironmentVariables.environment_flag === 'prod') {
                    // PROD: Use PKCE flow with fetchTokens
                    console.log('PROD: Using PKCE flow for confidential client');
                    console.log('🔍 Callback: Checking sessionStorage for code_verifier');
                    console.log('🔍 Callback: sessionStorage code_verifier:', sessionStorage.getItem('code_verifier'));
                    console.log('🔍 Callback: All sessionStorage keys:', Object.keys(sessionStorage));
                    
                    const tokens = await fetchTokens(code);
                    
                    if (!tokens) {
                        throw new Error('Failed to retrieve tokens via PKCE');
                    }

                    handleLogin(tokens);
                    createUser();
                    navigate('/');
                } else {
                    // NON-PROD: Use existing logic for standard OAuth flow
                    console.log('NON-PROD: Using standard OAuth flow');
                    
                    // For non-prod, you might need to implement standard token exchange here
                    // or ensure fetchTokens handles non-prod environments properly
                    const tokens = await fetchTokens(code);
                    
                    if (!tokens) {
                        throw new Error('Failed to retrieve tokens');
                    }

                    handleLogin(tokens);
                    createUser();
                    navigate('/');
                }

            } catch (error) {
                console.error('Authentication error:', error);
                navigate('/', {
                    state: { error: 'Authentication failed. Please try again.' }
                });
            }
        };

        const createUser = async () => {
            const idToken = localStorage.getItem('idToken');
            const requestBody = JSON.stringify({
                'request_type': 'user',
                'idToken': idToken,
                'user_request_type': 'newuser'
            });
            await console.log('API request:', requestBody);
            // Call API for new user creation
            await UserAPI(requestBody);
        }

        processAuth();
        
    }, [handleLogin, navigate]);

    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh' 
        }}>
            Processing login...
        </div>
    );
}