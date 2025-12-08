import React, { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import AnalyticsAPI from '../utils/AnalyticsAPI.jsx';
import { getSessionNameFromUrl } from '../hooks/sessionUtils.js';
import { secondaryColor } from '../utils/DisplaySettings';

/**
 * EvaluationForm Component
 * 
 * A reusable form component for collecting user feedback with multiple input types.
 * 
 * Props:
 * - questions: Array of strings representing the questions to ask
 * - inputTypes: Array of strings representing the input type for each question
 *   - "scale": Creates a 0-10 slider with "Strongly Disagree" to "Completely Agree" labels
 *   - "comment": Creates a textarea for user comments
 * - is_demo_session: Boolean indicating if this is a demo session
 * - sessionName: String for the session name
 * - className: Additional CSS classes
 * - style: Additional inline styles
 * 
 * Example Usage:
 * 
 * const questions = [
 *     "How satisfied are you with the audio quality?",
 *     "How easy was it to use the facial landmark detection?",
 *     "How well did the emotion detection work?",
 *     "How would you rate the overall user experience?",
 *     "Please provide any additional feedback or suggestions."
 * ];
 * 
 * const inputTypes = [
 *     "scale",    // 0-10 scale for satisfaction
 *     "scale",    // 0-10 scale for ease of use
 *     "scale",    // 0-10 scale for emotion detection
 *     "scale",    // 0-10 scale for overall experience
 *     "comment"   // Text input for feedback
 * ];
 * 
 * <EvaluationForm
 *     questions={questions}
 *     inputTypes={inputTypes}
 *     is_demo_session={false}
 *     sessionName="my-session"
 * />
 */
const EvaluationForm = ({ 
    questions = [], 
    inputTypes = [], 
    is_demo_session = false,
    sessionName = null,
    show = false,
    onHide = () => {},
    disableSubmission = false
}) => {
    const [responses, setResponses] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Validate inputs
    if (questions.length !== inputTypes.length) {
        console.error('EvaluationForm: questions and inputTypes arrays must have the same length');
        return null;
    }

    // Handle response change
    const handleResponseChange = (questionIndex, value) => {
        setResponses(prev => ({
            ...prev,
            [questionIndex]: value
        }));
    };

    // Handle form submission
    const handleSubmit = async (event) => {
        event.preventDefault();
        
        if (disableSubmission) {
            return;
        }
        
        setIsSubmitting(true);

        try {
            // Prepare results array in the same order as questions
            const results = questions.map((_, index) => {
                const response = responses[index];
                if (inputTypes[index] === 'scale') {
                    // For scale, return integer or 0 if not answered
                    return typeof response === 'number' ? response : 0;
                } else if (inputTypes[index] === 'comment') {
                    // For comment, return string or empty string if not answered
                    return typeof response === 'string' ? response : '';
                }
                return response || '';
            });

            // Check if all required questions are answered
            const allAnswered = questions.every((_, index) => {
                const response = responses[index];
                if (inputTypes[index] === 'scale') {
                    return typeof response === 'number' && response >= 0 && response <= 10;
                } else if (inputTypes[index] === 'comment') {
                    return typeof response === 'string' && response.trim().length > 0;
                }
                return response !== undefined && response !== null;
            });

            console.log('📝 EvaluationForm: Validation check:', {
                responses,
                allAnswered,
                questions: questions.length,
                inputTypes
            });

            if (!allAnswered) {
                alert('Please answer all questions before submitting.');
                setIsSubmitting(false);
                return;
            }

            // Prepare analytics data - follow the same pattern as other analytics calls
            const analyticsData = JSON.stringify({
                'request_type': 'analytics',
                'interaction_type': 'form',
                'element_id': 'evaluation_form',
                'page_url': window.location.href,
                'session_name': sessionName || getSessionNameFromUrl(),
                'experiment_name': 'evaluation_form',
                'metadata': {
                    'variant': 'control',
                    'is_control': true,
                    'experiment_config': {}
                },
                // Form-specific data
                'form_data': {
                    'questions': questions,
                    'input_types': inputTypes,
                    'results': results
                },
                // Add user_name for demo sessions
                ...(is_demo_session && { 'user_name': 'demo_user_ye5e5p' })
            });

            const parsedData = JSON.parse(analyticsData);
            console.log('📝 EvaluationForm: Submitting form data:', {
                analyticsData,
                is_demo_session,
                sessionName: sessionName || getSessionNameFromUrl(),
                hasInteractionType: 'interaction_type' in parsedData,
                hasSessionName: 'session_name' in parsedData,
                interactionTypeValue: parsedData.interaction_type,
                sessionNameValue: parsedData.session_name,
                dataKeys: Object.keys(parsedData)
            });

            // Call analytics API
            const response = await AnalyticsAPI(analyticsData, !is_demo_session);
            
            console.log('📝 EvaluationForm: API response:', response);
            
            // Parse the nested response structure
            let responseStatus = null;
            let responseBody = null;
            
            if (response && response.body) {
                try {
                    const parsedBody = JSON.parse(response.body);
                    responseStatus = parsedBody.statusCode;
                    responseBody = parsedBody.body;
                    
                    console.log('📝 EvaluationForm: Parsed response:', {
                        status: responseStatus,
                        body: responseBody
                    });
                } catch (parseError) {
                    console.error('📝 EvaluationForm: Error parsing response body:', parseError);
                }
            }
            
            if (responseStatus === 200) {
                console.log('📝 EvaluationForm: Form submitted successfully');
                // Reset form
                setResponses({});
                onHide(); // Close the modal after successful submission
            } else {
                console.error('📝 EvaluationForm: Form submission failed:', {
                    response,
                    status: responseStatus,
                    body: responseBody
                });
                alert('Failed to submit form. Please try again.');
            }

        } catch (error) {
            console.error('Error submitting evaluation form:', error);
            alert('Error submitting form. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render scale input (0-10) with clickable dots
    const renderScaleInput = (questionIndex, question) => {
        const value = responses[questionIndex] !== undefined ? responses[questionIndex] : null; // No default value
        
        return (
            <div className="mb-4">
                <label className="form-label mb-3" style={{ color: 'white', fontSize: '1rem', fontWeight: 'bold' }}>
                    {question}
                </label>
                <div className="d-flex flex-column gap-2">
                    <div className="d-flex justify-content-between">
                        <span style={{ color: '#ccc', fontSize: '0.9rem' }}>Strongly Disagree</span>
                        <span style={{ color: '#ccc', fontSize: '0.9rem' }}>Completely Agree</span>
                    </div>
                    
                    {/* Numbers above dots */}
                    <div className="d-flex justify-content-between align-items-center" style={{ padding: '0 0.5rem', marginBottom: '0.5rem' }}>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((scaleValue) => (
                            <span
                                key={scaleValue}
                                style={{
                                    width: '20px',
                                    textAlign: 'center',
                                    fontSize: '0.7rem',
                                    color: '#999'
                                }}
                            >
                                {scaleValue}
                            </span>
                        ))}
                    </div>
                    
                    {/* Clickable dots */}
                    <div className="d-flex justify-content-between align-items-center" style={{ padding: '0 0.5rem' }}>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((scaleValue) => (
                            <button
                                key={scaleValue}
                                type="button"
                                className="btn p-0"
                                style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    backgroundColor: value === scaleValue ? secondaryColor : '#444',
                                    border: `2px solid ${value === scaleValue ? '#fff' : '#666'}`,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                onClick={() => handleResponseChange(questionIndex, scaleValue)}
                                onMouseEnter={(e) => {
                                    if (value !== scaleValue) {
                                        e.target.style.backgroundColor = '#666';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (value !== scaleValue) {
                                        e.target.style.backgroundColor = '#444';
                                    }
                                }}
                            >
                                {value === scaleValue && (
                                    <div
                                        style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            backgroundColor: '#fff'
                                        }}
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    // Render comment input
    const renderCommentInput = (questionIndex, question) => {
        const value = responses[questionIndex] || '';
        
        return (
            <div className="mb-4">
                <label className="form-label mb-3" style={{ color: 'white', fontSize: '1rem', fontWeight: 'bold' }}>
                    {question}
                </label>
                <Form.Control
                    as="textarea"
                    rows="4"
                    value={value}
                    onChange={(e) => handleResponseChange(questionIndex, e.target.value)}
                    placeholder="Please provide your comments..."
                />
            </div>
        );
    };

    if (!show) {
        return null;
    }

    return (
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
        >
            <div
                style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '0.5rem',
                    padding: '2rem',
                    maxWidth: '600px',
                    width: '100%',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    border: `2px solid ${secondaryColor}`,
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4">
                    <h3 style={{ color: 'white', margin: 0, fontSize: '1.5rem' }}>
                        📝 Evaluation Form
                    </h3>
                    <p style={{ color: '#ccc', fontSize: '0.9rem', opacity: 0.8, margin: '0.5rem 0 0 0' }}>
                        Please provide your feedback on the experience
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {questions.map((question, index) => {
                        const inputType = inputTypes[index];
                        
                        return (
                            <div key={index}>
                                {inputType === 'scale' && renderScaleInput(index, question)}
                                {inputType === 'comment' && renderCommentInput(index, question)}
                            </div>
                        );
                    })}
                    
                    {!disableSubmission && (
                        <div className="d-flex justify-content-end mt-4 pt-3" style={{ borderTop: '1px solid #333' }}>
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={isSubmitting}
                                style={{ 
                                    minWidth: '120px',
                                    backgroundColor: secondaryColor,
                                    borderColor: secondaryColor,
                                    fontSize: '1rem',
                                    padding: '0.75rem 1.5rem'
                                }}
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit'}
                            </Button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default EvaluationForm;
