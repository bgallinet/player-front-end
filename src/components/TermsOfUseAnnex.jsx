import React from 'react';

/**
 * TermsOfUseAnnex - Shared Terms of Use Content Component
 * 
 * This component contains the core terms of use content that can be shared
 * between the full Terms of Use page and the SignUp overlay.
 */
const TermsOfUseAnnex = () => {
    return (
        <>
            <h2 className="mb-3">1. Acceptance of Terms</h2>
            <p>By creating an account, accessing, or using TuneTribes, you acknowledge that you have read, understood, and agree to be bound by these Terms of Use and our Privacy Notice. If you do not agree to these terms, please do not use our service.</p>

            <h2 className="mb-3">2. Service Description</h2>
            <p>TuneTribes is a real-time music streaming platform that enables:</p>
            <ul>
                <li>Music creators to stream content and engage with their audience</li>
                <li>Music fans to join live sessions and interact with creators</li>
                <li>Real-time emotion detection and facial expression analysis</li>
                <li>Audience engagement through points, song requests, and leaderboards</li>
                <li>Live camera feeds and facial landmark tracking</li>
            </ul>

            <h2 className="mb-3">3. User Accounts and Registration</h2>
            <p>To access certain features of TuneTribes, you must create an account using Amazon Cognito authentication. You agree to:</p>
            <ul>
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain and update your account information</li>
                <li>Keep your login credentials secure and confidential</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>

            <h2 className="mb-3">4. Facial Recognition and Emotion Detection</h2>
            <p>Our platform uses advanced facial recognition technology to enhance user experience. By using these features, you acknowledge and consent to:</p>
            <ul>
                <li>Real-time processing of your facial expressions and emotions</li>
                <li>Detection of head movements, nodding, and facial landmarks</li>
                <li>Collection of emotion data including happy, surprised, sad, angry, fearful, and disgusted expressions</li>
                <li>Processing of facial position and movement data</li>
                <li>Use of this data to provide real-time audience engagement features</li>
            </ul>
            <p><strong>Important:</strong> You can disable camera access at any time, though this may limit certain platform features.</p>

            <h2 className="mb-3">5. Content and Conduct</h2>
            <p>As a user of TuneTribes, you agree to:</p>
            <ul>
                <li>Respect the rights of other users and creators</li>
                <li>Not upload, stream, or share content that is illegal, harmful, or violates others' rights</li>
                <li>Not use the platform for harassment, bullying, or inappropriate behavior</li>
                <li>Not attempt to manipulate or abuse the emotion detection system</li>
                <li>Not interfere with the platform's security or functionality</li>
                <li>Comply with all applicable laws and regulations</li>
            </ul>

            <h2 className="mb-3">6. Creator Responsibilities</h2>
            <p>If you create content or host sessions on TuneTribes, you:</p>
            <ul>
                <li>Are responsible for all content you stream or share</li>
                <li>Must have the rights to any music or content you use</li>
                <li>Are responsible for managing your session settings and user interactions</li>
                <li>Must respect audience privacy and consent regarding emotion detection</li>
                <li>Are responsible for maintaining appropriate behavior in your sessions</li>
            </ul>

            <h2 className="mb-3">7. Third-Party Platform Integration</h2>
            <p>TuneTribes integrates with YouTube and Twitch streaming platforms through embedded content. By using these integrations, you acknowledge and agree that:</p>
            <ul>
                <li>You are bound by YouTube's Terms of Service and Community Guidelines when using YouTube embedding features</li>
                <li>You are bound by Twitch's Terms of Service and Community Guidelines when using Twitch embedding features</li>
                <li>TuneTribes is not responsible for any content, policies, or actions of YouTube or Twitch</li>
                <li>TuneTribes is not liable for any violations of YouTube or Twitch terms that may occur through your use of their platforms</li>
                <li>You are responsible for ensuring your content complies with both TuneTribes and the respective platform's terms of service</li>
            </ul>

            <h2 className="mb-3">8. Points and Rewards System</h2>
            <p>Our platform includes a points-based reward system where users can:</p>
            <ul>
                <li>Earn points through engagement and participation</li>
                <li>Use points to request songs and influence playlists</li>
                <li>Compete on leaderboards</li>
                <li>Shape visual content and session experiences</li>
            </ul>
            <p>Points have no real-world monetary value and are subject to platform rules and limitations.</p>

            <h2 className="mb-3">9. Privacy and Data Protection</h2>
            <p>Your privacy is important to us. Our data collection and processing practices are detailed in our Privacy Notice. Key points include:</p>
            <ul>
                <li>Facial expression data is processed in real-time and not stored as raw video</li>
                <li>Emotion detection data is used to enhance user experience</li>
                <li>You can opt-out of camera-based features at any time</li>
                <li>You have rights to access, modify, and delete your personal data</li>
            </ul>

            <h2 className="mb-3">10. Technical Requirements</h2>
            <p>To use TuneTribes effectively, you need:</p>
            <ul>
                <li>A compatible web browser with camera access</li>
                <li>Stable internet connection for real-time streaming</li>
                <li>Camera and microphone access for full feature functionality</li>
                <li>JavaScript enabled for interactive features</li>
            </ul>

            <h2 className="mb-3">11. Intellectual Property</h2>
            <p>All content on TuneTribes, including but not limited to:</p>
            <ul>
                <li>Platform design, code, and functionality</li>
                <li>User-generated content (subject to user rights)</li>
                <li>Emotion detection algorithms and technology</li>
                <li>Branding and trademarks</li>
            </ul>
            <p>is protected by intellectual property laws. Users retain rights to their original content.</p>

            <h2 className="mb-3">12. Limitation of Liability</h2>
            <p>TuneTribes is provided "as is" without warranties. We are not liable for:</p>
            <ul>
                <li>Service interruptions or technical issues</li>
                <li>User-generated content or interactions</li>
                <li>Emotion detection accuracy or reliability</li>
                <li>Third-party content or services</li>
                <li>Indirect, incidental, or consequential damages</li>
            </ul>

            <h2 className="mb-3">13. Termination</h2>
            <p>We may terminate or suspend your account if you:</p>
            <ul>
                <li>Violate these Terms of Use</li>
                <li>Engage in harmful or inappropriate behavior</li>
                <li>Attempt to abuse or manipulate platform features</li>
                <li>Violate applicable laws or regulations</li>
            </ul>
            <p>You may terminate your account at any time by contacting us.</p>

            <h2 className="mb-3">14. Changes to Terms</h2>
            <p>We may update these Terms of Use from time to time. We will notify users of significant changes through the platform or other communication channels. Continued use of the service after changes constitutes acceptance of the new terms.</p>

            <h2 className="mb-3">15. Governing Law</h2>
            <p>These Terms of Use are governed by applicable laws. Any disputes will be resolved through appropriate legal channels.</p>

            <h2 className="mb-3">16. Contact Information</h2>
            <p>For questions about these Terms of Use or the TuneTribes platform, please contact us at:</p>
            <p><strong>Email:</strong> info@tunetribes.live</p>
        </>
    );
};

export default TermsOfUseAnnex;
