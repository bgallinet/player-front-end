/**
 * Reverb Audio Effect Implementation
 * 
 * Creates and manages audio nodes for reverb processing
 */

export const createReverbProcessor = (audioContext) => {
    
    const input = audioContext.createGain();
    const output = audioContext.createGain();
    const convolver = audioContext.createConvolver();
    const dryGain = audioContext.createGain();
    const wetGain = audioContext.createGain();
    const masterGain = audioContext.createGain();

    // Generate impulse response for reverb
    const generateImpulseResponse = (roomSize, damping) => {
        const sampleRate = audioContext.sampleRate;
        const length = Math.floor(sampleRate * Math.max(roomSize * 0.01 * 1.5, 0.3));
        const impulse = audioContext.createBuffer(2, length, sampleRate);
        
        const leftChannel = impulse.getChannelData(0);
        const rightChannel = impulse.getChannelData(1);
        
        leftChannel[0] = 1.0;
        rightChannel[0] = 0.8;
        
        for (let i = 1; i < length; i++) {
            const time = i / sampleRate;
            const decay = Math.pow(1 - damping * 0.01, time * 2);
            const filteredNoise = (Math.random() * 2 - 1) * 0.3 * decay;
            const envelope = Math.exp(-time * 3) * decay;
            const structuredNoise = filteredNoise * envelope;
            
            leftChannel[i] = structuredNoise;
            rightChannel[i] = structuredNoise * 0.85;
        }
        
        return impulse;
    };

    const impulseResponse = generateImpulseResponse(50, 30);
    convolver.buffer = impulseResponse;

    dryGain.gain.value = 1.0;
    wetGain.gain.value = 0.0;
    masterGain.gain.value = 1.0;

    input.connect(dryGain);
    input.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(masterGain);
    wetGain.connect(masterGain);
    masterGain.connect(output);

    const reverbEffect = {
        input: input,
        output: output,
        convolver: convolver,
        dryGain: dryGain,
        wetGain: wetGain,
        masterGain: masterGain,
        generateImpulseResponse,
        updateParameters: (amount, roomSize = 50, damping = 30) => {
            const normalizedAmount = amount / 100;
            dryGain.gain.value = 1.0 - normalizedAmount;
            wetGain.gain.value = normalizedAmount * 0.8;
            
            const impulseResponse = generateImpulseResponse(roomSize, damping);
            convolver.buffer = impulseResponse;
            
            const totalSignal = Math.sqrt((1.0 - normalizedAmount) ** 2 + (normalizedAmount * 0.8) ** 2);
            masterGain.gain.value = 1.0 / Math.max(totalSignal, 0.1);
        },
        cleanup: () => {
            try {
                input.disconnect();
                output.disconnect();
                dryGain.disconnect();
                wetGain.disconnect();
                masterGain.disconnect();
                if (convolver.buffer) {
                    convolver.disconnect();
                }
            } catch (error) {
                // Silent cleanup error handling
            }
        }
    };

    return reverbEffect;
};

export const processReverb = (processor, effectValue) => {
    if (processor.updateParameters) {
        processor.updateParameters(effectValue);
    }
};

export const resetReverb = (processor) => {
    if (processor.updateParameters) {
        processor.updateParameters(0);
    }
};
