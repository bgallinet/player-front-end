import React, { useState, useEffect, Fragment } from 'react';
import { Button, Form as BootstrapForm } from 'react-bootstrap';
import AnalyticsAPI from '../utils/AnalyticsAPI';
import UserAPI from '../utils/UserAPI';
import { createAuthenticatedRequestBody } from '../hooks/sessionUtils.js';
import { getSessionNameFromUrl } from '../hooks/sessionUtils.js';
import { secondaryColor } from '../utils/DisplaySettings';
import { buildAnalyticsFormMetadata } from '../utils/experimentSession';
import GdprConsentBlock from './GdprConsentBlock';

/**
 * Form
 * 
 * A reusable form component for collecting user feedback with multiple input types.
 * 
 * Props:
 * - questions: Array of strings representing the questions to ask
 * - inputTypes: Array of strings representing the input type for each question
 *   - "scale": Creates a 0-10 slider
 *   - "comment": Creates a textarea for user comments
 * - scaleLabelTypes: Optional array for scale question labels
 *   - "agreement": "Strongly disagree" to "Strongly agree" (default)
 *   - "low_high": "Low" to "High"
 *   - "poor_high": "Poor fit" to "Loved it" (e.g. song fit ratings)
 *   - "not_like_liked": "Did not like" (0) to "Loved it" (10)
 * - sessionName: String for the session name
 * - paragraphAfterQuestionIndex: Optional object { [questionIndex]: string } — non-submitted hint shown after that question
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
 * <Form
 *     questions={questions}
 *     inputTypes={inputTypes}
 *     sessionName="my-session"
 * />
 */
