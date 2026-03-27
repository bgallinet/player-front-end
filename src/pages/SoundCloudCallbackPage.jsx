import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSoundCloudAuth } from '../contexts/SoundCloudAuthContext';

const SoundCloudCallbackPage = () => {
    const { handleCallback } = useSoundCloudAuth();
    const navigate = useNavigate();
    const processedRef = useRef(false);

    useEffect(() => {
        const processAuth = async () => {
            if (processedRef.current) return;
            processedRef.current = true;

            try {
                const params = new URLSearchParams(window.location.search);
                const code = params.get('code');
                const error = params.get('error');

                if (error) {
                    throw new Error(`SoundCloud authorization denied: ${error}`);
                }

                if (!code) {
                    throw new Error('No authorization code found');
                }

                const state = params.get('state');
                const success = await handleCallback(code, state);

                if (success) {
                    navigate('/soundcloudplayer');
                } else {
                    navigate('/', {
                        state: { error: 'SoundCloud authentication failed. Please try again.' }
                    });
                }
            } catch (err) {
                console.error('SoundCloud callback error:', err);
                navigate('/', {
                    state: { error: err.message || 'SoundCloud authentication failed.' }
                });
            }
        };

        processAuth();
    }, [handleCallback, navigate]);

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            color: 'white',
            backgroundColor: '#1a1a1a',
        }}>
            Connecting to SoundCloud...
        </div>
    );
};

export default SoundCloudCallbackPage;
