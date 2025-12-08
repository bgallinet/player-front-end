import React, { useState, useEffect } from 'react';
import { Row, Col } from 'react-bootstrap';
import InfoAPI from '../utils/InfoAPI';
import { getSessionNameFromUrl } from '../hooks/sessionUtils';
import { createAuthenticatedRequestBody } from '../hooks/sessionUtils';
import { isDemoSession } from '../hooks/demoUserManager';

const Chat = ({ sessionName, height = 50 }) => {
    const [channelName, setChannelName] = useState(null);
    const [embedTW, setEmbedTW] = useState(false);

    useEffect(() => {
        const getChannelName = async () => {
            if (!sessionName) {
                console.warn('No session name available for getChannelName');
                return;
            }
            
            try {
                // Create request body directly (no double stringify/parse)
                const requestBody = createAuthenticatedRequestBody({
                    'request_type': 'info',
                    'info_type': 'getsettings'
                }, isDemoSession(), false); // Don't auto-add session_name, add it manually
                
                // Manually set the session name to use sessionName prop instead of URL
                requestBody.session_name = sessionName;
                
                const bodyData = JSON.stringify(requestBody);
                
                const jsonData = await InfoAPI(bodyData, !isDemoSession());
                
                if (jsonData && jsonData.body) {
                    // Parse the nested response structure (info endpoint - double parsing)
                    let responseData;
                    if (typeof jsonData.body === 'string') {
                        responseData = JSON.parse(jsonData.body);
                    } else {
                        responseData = jsonData.body;
                    }
                    
                    // Extract the actual result from the nested response
                    let result;
                    if (responseData.body && typeof responseData.body === 'string') {
                        result = JSON.parse(responseData.body);
                    } else {
                        result = responseData.body || responseData;
                    }
                    
                    
                    // Check if result exists and has the expected properties
                    if (!result) {
                        console.warn('No result data in response for chat settings');
                        return;
                    }
                    
                    const embeddingVarTW = result.TW_embed_bool;
                    if (embeddingVarTW == 0) {
                        setEmbedTW(false);
                    } else {
                        setEmbedTW(true);
                    }
                    setChannelName(result.TW_channel_name || null);
                } else {
                    console.warn('No response data received for chat settings');
                }
            } catch (error) {
                console.error('Error fetching channel name:', error);
            }
        }
        getChannelName();
    }, [sessionName]);

    return (
        <>
            {embedTW && channelName && (
                <Row className="justify-content-center mb-3">
                    <Col xs={12} md={8} lg={6}>
                        <iframe
                            src={`https://www.twitch.tv/embed/${channelName}/chat?parent=${window.location.hostname}`}
                            height={`${height}vh`}
                            width="100%"
                            style={{
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '0.5rem',
                                backgroundColor: 'rgba(0, 0, 0, 0.2)'
                            }}
                        />
                    </Col>
                </Row>
            )}
        </>
    );
};

export default Chat;