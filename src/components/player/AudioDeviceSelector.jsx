import React, { useState, useEffect } from 'react';
import { Modal, Form, Alert, Button } from 'react-bootstrap';
import UserAPI from '../../utils/UserAPI';
import { createAuthenticatedRequestBody } from '../../hooks/sessionUtils';
import { secondaryColor } from '../../utils/DisplaySettings';

/**
 * AudioDeviceSelector Component
 * 
 * This component provides audio device selection functionality with a modal interface.
 * It allows users to choose their preferred audio output device and saves the preference.
 * 
 * Features:
 * - Lists available audio output devices
 * - Saves device preference to user settings
 * - Shows status messages for user feedback
 * - Responsive modal design with dark theme
 * 
 * Props:
 * - show: boolean - Controls modal visibility
 * - onHide: function - Callback when modal is closed
 * 
 * Dependencies:
 * - React Bootstrap for Modal, Form, Alert, Button components
 * - UserAPI for saving device preferences
 * - sessionUtils for authenticated requests
 * - DisplaySettings for theming
 */

const AudioDeviceSelector = ({ show, onHide }) => {
    const [audioDevices, setAudioDevices] = useState([]);
    const [selectedAudioDevice, setSelectedAudioDevice] = useState(null);
    const [statusMessage, setStatusMessage] = useState('');

    const getAudioDevices = async () => {
        try {
            // Request permission to access audio devices
            await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Get available audio output devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioOutputs = devices
                .filter(device => device.kind === 'audiooutput')
                .map(device => ({
                    deviceId: device.deviceId,
                    label: device.label || `Audio Device ${device.deviceId.slice(0, 8)}`,
                    groupId: device.groupId
                }));
            
            setAudioDevices(audioOutputs);
            
            // If no device is selected, use the default
            if (!selectedAudioDevice && audioOutputs.length > 0) {
                setSelectedAudioDevice(audioOutputs[0].deviceId);
            }
        } catch (error) {
            // Silent error handling
            setStatusMessage('Unable to access audio devices. Please check permissions.');
        }
    };

    const saveAudioDevice = async (deviceId) => {
        const idToken = localStorage.getItem('idToken');
        if (!idToken) {
            setStatusMessage('Please login to save audio device preferences.');
            return;
        }

        const requestBody = JSON.stringify(createAuthenticatedRequestBody({
            'request_type': 'user',
            'user_request_type': 'changesetting',
            'setting': 'selectedAudioDevice',
            'value': deviceId
        }, false));
        
        try {
            const response = await UserAPI(requestBody);
            if (response) {
                setSelectedAudioDevice(deviceId);
                setStatusMessage('Audio device updated successfully!');
            }
        } catch (error) {
            // Silent error handling
            setStatusMessage('Error updating audio device');
        }
    };

    const handleModalShow = () => {
        getAudioDevices();
    };

    const handleModalHide = () => {
        setStatusMessage('');
        onHide();
    };

    // Auto-hide status message after 3 seconds
    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => {
                setStatusMessage('');
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    // Load devices when modal opens
    useEffect(() => {
        if (show) {
            handleModalShow();
        }
    }, [show]);

    return (
        <Modal 
            show={show} 
            onHide={handleModalHide}
            centered
            backdrop="static"
            keyboard={true}
            style={{ zIndex: 1050 }}
        >
            <Modal.Header 
                closeButton 
                style={{ 
                    backgroundColor: '#1a1a1a', 
                    borderBottom: `1px solid ${secondaryColor}`,
                    color: 'white'
                }}
            >
                <Modal.Title>🔊 Audio Device Settings</Modal.Title>
            </Modal.Header>
            
            <Modal.Body style={{ backgroundColor: '#1a1a1a', color: 'white' }}>
                <div className="mb-3">
                    <Form.Select
                        value={selectedAudioDevice || ''}
                        onChange={(e) => saveAudioDevice(e.target.value)}
                        style={{ backgroundColor: '#333', borderColor: secondaryColor, color: 'white' }}
                    >
                        <option value="">Select Audio Output Device</option>
                        {audioDevices.map((device) => (
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label}
                            </option>
                        ))}
                    </Form.Select>
                </div>
                
                {statusMessage && (
                    <Alert 
                        variant="info" 
                        className="mb-3"
                        style={{ transition: 'opacity 0.3s ease-in-out' }}
                    >
                        {statusMessage}
                    </Alert>
                )}
                
                <div className="text-muted mb-3">
                    <small>
                        Choose your preferred audio output device (Bluetooth headphones, speakers, etc.)
                    </small>
                </div>
                
                <div className="d-flex justify-content-end">
                    <Button 
                        variant="outline-light"
                        onClick={handleModalHide}
                        style={{ borderColor: secondaryColor }}
                    >
                        Close
                    </Button>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default AudioDeviceSelector;
