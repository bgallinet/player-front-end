import React, { useEffect, useRef } from 'react';
import { Form as BootstrapForm } from 'react-bootstrap';
import PrivacyNoticeAnnex from './PrivacyNoticeAnnex';
import TermsOfUseAnnex from './TermsOfUseAnnex';
import { secondaryColor } from '../utils/DisplaySettings';

/**
 * Scrollable Privacy Notice + Terms embed with explicit consent checkbox (GDPR).
 */
const GdprConsentBlock = ({
    agreed,
    onAgreedChange,
    scrolledToBottom,
    onScroll,
    disabled = false,
}) => {
    const scrollRef = useRef(null);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const check = () => {
            if (el.scrollHeight <= el.clientHeight + 12) {
                onScroll({ target: el });
            }
        };
        check();
        const t = window.setTimeout(check, 100);
        return () => window.clearTimeout(t);
    }, [onScroll]);

    return (
        <>
            <style>{`
                .gdpr-legal-scroll h2 {
                    font-size: 0.95rem;
                    color: #fff;
                    margin-top: 1rem;
                    margin-bottom: 0.5rem;
                }
                .gdpr-legal-scroll p,
                .gdpr-legal-scroll li {
                    font-size: 0.82rem;
                }
                .gdpr-legal-scroll a {
                    color: ${secondaryColor};
                }
            `}</style>
            <div
            style={{
                marginTop: '1.5rem',
                paddingTop: '1.25rem',
                borderTop: '1px solid #333',
            }}
        >
            <h3 style={{ color: 'white', fontSize: '1.05rem', marginBottom: '0.5rem' }}>
                Privacy &amp; terms
            </h3>
            <p style={{ color: '#bbb', fontSize: '0.85rem', marginBottom: '0.75rem', lineHeight: 1.45 }}>
                Please read the Privacy Notice and Terms of Use below. You must scroll through the
                full text and confirm your agreement before continuing.
            </p>

            <div
                ref={scrollRef}
                onScroll={onScroll}
                className="gdpr-legal-scroll"
                style={{
                    maxHeight: '240px',
                    overflowY: 'auto',
                    padding: '1rem 1.1rem',
                    marginBottom: '1rem',
                    backgroundColor: '#111',
                    borderRadius: '0.4rem',
                    border: '1px solid #444',
                    color: '#e8e8e8',
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                }}
            >
                <h4 style={{ color: 'white', fontSize: '1rem', marginBottom: '0.75rem' }}>
                    Privacy Notice
                </h4>
                <p style={{ marginBottom: '1rem', opacity: 0.85 }}>
                    <strong>Last updated:</strong> {new Date().toLocaleDateString()}
                </p>
                <PrivacyNoticeAnnex />

                <hr style={{ borderColor: '#333', margin: '1.25rem 0' }} />

                <h4 style={{ color: 'white', fontSize: '1rem', marginBottom: '0.75rem' }}>
                    Terms of Use
                </h4>
                <p style={{ marginBottom: '1rem', opacity: 0.85 }}>
                    <strong>Last updated:</strong> {new Date().toLocaleDateString()}
                </p>
                <p style={{ marginBottom: '1rem' }}>
                    Welcome to TuneTribes! These Terms govern your use of our adaptive music software.
                    By continuing, you agree to be bound by these Terms and our Privacy Notice.
                </p>
                <TermsOfUseAnnex />
            </div>

            {!scrolledToBottom && (
                <p
                    style={{
                        color: '#aaa',
                        fontSize: '0.8rem',
                        fontStyle: 'italic',
                        marginBottom: '0.75rem',
                    }}
                >
                    Scroll to the bottom of the text above to enable agreement.
                </p>
            )}

            <BootstrapForm.Check
                type="checkbox"
                id="gdpr-consent-agree"
                disabled={disabled || !scrolledToBottom}
                checked={agreed}
                onChange={(e) => onAgreedChange(e.target.checked)}
                label={
                    <span style={{ color: 'white', fontSize: '0.9rem' }}>
                        I have read and agree to the{' '}
                        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: secondaryColor }}>
                            Privacy Notice
                        </a>{' '}
                        and{' '}
                        <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: secondaryColor }}>
                            Terms of Use
                        </a>
                        .
                    </span>
                }
                style={{ marginBottom: 0 }}
            />
        </div>
        </>
    );
};

export default GdprConsentBlock;
