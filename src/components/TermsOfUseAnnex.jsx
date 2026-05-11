import React from 'react';

/**
 * TermsOfUseAnnex - Shared Terms of Use Content Component
 *
 * Describes TuneTribes as adaptive music software (not a streaming service).
 */
const TermsOfUseAnnex = () => {
    return (
        <>
            <h2 className="mb-3">1. Acceptance of Terms</h2>
            <p>
                By creating an account, accessing, or using TuneTribes, you acknowledge that you have read,
                understood, and agree to be bound by these Terms of Use and our Privacy Notice. If you do not
                agree to these terms, please do not use our service.
            </p>

            <h2 className="mb-3">2. Service Description</h2>
            <p>
                TuneTribes is <strong>not</strong> a music streaming service, download store, or radio platform.
                We do not supply a catalog of music for on-demand streaming as your primary source of
                recordings. Instead, TuneTribes provides software that <strong>layers over music you already
                play</strong> through permitted sources (for example local files or linked third-party services
                where available) and <strong>adapts</strong> how that music is experienced in real time—for
                example tempo, energy, or playback behaviour—using inputs from your device.
            </p>
            <p>Depending on the version or test session you use, the application may:</p>
            <ul>
                <li>
                    Use sensors on your smartphone, tablet, or wearable (and optional camera, where you allow
                    it) to interpret reactions, movement, or context—not to replace a professional medical or
                    biometric identity system
                </li>
                <li>
                    Adjust or reshape playback in real time so the soundtrack fits your moment, in line with
                    our goal: the right music for how you feel and move
                </li>
                <li>
                    Process signals on the device or through our services to drive that adaptation, as
                    described in our Privacy Notice (including that we do not build a facial profile or store
                    raw biometric templates for identity purposes)
                </li>
            </ul>
            <p>
                Features, experiments, and integrations may change between releases; availability of a given
                mode or integration is not guaranteed.
            </p>

            <h2 className="mb-3">3. User Accounts and Registration</h2>
            <p>
                To access certain features, you may create an account using authentication such as Amazon
                Cognito. You agree to:
            </p>
            <ul>
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain and update your account information</li>
                <li>Keep your login credentials secure and confidential</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us promptly of any unauthorized use of your account</li>
            </ul>

            <h2 className="mb-3">4. Camera, Sensors, and Adaptive Processing</h2>
            <p>
                Where you enable them, camera or sensor-based features process information to infer mood,
                reactions, or movement for adaptive playback. By using these features, you acknowledge that:
            </p>
            <ul>
                <li>Processing may occur in real time to operate the product</li>
                <li>You can revoke camera or sensor permission through your device or browser settings; some
                    features may then be unavailable</li>
                <li>
                    Details of what we collect and retain are set out in our Privacy Notice (including that we
                    do not store raw camera video as a default archival product feature where stated)
                </li>
            </ul>

            <h2 className="mb-3">5. Acceptable Use and Conduct</h2>
            <p>When using TuneTribes, you agree to:</p>
            <ul>
                <li>Use the software only for lawful purposes and in compliance with these Terms</li>
                <li>Not harass others, misuse the service, or attempt to break or circumvent security</li>
                <li>Not use the adaptive or sensor features in a way that endangers people or violates law</li>
                <li>Not interfere with the proper functioning of the application or our infrastructure</li>
            </ul>

            <h2 className="mb-3">6. Audio Content and Rights</h2>
            <p>
                You are responsible for the music and other audio you play through or alongside TuneTribes. You
                must have the rights or licences needed for your use (for example personal listening or as
                otherwise permitted). TuneTribes does not grant you any licence to reproduce, distribute, or
                perform third-party recordings beyond what you already have.
            </p>

            <h2 className="mb-3">7. Third-Party Services</h2>
            <p>
                Optional connections (such as embedded players or external APIs) are subject to those
                providers&apos; terms and privacy policies. TuneTribes is not responsible for third-party
                content, availability, or practices.
            </p>

            <h2 className="mb-3">8. Optional Features and Experiments</h2>
            <p>
                Some builds may include experiments, surveys, or gamified elements (for example points or
                leaderboards). Unless expressly stated otherwise, such elements have no cash value, may change
                or end without notice, and are provided for engagement or research purposes only.
            </p>

            <h2 className="mb-3">9. Privacy and Data Protection</h2>
            <p>
                Our Privacy Notice describes how we handle personal data. By using TuneTribes, you confirm you
                have reviewed it. Key expectations include real-time processing for features that need it,
                choices you can make about camera or sensor use, and your rights regarding your data where
                applicable law applies.
            </p>

            <h2 className="mb-3">10. Technical Requirements</h2>
            <p>Effective use of TuneTribes generally requires:</p>
            <ul>
                <li>A compatible web browser or supported environment</li>
                <li>Network connectivity when features rely on our servers</li>
                <li>Permission for camera, microphone, or other sensors when you choose features that need them</li>
                <li>JavaScript enabled where the web app requires it</li>
            </ul>

            <h2 className="mb-3">11. Intellectual Property</h2>
            <p>
                The TuneTribes software, branding, documentation, and underlying technology are protected by
                intellectual property laws. You receive a limited, revocable licence to use the client
                software as intended. You retain rights to content you own; you grant us only the rights
                needed to operate the service as described in our policies.
            </p>

            <h2 className="mb-3">12. Limitation of Liability</h2>
            <p>TuneTribes is provided &quot;as is&quot; to the extent permitted by law. We are not liable for:</p>
            <ul>
                <li>Interruptions, bugs, or unavailability</li>
                <li>Decisions you make based on adaptive playback or inferred mood</li>
                <li>Third-party services or content</li>
                <li>Indirect or consequential damages, within limits allowed by applicable law</li>
            </ul>

            <h2 className="mb-3">13. Termination</h2>
            <p>We may suspend or terminate access if you breach these Terms or misuse the service. You may stop using TuneTribes at any time.</p>

            <h2 className="mb-3">14. Changes to Terms</h2>
            <p>
                We may update these Terms. Material changes may be communicated through the app or other
                reasonable means. Continued use after changes become effective constitutes acceptance unless
                prohibited by law.
            </p>

            <h2 className="mb-3">15. Governing Law</h2>
            <p>These Terms are governed by applicable law. Disputes will be handled through appropriate legal channels.</p>

            <h2 className="mb-3">16. Contact</h2>
            <p>
                For questions about these Terms, please{' '}
                <a href="https://www.tunetribes.live/contact" target="_blank" rel="noopener noreferrer">
                    contact us
                </a>
                .
            </p>
        </>
    );
};

export default TermsOfUseAnnex;
