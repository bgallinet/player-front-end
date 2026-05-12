import React from 'react';
import Form from './Form';

const LISTENING_FREQUENCY_OPTIONS = [
    'Rarely',
    'A few times per month',
    'About once a week',
    'Several times per week',
    'Daily',
    'Several hours on most days',
];

const GENRE_OPTIONS = [
    'Pop',
    'Rock',
    'Hip-hop / Rap',
    'Electronic / EDM',
    'Classical',
    'Jazz',
    'R&B / Soul',
    'Country',
    'Latin',
    'Metal',
    'Indie / Alternative',
    'Folk / Americana',
    'Other (specify in the next field)',
];

const MUSIC_CONTEXT_OPTIONS = [
    'Focus / work or study',
    'Relax / unwind',
    'Exercise / sport',
    'Commute / travel',
    'Housekeeping / chores',
    'Family time / fun with kids',
    'Parties / social gatherings',
];

const AGE_RANGE_OPTIONS = [
    'Under 18',
    '18–24',
    '25–34',
    '35–44',
    '45–54',
    '55–64',
    '65 or older',
    'Prefer not to say',
];

const QUESTIONS = [
    'How often do you listen to music?',
    'Which genres do you listen to? (select all that apply)',
    'If you chose Other for genres, or want to add detail, name genres here (optional).',
    'What do you mainly use music for? (select all that apply)',
    'Age range (optional)',
];

const INPUT_TYPES = ['choice', 'multi_choice', 'comment', 'multi_choice', 'choice'];

const CHOICE_OPTIONS = [
    LISTENING_FREQUENCY_OPTIONS,
    GENRE_OPTIONS,
    [],
    MUSIC_CONTEXT_OPTIONS,
    AGE_RANGE_OPTIONS,
];

const DEFAULT_INTRO =
    'Tell us how you listen to music. This helps us improve the experience. You can update your answers anytime from Profile.';

/**
 * Listening profile survey; persisted to `listening_profiles` via User API (not evaluation_forms).
 */
export default function UserProfileForm({ show, onHide, introText = DEFAULT_INTRO }) {
    return (
        <Form
            show={show}
            onHide={onHide}
            introText={introText}
            questions={QUESTIONS}
            inputTypes={INPUT_TYPES}
            choiceOptions={CHOICE_OPTIONS}
            optionalQuestionIndices={[2, 4]}
            scaleLabelTypes={[]}
            sessionName="user_listening_profile"
            formMetadata={{ survey_id: 'listening_profile_v1' }}
            persistListeningProfileToUserProfile
        />
    );
}
