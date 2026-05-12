import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { fetchTokens } from '../utils/Auth';
import UserAPI from '../utils/UserAPI';
import EnvironmentVariables from '../utils/EnvironmentVariables';
import { parseProcessDataResponse } from '../utils/parseProcessDataResponse';

export default function Callback() {
    const { handleLogin } = useAuth();
    const navigate = useNavigate();
    const processedRef = useRef(false);

    useEffect(() => {
        const processAuth = async () => {
            if (processedRef.current) return;
            processedRef.current = true;

            try {
                const params = new URLSearchParams(window.location.search);
                const code = params.get('code');

                if (!code) {
                    throw new Error('No authorization code found');
                }

                const tokens = await fetchTokens(code);
                if (!tokens) {
                    throw new Error('Failed to retrieve tokens');
                }

                handleLogin(tokens);

                const { isNewUser } = await registerUserIfNeeded();
                navigate('/', {
                    replace: true,
                    state: isNewUser ? { showUserProfileForm: true } : {},
                });
            } catch (error) {
                console.error('Authentication error:', error);
                navigate('/', {
                    replace: true,
                    state: { error: 'Authentication failed. Please try again.' },
                });
            }
        };

        /** POST /process-data newuser; returns whether the account was just created. */
        const registerUserIfNeeded = async () => {
            const idToken = localStorage.getItem('idToken');
            if (!idToken) {
                return { isNewUser: false };
            }
            const requestBody = JSON.stringify({
                request_type: 'user',
                idToken,
                user_request_type: 'newuser',
            });
            const apiResult = await UserAPI(requestBody);
            const parsed = parseProcessDataResponse(apiResult);
            if (!parsed || parsed.statusCode !== 200) {
                console.warn('registerUserIfNeeded: unexpected response', apiResult);
                return { isNewUser: false };
            }
            const { payload } = parsed;
            const isNewUser =
                payload?.is_new_user === true ||
                payload?.message === 'User created successfully';
            return { isNewUser };
        };

        void processAuth();
    }, [handleLogin, navigate]);

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
            }}
        >
            Processing login...
        </div>
    );
}
