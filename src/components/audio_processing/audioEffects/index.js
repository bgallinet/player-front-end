/**
 * Audio Effects Registry
 * 
 * Central registry for all available audio effects
 */

import { 
    createRhythmicEnhancementProcessor, 
    processRhythmicEnhancement, 
    resetRhythmicEnhancement 
} from './rhythmicEnhancement';

import { 
    createReverbProcessor, 
    processReverb, 
    resetReverb 
} from './reverb';

import { 
    createProcessor as createDelayProcessor, 
    process as processDelay, 
    reset as resetDelay 
} from './delay';

export {
    createKeyShiftProcessor,
    processKeyShift,
    resetKeyShift,
    clampKeyShiftSemitones,
    KEY_SHIFT_SEMITONE_MIN,
    KEY_SHIFT_SEMITONE_MAX,
} from './keyShift';

export {
    applyBpmShift,
    resetBpmShift,
    clampBpmShiftPercent,
    BPM_SHIFT_PERCENT_MIN,
    BPM_SHIFT_PERCENT_MAX,
} from './bpmShift';

export {
    applyBpmKeyShift,
    resetBpmKeyShift,
    clampBpmKeyShiftPercent,
    BPM_KEY_SHIFT_PERCENT_MIN,
    BPM_KEY_SHIFT_PERCENT_MAX,
} from './bpmKeyShift';

export const AUDIO_EFFECTS = {
    rhythmicEnhancement: {
        createProcessor: createRhythmicEnhancementProcessor,
        process: processRhythmicEnhancement,
        reset: resetRhythmicEnhancement,
        displayLabel: 'Rhythmic Enhancement',
        displaySuffix: '%'
    },
    reverb: {
        createProcessor: createReverbProcessor,
        process: processReverb,
        reset: resetReverb,
        displayLabel: 'Reverb',
        displaySuffix: ''
    },
    delay: {
        createProcessor: createDelayProcessor,
        process: processDelay,
        reset: resetDelay,
        displayLabel: 'Delay',
        displaySuffix: ''
    }
};
