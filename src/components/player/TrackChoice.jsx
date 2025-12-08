import React, { useState, useRef } from 'react';
import { Button, Alert } from 'react-bootstrap';
import { Text, Subtitle } from '../../utils/StyledComponents';
import { secondaryColor } from '../../utils/DisplaySettings';

// Demo tracks configuration
const DEMO_TRACKS = [
    {
        filename: 'Get lucky.m4a',
        title: 'Get Lucky',
        artist: 'Daft Punk'
    },
    {
        filename: 'Billie Jean.mp3',
        title: 'Billie Jean',
        artist: 'Michael Jackson'
    },
    {
        filename: 'By the way.mp3',
        title: 'By the Way',
        artist: 'Red Hot Chili Peppers'
    },
    {
        filename: 'custom',
        title: 'Upload your own',
        artist: ''
    }
];

const CLOUDFRONT_URL = 'https://dhuj2x4ippvty.cloudfront.net';

const TrackChoice = ({
    onTrackSelect,
    selectedFile,
    currentTrackName,
    error
}) => {
    const [selectedDemoTrack, setSelectedDemoTrack] = useState(DEMO_TRACKS[0]);
    const fileInputRef = useRef(null);

    // Handle demo track selection change
    const handleDemoTrackChange = (track) => {
        setSelectedDemoTrack(track);
        
        // If "Upload your own" is chosen, trigger file input
        if (track.filename === 'custom') {
            fileInputRef.current?.click();
            return;
        }
        
        // Load demo track
        const DEMO_TRACK_URL = `${CLOUDFRONT_URL}/${track.filename}`;
        const trackFile = {
            name: `${track.title} - ${track.artist}`,
            url: DEMO_TRACK_URL,
            isDemo: true
        };
        
        onTrackSelect(trackFile);
    };


    // Handle file selection
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            // Check if file is a supported audio format
            const supportedTypes = [
                'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav',
                'audio/flac', 'audio/x-flac', 'audio/m4a', 'audio/mp4', 'audio/aac',
                'audio/ogg', 'audio/vorbis', 'audio/wma', 'audio/x-ms-wma',
                'audio/aiff', 'audio/x-aiff', 'audio/basic'
            ];
            
            const fileName = file.name.toLowerCase();
            const supportedExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma', '.aiff', '.au'];
            const hasSupportedExtension = supportedExtensions.some(ext => fileName.endsWith(ext));
            
            if (supportedTypes.includes(file.type) || hasSupportedExtension) {
                onTrackSelect(file);
            } else {
                // Handle error - we'll need to pass this up to parent
                // Unsupported file type
            }
        }
    };

    return (
        <div className="mb-4">
            {/* Track Selection */}
            <div className="text-center mb-4">
                
                {/* File Input (Hidden) */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".mp3,.wav,.flac,.m4a,.aac,.ogg,.wma,.aiff,.au,audio/*"
                    style={{ display: 'none' }}
                />
            </div>


            {/* Track Selection Dropdown */}
            <div className="d-flex justify-content-center mb-3">
                <div style={{ minWidth: '300px' }}>
                    <Text style={{ margin: 0, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        Select track or upload your own:
                    </Text>
                    <select
                        value={selectedDemoTrack.filename}
                        onChange={(e) => {
                            const selectedTrack = DEMO_TRACKS.find(track => track.filename === e.target.value);
                            if (selectedTrack) {
                                handleDemoTrackChange(selectedTrack);
                            }
                        }}
                        style={{
                            width: '100%',
                            padding: '0.5rem',
                            backgroundColor: '#333',
                            border: `1px solid ${secondaryColor}`,
                            borderRadius: '0.25rem',
                            color: 'white',
                            fontSize: '0.9rem'
                        }}
                    >
                        {DEMO_TRACKS.map((track) => (
                            <option key={track.filename} value={track.filename}>
                                {track.title} - {track.artist}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <Alert variant="danger" className="mb-4">
                    {error}
                </Alert>
            )}
        </div>
    );
};

export default TrackChoice;
