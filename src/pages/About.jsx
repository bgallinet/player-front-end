import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { StyledCard } from '../utils/StyledComponents';

const About = () => {
    return (
        <Container fluid className="mt-5">
            <Row className="justify-content-center">
                <Col xs={12} md={10} lg={8}>
                    <StyledCard>
                        <h1 className="mb-4">About TuneTribes</h1>
                        
                        <p className="mb-4">
                            <strong>Version:</strong> ed44f842| <strong>Last updated:</strong> 2025-11-10</p>

                        <p className="mb-4">
                            TuneTribes is an innovative real-time music streaming and audience engagement platform that combines cutting-edge emotion detection technology with interactive music experiences. Our platform enables creators and fans to connect through music with real-time facial expression analysis and dynamic audio processing.
                        </p>

                        <h2 className="mb-3">Platform Features</h2>
                        <ul>
                            <li>Real-time facial landmark detection and emotion recognition</li>
                            <li>Movement-responsive audio enhancement (Magic Player)</li>
                            <li>Interactive music sessions with audience engagement</li>
                            <li>Points-based reward system and leaderboards</li>
                            <li>Integration with YouTube and Twitch platforms</li>
                            <li>Session creation and attendance management</li>
                            <li>Real-time analytics and emotion tracking</li>
                        </ul>

                        <h2 className="mb-3">Technology Stack</h2>
                        <p>TuneTribes is built using modern web technologies:</p>
                        <ul>
                            <li><strong>Frontend:</strong> React, React Bootstrap, Web Audio API</li>
                            <li><strong>Backend:</strong> Python (Flask), AWS services (Cognito, EC2, S3, RDS)</li>
                            <li><strong>Infrastructure:</strong> Terraform, AWS CloudFront</li>
                        </ul>

                        <h2 className="mb-3">Open Source Attribution</h2>
                        <p className="mb-4">
                            TuneTribes is built with the support of several open-source libraries and frameworks. We are grateful to the following projects and their contributors:
                        </p>

                        <div className="mb-4 p-3 bg-light rounded">
                            <h4>MediaPipe</h4>
                            <p className="mb-2">
                                This application uses <strong>MediaPipe</strong> for facial landmark detection and tracking.
                            </p>
                            <ul className="mb-2">
                                <li><strong>Project:</strong> <a href="https://mediapipe.dev" target="_blank" rel="noopener noreferrer">https://mediapipe.dev</a></li>
                                <li><strong>Copyright:</strong> © Google LLC</li>
                                <li><strong>License:</strong> Apache License 2.0</li>
                                <li><strong>Repository:</strong> <a href="https://github.com/google/mediapipe" target="_blank" rel="noopener noreferrer">https://github.com/google/mediapipe</a></li>
                            </ul>
                            <p className="mb-0">
                                MediaPipe is an open-source framework for building multimodal applied machine learning pipelines, including real-time facial landmark detection that powers our emotion recognition features.
                            </p>
                        </div>

                        <div className="mb-4 p-3 bg-light rounded">
                            <h4>React & React Bootstrap</h4>
                            <p className="mb-2">
                                Our user interface is built with <strong>React</strong> and <strong>React Bootstrap</strong>.
                            </p>
                            <ul className="mb-2">
                                <li><strong>React:</strong> MIT License - <a href="https://reactjs.org" target="_blank" rel="noopener noreferrer">https://reactjs.org</a></li>
                                <li><strong>React Bootstrap:</strong> MIT License - <a href="https://react-bootstrap.github.io" target="_blank" rel="noopener noreferrer">https://react-bootstrap.github.io</a></li>
                            </ul>
                        </div>

                        <div className="mb-4 p-3 bg-light rounded">
                            <h4>Additional Open Source Libraries</h4>
                            <p className="mb-2">TuneTribes also uses the following open-source libraries:</p>
                            <ul className="mb-0">
                                <li><strong>Web Audio API:</strong> Browser-native audio processing</li>
                                <li><strong>AWS SDK:</strong> Amazon Web Services integration</li>
                                <li><strong>Flask:</strong> Python web framework (BSD License)</li>
                                <li><strong>MySQL:</strong> Database system (GPL License)</li>
                            </ul>
                        </div>

                        <h2 className="mb-3">License Information</h2>
                        <p>
                            The open-source libraries used in TuneTribes are provided under their respective licenses:
                        </p>
                        <ul>
                            <li><strong>Apache License 2.0:</strong> Permits commercial use, modification, and distribution with attribution requirements</li>
                            <li><strong>MIT License:</strong> Permits commercial use, modification, and distribution with copyright notice</li>
                            <li><strong>BSD License:</strong> Permits redistribution and use with copyright notice</li>
                        </ul>
                        <p>
                            Full license texts for these libraries can be found in their respective repositories and documentation.
                        </p>

                        <h2 className="mb-3">Privacy & Data Handling</h2>
                        <p>
                            TuneTribes processes facial expression and emotion data in real-time to provide enhanced user experiences. We are committed to:
                        </p>
                        <ul>
                            <li>Processing facial data locally in your browser when possible</li>
                            <li>Not storing raw video or camera feeds</li>
                            <li>Providing transparency about data collection and usage</li>
                            <li>Giving users control over camera and emotion detection features</li>
                            <li>Complying with applicable data protection regulations</li>
                        </ul>
                        <p>
                            For more information, please review our <a href="/privacy">Privacy Notice</a> and <a href="/terms">Terms of Use</a>.
                        </p>

                        <h2 className="mb-3">Development Team</h2>
                        <p className="mb-4">
                            TuneTribes is developed and maintained by a dedicated team passionate about combining music, technology, and human expression. Our mission is to create innovative ways for creators and audiences to connect through music and emotion.
                        </p>

                        <h2 className="mb-3">Contact Information</h2>
                        <p>For questions, feedback, or support, please contact us:</p>
                        <ul>
                            <li><strong>Email:</strong> info@tunetribes.live</li>
                            <li><strong>Website:</strong> <a href="https://www.tunetribes.live" target="_blank" rel="noopener noreferrer">www.tunetribes.live</a></li>
                        </ul>

                        <h2 className="mb-3">Acknowledgments</h2>
                        <p className="mb-4">
                            We extend our gratitude to the open-source community and all contributors who make projects like TuneTribes possible. Special thanks to Google's MediaPipe team, and the React community for their excellent work and documentation.
                        </p>

                        <div className="mt-5 p-3 bg-light rounded">
                            <p className="mb-0">
                                <strong>TuneTribes - Be part of music</strong>
                            </p>
                            <p className="mb-0 mt-2">
                                © {new Date().getFullYear()} TuneTribes. All rights reserved.
                            </p>
                        </div>
                    </StyledCard>
                </Col>
            </Row>
        </Container>
    );
};

export default About;

