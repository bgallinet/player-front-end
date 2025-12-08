import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import { Subtitle, Text } from './StyledComponents';
import { secondaryColor } from './DisplaySettings';
import CloseButton from './CloseButton';
import PrivacyNoticeAnnex from '../components/PrivacyNoticeAnnex';
import TermsOfUseAnnex from '../components/TermsOfUseAnnex';
import { initiateLogin } from './Auth';
import AnalyticsAPI from './AnalyticsAPI';
import { getSessionNameFromUrl } from '../hooks/sessionUtils';
import { isDemoSession, getDemoUsername } from '../hooks/demoUserManager';
import { fetchExperiment } from '../hooks/useExperiment';

/**
 * SignUpButton Component - Sign Up with Pricing Overlay and Terms
 * 
 * A/B Testing: Tests pricing display impact on signup flow completion
 * - First overlay: Shows pricing and app features
 * - Second overlay: Terms of use and privacy notice
 * - KPI: Click rate on "Next" button to proceed to terms
 */
const SignUpButton = () => {
    const [showPricingOverlay, setShowPricingOverlay] = useState(false);
    const [showTermsOverlay, setShowTermsOverlay] = useState(false);
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
    const [experiment, setExperiment] = useState(null);

    // Default control variant configuration
    const defaultConfig = {
        show_pricing: false,
        price_display: '',
        title: 'Welcome to TuneTribes',
        features: ['Real-time emotion detection', 'Interactive music requests', 'Live audience engagement']
    };

    const showPricing = experiment?.config?.show_pricing ?? defaultConfig.show_pricing;
    const priceDisplay = experiment?.config?.price_display || defaultConfig.price_display;
    const title = experiment?.config?.title || defaultConfig.title;
    const features = experiment?.config?.features || defaultConfig.features;

    const handleSignUpClick = async () => {
        // Analytics call for signup button click (not part of experiment)
        try {
            const analyticsData = JSON.stringify({
                'request_type': 'analytics',
                'interaction_type': 'user_interaction',
                'element_id': 'signup_button_click',
                'page_url': window.location.href,
                'session_name': getSessionNameFromUrl(),
                ...(isDemoSession() && { 'user_name': 'demo_user_ye5e5p' })
            });
            AnalyticsAPI(analyticsData, !isDemoSession());
        } catch (error) {
            console.error('Analytics API error:', error);
        }

        // Fetch experiment to determine which variant to show in the overlay
        const fetchedExperiment = await fetchExperiment('signup_button_pricing_test');
        setExperiment(fetchedExperiment);
        
        
        // Show pricing overlay with content based on the variant
        setShowPricingOverlay(true);
    };

    const handleNextClick = () => {
        // Analytics call for Next button click (KPI)
        try {
            const analyticsData = JSON.stringify({
                'request_type': 'analytics',
                'interaction_type': 'user_interaction',
                'element_id': 'signup_next_button_click',
                'page_url': window.location.href,
                'session_name': getSessionNameFromUrl(),
                'experiment_name': 'signup_button_pricing_test',
                'metadata': {
                    'variant': experiment?.variant_name || 'control',
                    'is_control': experiment?.variant_name === 'control',
                    'experiment_config': experiment?.config || {},
                    'conversion': true
                },
                'user_name': experiment?.username || getDemoUsername()
            });
            AnalyticsAPI(analyticsData, !isDemoSession());
        } catch (error) {
            console.error('Analytics API error:', error);
        }

        setShowPricingOverlay(false);
        setShowTermsOverlay(true);
        setHasScrolledToBottom(false);
    };

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
        setHasScrolledToBottom(isAtBottom);
    };

    const handleProceedToSignUp = () => {
        setShowTermsOverlay(false);
        initiateLogin();
    };

    const renderOverlay = (content, showClose, onClose) => (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        zIndex: 1050,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1rem'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                    onClose();
                        }
                    }}
                >
                    <div
                        style={{
                            backgroundColor: '#1a1a1a',
                            borderRadius: '0.5rem',
                            padding: '2rem',
                    maxWidth: '600px',
                            width: '100%',
                            maxHeight: '80vh',
                            border: `2px solid ${secondaryColor}`,
                            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                    flexDirection: 'column',
                    position: 'relative'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                {showClose && (
                    <CloseButton onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 1 }} />
                )}
                {content}
            </div>
        </div>
    );

    const pricingOverlayContent = (
        <>
            {/* Header */}
            <div className="mb-4">
                <h2 style={{ color: 'white', margin: 0, fontSize: '2rem' }}>
                    {title}
                </h2>
                {showPricing && (
                    <div className="mt-3" style={{ 
                        fontSize: '1.5rem', 
                        fontWeight: 'bold', 
                        color: secondaryColor 
                    }}>
                        {priceDisplay}
                    </div>
                )}
            </div>

            {/* Features */}
            <div className="mb-4">
                <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '1rem' }}>
                    App Features
                </h3>
                <ul style={{ color: 'white', paddingLeft: '1.5rem' }}>
                    {features.map((feature, index) => (
                        <li key={index} style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>
                            {feature}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Action Button */}
            <div className="mt-auto pt-4">
                <Button
                    variant="primary"
                    onClick={handleNextClick}
                    style={{
                        width: '100%',
                        backgroundColor: secondaryColor,
                        borderColor: secondaryColor,
                        fontSize: '1.1rem',
                        padding: '0.75rem'
                    }}
                >
                    Next
                </Button>
            </div>
        </>
    );

    const termsOverlayContent = (
        <>
                        {/* Header */}
            <div className="mb-4">
                                <Subtitle style={{ margin: 0, fontSize: '1.5rem' }}>
                    Privacy Notice & Terms of Use
                                </Subtitle>
                                <Text style={{ fontSize: '0.9rem', opacity: 0.8, margin: '0.5rem 0 0 0' }}>
                    Please review before continuing
                                </Text>
                        </div>

                        {/* Scrollable Content */}
                        <div
                            style={{
                                flex: 1,
                                overflowY: 'auto',
                                paddingRight: '0.5rem',
                                marginBottom: '1rem'
                            }}
                            onScroll={handleScroll}
                        >
                <div style={{ color: 'white', textAlign: 'left' }}>
                                <h1 className="mb-4">Privacy Notice</h1>
                                <p className="mb-4">
                                    <strong>Last updated:</strong> {new Date().toLocaleDateString()}
                                </p>
                                <PrivacyNoticeAnnex />
                                
                                <hr className="my-5" style={{ borderColor: '#333' }} />
                                
                                <h1 className="mb-4">Terms of Use</h1>
                                <p className="mb-4">
                                    <strong>Last updated:</strong> {new Date().toLocaleDateString()}
                                </p>
                                <TermsOfUseAnnex />
                            </div>
                        </div>

                        {/* Agreement Message */}
                        <div 
                            className="mb-3 p-3" 
                            style={{ 
                                backgroundColor: '#2a2a2a',
                                borderRadius: '0.5rem',
                                border: `1px solid ${secondaryColor}`
                            }}
                        >
                <Text style={{ fontSize: '0.9rem', margin: 0 }}>
                                <strong>By signing up, you agree to our Privacy Notice and Terms of Use</strong>
                            </Text>
                        </div>

                        {/* Action Buttons */}
                        <div className="d-flex justify-content-between">
                            <Button
                                variant="outline-secondary"
                    onClick={() => setShowTermsOverlay(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleProceedToSignUp}
                                disabled={!hasScrolledToBottom}
                                style={{
                                    backgroundColor: hasScrolledToBottom ? secondaryColor : '#666',
                                    borderColor: hasScrolledToBottom ? secondaryColor : '#666'
                                }}
                            >
                                I Agree - Continue to Sign Up
                            </Button>
                        </div>

                        {/* Scroll Indicator */}
                        {!hasScrolledToBottom && (
                            <div className="text-center mt-2">
                                <Text style={{ fontSize: '0.8rem', opacity: 0.7, fontStyle: 'italic' }}>
                                    Please scroll to the bottom to continue
                                </Text>
                            </div>
                        )}
        </>
    );

    return (
        <>
            <Button 
                variant="outline-light"
                onClick={handleSignUpClick}
                className="me-2"
            >
                Sign up
            </Button>

            {/* Pricing Overlay */}
            {showPricingOverlay && renderOverlay(
                pricingOverlayContent,
                true,
                () => setShowPricingOverlay(false)
            )}

            {/* Terms Overlay */}
            {showTermsOverlay && renderOverlay(
                termsOverlayContent,
                true,
                () => setShowTermsOverlay(false)
            )}
        </>
    );
};

export default SignUpButton;