const Form = ({ 
    questions = [], 
    inputTypes = [], 
    questionKinds = [],
    choiceOptions = [],
    introText = '',
    scaleLabelTypes = [],
    scaleMin = 0,
    scaleMax = 10,
    optionalQuestionIndices = [],
    formCategory = 'evaluation_form',
    experimentId = null,
    formMetadata = null,
    localStorageFieldMap = [],
    sessionName = null,
    show = false,
    onHide = () => {},
    disableSubmission = false,
    /** Optional map of question index → paragraph shown immediately after that question (non-submitted). */
    paragraphAfterQuestionIndex = null,
    /** When true, submit via User API (`user_request_type: listening_profile`) into `listening_profiles`. */
    persistListeningProfileToUserProfile = false,
    /** When true, show embedded Privacy/Terms and require scroll + checkbox before submit. */
    requireGdprConsent = false,
}) => {
    const [responses, setResponses] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [gdprAgreed, setGdprAgreed] = useState(false);
    const [gdprScrolledToBottom, setGdprScrolledToBottom] = useState(false);

    useEffect(() => {
        if (!show) {
            setGdprAgreed(false);
            setGdprScrolledToBottom(false);
        }
    }, [show]);

    const handleGdprScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 12;
        setGdprScrolledToBottom(isAtBottom);
    };
    // Validate inputs
    if (questions.length !== inputTypes.length) {
        console.error('FormComponent: questions and inputTypes arrays must have the same length');
        return null;
    }
    if (questionKinds.length > 0 && questionKinds.length !== questions.length) {
        console.error('FormComponent: questionKinds and questions arrays must have the same length');
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
                    // For scale, return integer or null if not answered
                    return typeof response === 'number' ? response : null;
                } else if (inputTypes[index] === 'ranking') {
                    return Array.isArray(response) ? response : [];
                } else if (inputTypes[index] === 'multi_choice') {
                    return Array.isArray(response) ? response : [];
                } else if (inputTypes[index] === 'choice') {
                    return typeof response === 'string' ? response : '';
                } else if (inputTypes[index] === 'comment') {
                    // For comment, return string or empty string if not answered
                    return typeof response === 'string' ? response : '';
                }
                return response || '';
            });

            // Check if all required questions are answered
            const allAnswered = questions.every((_, index) => {
                const response = responses[index];
                const isOptional = optionalQuestionIndices.includes(index);
                if (inputTypes[index] === 'scale') {
                    if (isOptional && (response === undefined || response === null)) {
                        return true;
                    }
                    return typeof response === 'number' && response >= scaleMin && response <= scaleMax;
                } else if (inputTypes[index] === 'ranking') {
                    const options = Array.isArray(choiceOptions[index]) ? choiceOptions[index] : [];
                    if (isOptional && (!Array.isArray(response) || response.length === 0)) {
                        return true;
                    }
                    if (!Array.isArray(response) || response.length !== options.length) {
                        return false;
                    }
                    const uniqueResponseValues = new Set(response);
                    return options.every((option) => uniqueResponseValues.has(option));
                } else if (inputTypes[index] === 'multi_choice') {
                    const options = Array.isArray(choiceOptions[index]) ? choiceOptions[index] : [];
                    if (isOptional && (!Array.isArray(response) || response.length === 0)) {
                        return true;
                    }
                    if (!Array.isArray(response) || response.length === 0) {
                        return false;
                    }
                    return response.every((selected) => options.includes(selected));
                } else if (inputTypes[index] === 'choice') {
                    const options = Array.isArray(choiceOptions[index]) ? choiceOptions[index] : [];
                    if (isOptional && (response === undefined || response === null || response === '')) {
                        return true;
                    }
                    return typeof response === 'string' && options.includes(response);
                } else if (inputTypes[index] === 'comment') {
                    if (isOptional && (!response || response.trim().length === 0)) {
                        return true;
                    }
                    return typeof response === 'string' && response.trim().length > 0;
                }
                if (isOptional && (response === undefined || response === null || response === '')) {
                    return true;
                }
                return response !== undefined && response !== null;
            });

            console.log('📝 FormComponent: Validation check:', {
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

            if (requireGdprConsent && !gdprAgreed) {
                alert('Please read and agree to the Privacy Notice and Terms of Use before continuing.');
                setIsSubmitting(false);
                return;
            }

            const parseApiResponse = (response) => {
                let responseStatus = null;
                let responseBody = null;
                let parsedEnvelope = null;

                if (response && response.body) {
                    try {
                        parsedEnvelope = JSON.parse(response.body);
                        responseStatus = parsedEnvelope.statusCode;
                        responseBody = parsedEnvelope.body;
                    } catch (parseError) {
                        console.error('📝 FormComponent: Error parsing response body:', parseError);
                    }
                }

                if (responseStatus === null && response && typeof response === 'object') {
                    if (typeof response.statusCode === 'number') {
                        responseStatus = response.statusCode;
                        responseBody = response.body ?? null;
                    } else if (typeof response.status === 'number') {
                        responseStatus = response.status;
                        responseBody = response.body ?? null;
                    } else {
                        responseStatus = 200;
                        responseBody = response;
                    }
                }

                if (typeof responseBody === 'string') {
                    try {
                        responseBody = JSON.parse(responseBody);
                    } catch {
                        // Keep original string if not JSON.
                    }
                }
                return { responseStatus, responseBody, parsedEnvelope };
            };

            if (persistListeningProfileToUserProfile) {
                if (!localStorage.getItem('idToken')) {
                    alert('You must be signed in to save your profile.');
                    setIsSubmitting(false);
                    return;
                }
                const surveyId =
                    formMetadata && typeof formMetadata === 'object' && formMetadata.survey_id != null
                        ? formMetadata.survey_id
                        : 'listening_profile_v1';
                const listening_profile = {
                    survey_id: surveyId,
                    unixTime: Math.floor(Date.now() / 1000),
                    questions,
                    input_types: inputTypes,
                    choice_options: choiceOptions,
                    results,
                };
                const requestBody = createAuthenticatedRequestBody(
                    {
                        request_type: 'user',
                        user_request_type: 'listening_profile',
                        listening_profile,
                    },
                    true
                );
                const response = await UserAPI(JSON.stringify(requestBody));
                const parsed = parseApiResponse(response);
                if (parsed.responseStatus !== 200) {
                    console.error('📝 FormComponent: Listening profile save failed', parsed);
                    const errMsg =
                        parsed.responseBody &&
                        typeof parsed.responseBody === 'object' &&
                        parsed.responseBody.error != null
                            ? parsed.responseBody.error
                            : 'Failed to save profile. Please try again.';
                    alert(typeof errMsg === 'string' ? errMsg : 'Failed to save profile. Please try again.');
                    return;
                }
                console.log('📝 FormComponent: Listening profile saved', parsed.responseBody);
                setResponses({});
                onHide();
                return;
            }

            // Persist selected answers to localStorage when field mapping is provided.
            if (Array.isArray(localStorageFieldMap) && localStorageFieldMap.length > 0) {
                localStorageFieldMap.forEach((storageKey, index) => {
                    if (!storageKey) return;
                    const response = results[index];
                    if (response === undefined || response === null || response === '') return;
                    try {
                        localStorage.setItem(storageKey, String(response));
                    } catch {
                        // Ignore storage errors and continue form submission.
                    }
                });
            }

            // Analytics metadata: single builder (evaluation + user_state); session layer may merge via experimentSession.
            const metadata = buildAnalyticsFormMetadata(experimentId, formMetadata);

            const fallbackKind = 'evaluation';
            const normalizedKinds = questions.map((_, index) => {
                const rawKind = questionKinds[index] || fallbackKind;
                return rawKind === 'user_state' ? 'user_state' : 'evaluation';
            });
            const uniqueKinds = [...new Set(normalizedKinds)];

            const defaultFormCategoryByKind = {
                evaluation: 'evaluation_form',
                user_state: 'user_state_survey',
            };

            const useAuthenticatedApi = Boolean(localStorage.getItem('idToken'));
            const submissionResults = [];

            for (const kind of uniqueKinds) {
                const kindIndexes = normalizedKinds
                    .map((questionKind, index) => (questionKind === kind ? index : -1))
                    .filter((index) => index >= 0);
                const indexMap = new Map(kindIndexes.map((originalIndex, groupedIndex) => [originalIndex, groupedIndex]));
                const groupedQuestions = kindIndexes.map((index) => questions[index]);
                const groupedInputTypes = kindIndexes.map((index) => inputTypes[index]);
                const groupedChoiceOptions = kindIndexes.map((index) => choiceOptions[index] || []);
                const groupedScaleLabelTypes = kindIndexes.map((index) => scaleLabelTypes[index] || 'agreement');
                const groupedResults = kindIndexes.map((index) => results[index]);
                const groupedOptionalIndices = optionalQuestionIndices
                    .filter((index) => indexMap.has(index))
                    .map((index) => indexMap.get(index));
                const groupedFormCategory =
                    kind === 'user_state'
                        ? defaultFormCategoryByKind.user_state
                        : formCategory === defaultFormCategoryByKind.user_state
                            ? defaultFormCategoryByKind.evaluation
                            : formCategory;

                const analyticsPayload = {
                    request_type: 'analytics',
                    interaction_type: 'form',
                    element_id: groupedFormCategory,
                    page_url: window.location.href,
                    session_name: sessionName || getSessionNameFromUrl(),
                    experiment_name: groupedFormCategory,
                    metadata,
                    form_data: {
                        form_category: groupedFormCategory,
                        question_kind: kind,
                        questions: groupedQuestions,
                        input_types: groupedInputTypes,
                        choice_options: groupedChoiceOptions,
                        scale_label_types: groupedScaleLabelTypes,
                        scale_min: scaleMin,
                        scale_max: scaleMax,
                        optional_question_indices: groupedOptionalIndices,
                        results: groupedResults,
                    },
                };
                const analyticsData = JSON.stringify(analyticsPayload);

                let response;
                if (useAuthenticatedApi) {
                    const authenticatedBody = createAuthenticatedRequestBody(analyticsPayload, true);
                    response = await UserAPI(JSON.stringify(authenticatedBody));
                } else {
                    response = await AnalyticsAPI(analyticsData, false);
                }

                const parsed = parseApiResponse(response);
                submissionResults.push({
                    kind,
                    formCategory: groupedFormCategory,
                    ...parsed,
                });
            }

            const failedSubmission = submissionResults.find((result) => result.responseStatus !== 200);
            if (failedSubmission) {
                console.error('📝 FormComponent: Grouped submission failed', submissionResults);
                alert('Failed to submit form. Please try again.');
                return;
            }

            console.log('📝 FormComponent: Grouped submission success', submissionResults);
            setResponses({});
            onHide();

        } catch (error) {
            console.error('Error submitting evaluation form:', error);
            alert('Error submitting form. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getScaleLabels = (questionIndex) => {
        const labelType = scaleLabelTypes[questionIndex] || 'agreement';
        if (labelType === 'low_high') {
            return { left: 'Low', right: 'High' };
        }
        if (labelType === 'poor_high') {
            return { left: 'Poor fit', right: 'Loved it' };
        }
        if (labelType === 'not_like_liked') {
            return { left: 'Did not like', right: 'Loved it' };
        }
        return { left: 'Strongly disagree', right: 'Strongly agree' };
    };

    const scaleValues = Array.from(
        { length: Math.max(0, scaleMax - scaleMin + 1) },
        (_, idx) => scaleMin + idx
    );

    const isQuestionOptional = (questionIndex) => optionalQuestionIndices.includes(questionIndex);

    // Render scale input (0-10) with clickable dots
    const renderScaleInput = (questionIndex, question) => {
        const value = responses[questionIndex] !== undefined ? responses[questionIndex] : null; // No default value
        const scaleLabels = getScaleLabels(questionIndex);
        
        return (
            <div className="mb-4">
                <label className="form-label mb-3" style={{ color: 'white', fontSize: '1rem', fontWeight: 'bold' }}>
                    {question}
                    {!isQuestionOptional(questionIndex) && (
                        <span style={{ color: '#ff4d4f', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
                    )}
                </label>
                <div className="d-flex flex-column gap-2">
                    <div className="d-flex justify-content-between">
                        <span style={{ color: '#ccc', fontSize: '0.9rem' }}>{scaleLabels.left}</span>
                        <span style={{ color: '#ccc', fontSize: '0.9rem' }}>{scaleLabels.right}</span>
                    </div>
                    
                    {/* Numbers above dots */}
                    <div className="d-flex justify-content-between align-items-center" style={{ padding: '0 0.5rem', marginBottom: '0.5rem' }}>
                        {scaleValues.map((scaleValue) => (
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
                        {scaleValues.map((scaleValue) => (
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
                    {!isQuestionOptional(questionIndex) && (
                        <span style={{ color: '#ff4d4f', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
                    )}
                </label>
                <BootstrapForm.Control
                    as="textarea"
                    rows="4"
                    value={value}
                    onChange={(e) => handleResponseChange(questionIndex, e.target.value)}
                    placeholder="Comments..."
                />
            </div>
        );
    };

    const renderChoiceInput = (questionIndex, question) => {
        const value = responses[questionIndex] || '';
        const options = Array.isArray(choiceOptions[questionIndex]) ? choiceOptions[questionIndex] : [];
        return (
            <div className="mb-4">
                <label className="form-label mb-3" style={{ color: 'white', fontSize: '1rem', fontWeight: 'bold' }}>
                    {question}
                    {!isQuestionOptional(questionIndex) && (
                        <span style={{ color: '#ff4d4f', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
                    )}
                </label>
                <BootstrapForm.Select
                    value={value}
                    onChange={(e) => handleResponseChange(questionIndex, e.target.value)}
                    style={{
                        backgroundColor: '#222',
                        color: 'white',
                        borderColor: '#555',
                    }}
                >
                    <option value="">Select an option</option>
                    {options.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </BootstrapForm.Select>
            </div>
        );
    };

    const renderMultiChoiceInput = (questionIndex, question) => {
        const options = Array.isArray(choiceOptions[questionIndex]) ? choiceOptions[questionIndex] : [];
        const value = Array.isArray(responses[questionIndex]) ? responses[questionIndex] : [];

        const toggleOption = (option) => {
            const exists = value.includes(option);
            const nextValue = exists ? value.filter((v) => v !== option) : [...value, option];
            handleResponseChange(questionIndex, nextValue);
        };

        return (
            <div className="mb-4">
                <label className="form-label mb-3" style={{ color: 'white', fontSize: '1rem', fontWeight: 'bold' }}>
                    {question}
                    {!isQuestionOptional(questionIndex) && (
                        <span style={{ color: '#ff4d4f', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
                    )}
                </label>
                <div className="d-flex flex-column gap-2">
                    {options.map((option) => {
                        const checked = value.includes(option);
                        return (
                            <label
                                key={option}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    color: 'white',
                                    cursor: 'pointer',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleOption(option)}
                                />
                                <span>{option}</span>
                            </label>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderRankingInput = (questionIndex, question) => {
        const options = Array.isArray(choiceOptions[questionIndex]) ? choiceOptions[questionIndex] : [];
        const currentOrder =
            Array.isArray(responses[questionIndex]) && responses[questionIndex].length === options.length
                ? responses[questionIndex]
                : Array(options.length).fill(null);
        const availableOptions = options.filter((option) => !currentOrder.includes(option));

        const assignItemToRank = (itemValue, targetIndex) => {
            if (!itemValue || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= currentOrder.length) {
                return;
            }
            const reordered = [...currentOrder];
            const existingIndex = reordered.findIndex((item) => item === itemValue);
            if (existingIndex >= 0) {
                reordered[existingIndex] = null;
            }
            reordered[targetIndex] = itemValue;
            handleResponseChange(questionIndex, reordered);
        };

        const removeItemFromRanking = (itemValue) => {
            if (!itemValue) return;
            const reordered = currentOrder.map((item) => (item === itemValue ? null : item));
            handleResponseChange(questionIndex, reordered);
        };

        return (
            <div className="mb-4">
                <label className="form-label mb-3" style={{ color: 'white', fontSize: '1rem', fontWeight: 'bold' }}>
                    {question}
                    {!isQuestionOptional(questionIndex) && (
                        <span style={{ color: '#ff4d4f', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
                    )}
                </label>
                <div style={{ color: '#ccc', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    Drag items from "Available" into the rank slots. Rank 1 = best, rank {options.length} = worst.
                </div>
                <div
                    style={{
                        border: '1px dashed #666',
                        borderRadius: '0.4rem',
                        padding: '0.6rem',
                        marginBottom: '0.75rem',
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        const itemValue = e.dataTransfer.getData('text/plain');
                        removeItemFromRanking(itemValue);
                    }}
                >
                    <div style={{ color: '#ccc', fontSize: '0.8rem', marginBottom: '0.45rem' }}>
                        Available sequences
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                        {availableOptions.map((option) => (
                            <div
                                key={`available-${option}`}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', option);
                                }}
                                style={{
                                    padding: '0.45rem 0.65rem',
                                    borderRadius: '0.4rem',
                                    border: '1px solid #555',
                                    backgroundColor: '#2b2b2b',
                                    color: 'white',
                                    cursor: 'grab',
                                    userSelect: 'none',
                                }}
                            >
                                {option}
                            </div>
                        ))}
                        {availableOptions.length === 0 && (
                            <div style={{ color: '#999', fontSize: '0.85rem' }}>All sequences placed</div>
                        )}
                    </div>
                </div>
                <div className="d-flex flex-column gap-2">
                    {currentOrder.map((item, index) => (
                        <div
                            key={`rank-${index}`}
                            onDragOver={(e) => {
                                e.preventDefault();
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                const itemValue = e.dataTransfer.getData('text/plain');
                                assignItemToRank(itemValue, index);
                            }}
                            style={{
                                padding: '0.6rem 0.75rem',
                                borderRadius: '0.4rem',
                                border: '1px solid #666',
                                backgroundColor: item ? '#222' : '#1b1b1b',
                                color: 'white',
                                userSelect: 'none',
                            }}
                        >
                            <strong style={{ marginRight: '0.5rem' }}>Rank {index + 1}:</strong>
                            {item || <span style={{ color: '#888' }}>Drop here</span>}
                            {item && (
                                <span
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('text/plain', item);
                                    }}
                                    style={{
                                        float: 'right',
                                        color: '#bbb',
                                        cursor: 'grab',
                                        paddingLeft: '0.5rem',
                                    }}
                                >
                                    drag
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (!show) {
        return null;
    }

    /** Sticky GDPR footer needs a fixed modal height; short forms use one scroll area instead. */
    const gdprStickyFooter = requireGdprConsent && questions.length >= 8;

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
                    maxWidth: requireGdprConsent ? '720px' : '600px',
                    width: '100%',
                    maxHeight: requireGdprConsent ? '90vh' : '80vh',
                    height: gdprStickyFooter ? '90vh' : undefined,
                    overflowY: gdprStickyFooter ? 'hidden' : 'auto',
                    display: gdprStickyFooter ? 'flex' : 'block',
                    flexDirection: gdprStickyFooter ? 'column' : undefined,
                    border: `2px solid ${secondaryColor}`,
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <form
                    onSubmit={handleSubmit}
                    style={
                        gdprStickyFooter
                            ? {
                                  display: 'flex',
                                  flexDirection: 'column',
                                  flex: 1,
                                  minHeight: 0,
                              }
                            : undefined
                    }
                >
                    <div
                        style={
                            gdprStickyFooter
                                ? {
                                      flex: '1 1 0',
                                      minHeight: '12rem',
                                      overflowY: 'auto',
                                      paddingRight: '0.35rem',
                                      marginBottom: '1rem',
                                  }
                                : undefined
                        }
                    >
                    {introText ? (
                        <p style={{ color: 'white', fontSize: '1rem', marginBottom: '1rem' }}>
                            {introText}
                        </p>
                    ) : null}
                    {questions.map((question, index) => {
                        const inputType = inputTypes[index];
                        const paragraphAfter =
                            paragraphAfterQuestionIndex &&
                            typeof paragraphAfterQuestionIndex === 'object' &&
                            paragraphAfterQuestionIndex[index] != null &&
                            String(paragraphAfterQuestionIndex[index]).trim() !== ''
                                ? String(paragraphAfterQuestionIndex[index])
                                : null;

                        return (
                            <Fragment key={index}>
                                <div>
                                    {inputType === 'scale' && renderScaleInput(index, question)}
                                    {inputType === 'ranking' && renderRankingInput(index, question)}
                                    {inputType === 'multi_choice' && renderMultiChoiceInput(index, question)}
                                    {inputType === 'choice' && renderChoiceInput(index, question)}
                                    {inputType === 'comment' && renderCommentInput(index, question)}
                                </div>
                                {paragraphAfter ? (
                                    <p
                                        style={{
                                            color: 'white',
                                            fontSize: '0.95rem',
                                            marginBottom: '1.25rem',
                                            marginTop: '0.25rem',
                                            lineHeight: 1.45,
                                        }}
                                    >
                                        {paragraphAfter}
                                    </p>
                                ) : null}
                            </Fragment>
                        );
                    })}
                    </div>

                    {requireGdprConsent && (
                        <div style={{ flexShrink: 0 }}>
                            <GdprConsentBlock
                                agreed={gdprAgreed}
                                onAgreedChange={setGdprAgreed}
                                scrolledToBottom={gdprScrolledToBottom}
                                onScroll={handleGdprScroll}
                                disabled={isSubmitting}
                            />
                        </div>
                    )}
                    
                    {!disableSubmission && (
                        <div
                            className="d-flex justify-content-end mt-4 pt-3"
                            style={{
                                borderTop: '1px solid #333',
                                flexShrink: gdprStickyFooter ? 0 : undefined,
                            }}
                        >
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={
                                    isSubmitting ||
                                    (requireGdprConsent && (!gdprAgreed || !gdprScrolledToBottom))
                                }
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

export default Form;
