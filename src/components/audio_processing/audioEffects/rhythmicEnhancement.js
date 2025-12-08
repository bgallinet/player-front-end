/**
 * Rhythmic Enhancement Audio Effect Implementation
 * 
 * Creates and manages audio nodes for rhythmic enhancement processing
 */

export const createRhythmicEnhancementProcessor = (audioContext) => {
    
    const enhancer = {
        gainNode: audioContext.createGain(),
        highPassFilter: audioContext.createBiquadFilter(),
        lowPassFilter: audioContext.createBiquadFilter(),
        analyser: audioContext.createAnalyser(),
        context: audioContext
    };
    
    // Configure the rhythmic enhancer nodes
    enhancer.highPassFilter.type = 'highpass';
    enhancer.highPassFilter.frequency.value = 100;
    enhancer.highPassFilter.Q.value = 0.5;
    
    enhancer.lowPassFilter.type = 'lowpass';
    enhancer.lowPassFilter.frequency.value = 8000;
    enhancer.lowPassFilter.Q.value = 0.5;
    
    enhancer.analyser.fftSize = 256;
    enhancer.analyser.smoothingTimeConstant = 0.3;
    
    enhancer.gainNode.gain.value = 1.0;
    
    // Connect the internal chain: highPass -> lowPass -> analyser -> gain
    enhancer.highPassFilter.connect(enhancer.lowPassFilter);
    enhancer.lowPassFilter.connect(enhancer.analyser);
    enhancer.analyser.connect(enhancer.gainNode);
    
    // The gainNode is the output node for the rhythmic enhancer
    enhancer.input = enhancer.highPassFilter;
    enhancer.output = enhancer.gainNode;
    
    return enhancer;
};

export const processRhythmicEnhancement = (processor, effectValue) => {
    const gainNode = processor.gainNode;
    const enhancementFactor = 1.0 + (effectValue / 100) * 0.8;
    
    gainNode.gain.value = enhancementFactor;
    
    if (processor.highPassFilter) {
        const highPassFreq = 100 + (effectValue / 100) * 200;
        processor.highPassFilter.frequency.value = highPassFreq;
    }
    
    if (processor.lowPassFilter) {
        const lowPassFreq = 8000 + (effectValue / 100) * 4000;
        processor.lowPassFilter.frequency.value = lowPassFreq;
    }
};

export const resetRhythmicEnhancement = (processor) => {
    processor.gainNode.gain.value = 1.0;
    
    if (processor.highPassFilter) {
        processor.highPassFilter.frequency.value = 100;
    }
    if (processor.lowPassFilter) {
        processor.lowPassFilter.frequency.value = 8000;
    }
};
