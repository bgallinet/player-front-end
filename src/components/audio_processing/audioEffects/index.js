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
