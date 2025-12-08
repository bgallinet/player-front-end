import React from 'react';

/**
 * PrivacyNoticeAnnex - Shared Privacy Notice Content Component
 * 
 * This component contains the core privacy notice content that can be shared
 * between the full Privacy Notice page and the SignUp overlay.
 */
const PrivacyNoticeAnnex = () => {
    return (
        <>
            <h2 className="mb-3">Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul>
                <li>Authentication information through Amazon Cognito</li>
                <li>Facial expressions and emotions data when you explicitly enable camera access</li>
                <li>User interaction data related to the application features</li>
            </ul>

            <h2 className="mb-3">How We Use Your Information</h2>
            <p>Your information is used to:</p>
            <ul>
                <li>Provide and improve our services</li>
                <li>Enable real-time interaction features</li>
                <li>Generate anonymous analytics</li>
            </ul>

            <h2 className="mb-3">Data Security</h2>
            <p>We implement appropriate security measures to protect your personal information. Your facial expression data is processed in real-time and we do not store video data from camera or raw camera feeds.</p>

            <h2 className="mb-3">Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
                <li>Access your personal data</li>
                <li>Request deletion of your data</li>
                <li>Opt-out of camera-based features</li>
                <li>Withdraw consent at any time</li>
            </ul>

            <h2 className="mb-3">Updates to this Privacy Notice</h2>
            <p>We may update this Privacy Notice to reflect changes in our practices or for legal reasons. We will notify you of significant changes through the app or other communication channels.</p>

            <h2 className="mb-3">Contact</h2>
            <p>For any privacy-related questions or concerns, please contact us at info@tunetribes.live</p>
        </>
    );
};

export default PrivacyNoticeAnnex;
