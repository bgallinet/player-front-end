/**
 * Delay Audio Effect Module
 * 
 * Implements a delay effect using Web Audio API with tempo-sync capabilities
 * and feedback control for DJ-style delay throws.
 */

/**
 * Create delay processor with tempo-sync capabilities
 * @param {AudioContext} audioContext - Web Audio API context
 * @returns {Object} Delay processor with input/output nodes
 */
export const createProcessor = (audioContext) => {
    if (!audioContext) {
        return null;
    }

    try {
        // Create delay node with maximum delay time (2 seconds)
        const delayNode = audioContext.createDelay(2.0);
        
        // Create gain node for feedback control
        const feedbackGain = audioContext.createGain();
        feedbackGain.gain.value = 0;
        
        // Create gain node for wet/dry mix
        const wetGain = audioContext.createGain();
        wetGain.gain.value = 0;
        
        // Create gain node for dry signal
        const dryGain = audioContext.createGain();
        dryGain.gain.value = 1;
        
        // Create filter for delay feedback (high-pass to prevent low-end buildup)
        const feedbackFilter = audioContext.createBiquadFilter();
        feedbackFilter.type = 'highpass';
        feedbackFilter.frequency.value = 80;
        feedbackFilter.Q.value = 0.5;

        // Connect the delay chain
        // Input -> dry gain -> output
        // Input -> delay -> feedback filter -> feedback gain -> delay (feedback loop)
        // Input -> delay -> wet gain -> output
        // Output gain -> final output
        
        // Create input and output gain nodes for the effect
        const inputGain = audioContext.createGain();
        const outputGain = audioContext.createGain();
        
        // Connect the audio graph
        // Input -> both dry and wet paths
        inputGain.connect(dryGain);
        inputGain.connect(delayNode);
        
        // Dry path: input -> dry gain -> output
        dryGain.connect(outputGain);
        
        // Wet path: input -> delay -> wet gain -> output
        delayNode.connect(wetGain);
        wetGain.connect(outputGain);
        
        // Feedback path: delay -> filter -> feedback gain -> delay
        delayNode.connect(feedbackFilter);
        feedbackFilter.connect(feedbackGain);
        feedbackGain.connect(delayNode);
        
        // Store connections for cleanup
        const connections = {
            input: inputGain,
            output: outputGain,
            delayNode,
            feedbackGain,
            wetGain,
            dryGain,
            outputGain,
            feedbackFilter,
            inputGain
        };

        // Set default values
        delayNode.delayTime.value = 0.125; // Eighth note (more noticeable)
        
    return connections;
    } catch (error) {
        return null;
    }
};

/**
 * Process delay effect with tempo-sync and feedback control
 * @param {Object} delayProcessor - Delay processor object
 * @param {number} effectValue - Effect intensity (0-100)
 */
export const process = (delayProcessor, effectValue) => {
    if (!delayProcessor || typeof effectValue !== 'number') return;

    try {
        const { delayNode, feedbackGain, wetGain, dryGain } = delayProcessor;
        
        // Normalize effect value (0-100 to 0-1)
        const normalizedValue = Math.max(0, Math.min(1, effectValue / 100));
        
        // Calculate wet/dry mix based on effect intensity
        // More aggressive wet signal for audible effect
        const wetLevel = normalizedValue * 0.8; // Stronger wet signal
        const dryLevel = 1 - (normalizedValue * 0.2); // Keep more dry signal
        
        // Set feedback level (more feedback = more repeats)
        // Higher feedback for more noticeable repeats
        const feedbackLevel = normalizedValue * 0.6;
        
        // Apply parameter changes with smoothing
        const currentTime = delayNode.context.currentTime;
        const smoothingTime = 0.1; // 100ms smoothing
        
        wetGain.gain.linearRampToValueAtTime(wetLevel, currentTime + smoothingTime);
        dryGain.gain.linearRampToValueAtTime(dryLevel, currentTime + smoothingTime);
        feedbackGain.gain.linearRampToValueAtTime(feedbackLevel, currentTime + smoothingTime);
        
        // Adjust delay time based on effect intensity
        // Shorter delay time for more noticeable effect
        const baseDelayTime = 0.125; // Eighth note (more noticeable)
        const delayTime = baseDelayTime + (normalizedValue * 0.05);
        delayNode.delayTime.linearRampToValueAtTime(delayTime, currentTime + smoothingTime);
        
    } catch (error) {
        console.error('Error processing delay effect:', error);
    }
};

/**
 * Reset delay effect to default state
 * @param {Object} delayProcessor - Delay processor object
 */
export const reset = (delayProcessor) => {
    if (!delayProcessor) return;

    try {
        const { delayNode, feedbackGain, wetGain, dryGain, outputGain } = delayProcessor;
        const currentTime = delayNode.context.currentTime;
        const smoothingTime = 0.1;
        
        // Reset all gains to default values
        wetGain.gain.linearRampToValueAtTime(0, currentTime + smoothingTime);
        dryGain.gain.linearRampToValueAtTime(1, currentTime + smoothingTime);
        feedbackGain.gain.linearRampToValueAtTime(0, currentTime + smoothingTime);
        outputGain.gain.linearRampToValueAtTime(1, currentTime + smoothingTime);
        
        // Reset delay time to default
        delayNode.delayTime.linearRampToValueAtTime(0.125, currentTime + smoothingTime);
        
    } catch (error) {
        // Error resetting delay effect
    }
};

// Display configuration
export const displayLabel = 'Delay';
export const displaySuffix = '';
