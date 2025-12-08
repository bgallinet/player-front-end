/**
 * NoddingCalculator - Frontend implementation of head nodding detection
 * 
 * This component calculates nodding frequency and amplitude from head position data
 * without requiring Fourier transforms, using peak detection on detrended signals.
 */

const NoddingCalculator = {
    /**
     * Calculate nodding frequency and amplitude from head position data
     * @param {Array} timestamps - Array of timestamps in milliseconds
     * @param {Array} xPositions - Array of X positions
     * @param {Array} yPositions - Array of Y positions  
     * @param {Array} widthPositions - Array of width values
     * @param {Array} heightPositions - Array of height values
     * @returns {Object} - {frequency: number, amplitude: number}
     */
    calculateNodding: (timestamps, xPositions, yPositions, widthPositions, heightPositions) => {
        // Minimum frames required for analysis
        const frameThreshold = 10;
        const targetFps = 10; 
        const prominence = 0.015; // Peak detection sensitivity (balanced for detection and stability)
        const minAmplitude = 0.005; // Minimum amplitude threshold to filter noise
        
        try {
            // Convert to arrays and validate
            const ts = Array.from(timestamps);
            const x = Array.from(xPositions);
            const y = Array.from(yPositions);
            const w = Array.from(widthPositions);
            const h = Array.from(heightPositions);
            
            // Check minimum data length
            if (ts.length < frameThreshold || x.length < frameThreshold || 
                y.length < frameThreshold || w.length < frameThreshold || h.length < frameThreshold) {
                return { frequency: 0, amplitude: 0 };
            }
            
            // Check for invalid values
            if (ts.some(t => isNaN(t) || !isFinite(t)) ||
                x.some(val => isNaN(val) || !isFinite(val)) ||
                y.some(val => isNaN(val) || !isFinite(val)) ||
                w.some(val => isNaN(val) || !isFinite(val)) ||
                h.some(val => isNaN(val) || !isFinite(val))) {
                return { frequency: 0, amplitude: 0 };
            }
            
            // Normalize timestamps to start at 0 while preserving intervals
            const normalizedTs = ts.map(t => t - ts[0]);
            
            // Ensure timestamps are monotonically increasing
            let validIndices = [];
            let lastTime = -Infinity;
            for (let i = 0; i < normalizedTs.length; i++) {
                if (normalizedTs[i] >= lastTime) {
                    validIndices.push(i);
                    lastTime = normalizedTs[i];
                }
            }
            
            if (validIndices.length < frameThreshold) {
                return { frequency: 0, amplitude: 0 };
            }
            
            // Filter arrays to valid indices
            const validTs = validIndices.map(i => normalizedTs[i]);
            const validX = validIndices.map(i => x[i]);
            const validY = validIndices.map(i => y[i]);
            const validW = validIndices.map(i => w[i]);
            const validH = validIndices.map(i => h[i]);
            
            // Resample to uniform time intervals
            const timeDuration = validTs[validTs.length - 1] - validTs[0];
            if (timeDuration <= 0) {
                return { frequency: 0, amplitude: 0 };
            }
            
            const numSamples = Math.ceil(timeDuration * targetFps / 1000);
            if (numSamples < frameThreshold) {
                return { frequency: 0, amplitude: 0 };
            }
            
            const uniformTimes = [];
            for (let i = 0; i < numSamples; i++) {
                uniformTimes.push((i / (numSamples - 1)) * timeDuration);
            }
            
            // Interpolate positions to uniform sampling
            const xUniform = NoddingCalculator.interpolate(validTs, validX, uniformTimes);
            const yUniform = NoddingCalculator.interpolate(validTs, validY, uniformTimes);
            const wUniform = NoddingCalculator.interpolate(validTs, validW, uniformTimes);
            const hUniform = NoddingCalculator.interpolate(validTs, validH, uniformTimes);
            
            // Check for invalid interpolation results
            if (xUniform.some(val => isNaN(val) || !isFinite(val)) ||
                yUniform.some(val => isNaN(val) || !isFinite(val)) ||
                wUniform.some(val => isNaN(val) || !isFinite(val)) ||
                hUniform.some(val => isNaN(val) || !isFinite(val))) {
                return { frequency: 0, amplitude: 0 };
            }
            
            
            // Normalize by face size
            const meanWidth = NoddingCalculator.mean(wUniform);
            const meanHeight = NoddingCalculator.mean(hUniform);
            const faceSize = Math.sqrt(meanWidth * meanHeight);
            
            // Normalize positions by face size
            const xNormalized = xUniform.map(val => val / faceSize);
            const yNormalized = yUniform.map(val => val / faceSize);
            
            // Detrend the signals
            const xDetrended = NoddingCalculator.detrend(xNormalized);
            const yDetrended = NoddingCalculator.detrend(yNormalized);
            
            // Apply smoothing filter to reduce noise (lighter smoothing for better responsiveness)
            const ySmoothed = NoddingCalculator.smoothSignal(yDetrended, 2);
            
            // Focus on Y-axis movement for nodding
            const combinedMovement = ySmoothed;
            
            // Find peaks and troughs
            const peaks = NoddingCalculator.findPeaks(combinedMovement, 1, prominence);
            const troughs = NoddingCalculator.findPeaks(combinedMovement.map(val => -val), 1, prominence);
            
            // Calculate cycle times between consecutive peaks
            const cycleTimes = [];
            for (let i = 0; i < peaks.length - 1; i++) {
                const cycleTime = uniformTimes[peaks[i + 1]] - uniformTimes[peaks[i]];
                cycleTimes.push(cycleTime);
            }
            
            // Calculate frequency and amplitude
            let frequency = 0;
            let amplitude = 0;
            
            // Add minimum number of cycles requirement (balanced for responsiveness)
            if (cycleTimes.length < 2) { // Require at least 2 complete cycles
                return { frequency: 0, amplitude: 0 };
            }
            
            if (cycleTimes.length > 0) {
                const avgCycleTime = NoddingCalculator.mean(cycleTimes);
                frequency = avgCycleTime > 0 ? 1000 / avgCycleTime : 0; // Convert to Hz
                
                // Calculate amplitude more robustly
                const amplitudes = [];
                
                // Match each peak with the nearest trough
                for (let i = 0; i < peaks.length; i++) {
                    const peakIdx = peaks[i];
                    const peakVal = combinedMovement[peakIdx];
                    
                    // Find nearest trough before or after this peak
                    let nearestTroughIdx = -1;
                    let minDistance = Infinity;
                    
                    for (let j = 0; j < troughs.length; j++) {
                        const distance = Math.abs(troughs[j] - peakIdx);
                        if (distance < minDistance) {
                            minDistance = distance;
                            nearestTroughIdx = troughs[j];
                        }
                    }
                    
                    if (nearestTroughIdx >= 0) {
                        const troughVal = combinedMovement[nearestTroughIdx];
                        const amp = Math.abs(peakVal - troughVal);
                        amplitudes.push(amp);
                    }
                }
                
                if (amplitudes.length > 0) {
                    // Remove outliers using IQR method
                    const sortedAmps = amplitudes.slice().sort((a, b) => a - b);
                    const q1Idx = Math.floor(sortedAmps.length * 0.25);
                    const q3Idx = Math.floor(sortedAmps.length * 0.75);
                    const q1 = sortedAmps[q1Idx];
                    const q3 = sortedAmps[q3Idx];
                    const iqr = q3 - q1;
                    
                    // Filter outliers (values outside 1.5*IQR range)
                    const filteredAmps = amplitudes.filter(amp => {
                        return amp >= (q1 - 1.5 * iqr) && amp <= (q3 + 1.5 * iqr);
                    });
                    
                    // Use median instead of mean for better robustness
                    amplitude = filteredAmps.length > 0 ? NoddingCalculator.median(filteredAmps) : 0;
                    
                    // Apply minimum threshold
                    if (amplitude < minAmplitude) {
                        amplitude = 0;
                        frequency = 0; // If amplitude is too low, likely no real nodding
                    }
                }
            }
            
            return {
                frequency: Math.round(frequency * 100) / 100, // Round to 2 decimal places
                amplitude: Math.round(amplitude * 1000) / 1000 // Round to 3 decimal places
            };
            
        } catch (error) {
            return { frequency: 0, amplitude: 0 };
        }
    },
    
    /**
     * Linear interpolation helper function
     */
    interpolate: (x, y, xNew) => {
        const result = [];
        for (let i = 0; i < xNew.length; i++) {
            const targetX = xNew[i];
            
            // Find the two points to interpolate between
            let idx = 0;
            while (idx < x.length - 1 && x[idx + 1] < targetX) {
                idx++;
            }
            
            if (idx === 0) {
                // Extrapolate before first point
                const slope = (y[1] - y[0]) / (x[1] - x[0]);
                result.push(y[0] + slope * (targetX - x[0]));
            } else if (idx >= x.length - 1) {
                // Extrapolate after last point
                const slope = (y[y.length - 1] - y[y.length - 2]) / (x[x.length - 1] - x[x.length - 2]);
                result.push(y[y.length - 1] + slope * (targetX - x[x.length - 1]));
            } else {
                // Interpolate between two points
                const x1 = x[idx];
                const x2 = x[idx + 1];
                const y1 = y[idx];
                const y2 = y[idx + 1];
                const slope = (y2 - y1) / (x2 - x1);
                result.push(y1 + slope * (targetX - x1));
            }
        }
        return result;
    },
    
    /**
     * Calculate mean of array
     */
    mean: (arr) => {
        return arr.reduce((sum, val) => sum + val, 0) / arr.length;
    },
    
    /**
     * Calculate median of array
     */
    median: (arr) => {
        if (arr.length === 0) return 0;
        const sorted = arr.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    },
    
    /**
     * Apply simple moving average filter for smoothing
     */
    smoothSignal: (signal, windowSize) => {
        if (windowSize < 1 || windowSize > signal.length) {
            return signal;
        }
        
        const smoothed = [];
        const halfWindow = Math.floor(windowSize / 2);
        
        for (let i = 0; i < signal.length; i++) {
            let sum = 0;
            let count = 0;
            
            for (let j = Math.max(0, i - halfWindow); j <= Math.min(signal.length - 1, i + halfWindow); j++) {
                sum += signal[j];
                count++;
            }
            
            smoothed.push(sum / count);
        }
        
        return smoothed;
    },
    
    /**
     * Detrend signal by removing linear trend
     */
    detrend: (signal) => {
        const n = signal.length;
        const x = Array.from({length: n}, (_, i) => i);
        
        // Calculate linear regression
        const sumX = x.reduce((sum, val) => sum + val, 0);
        const sumY = signal.reduce((sum, val) => sum + val, 0);
        const sumXY = x.reduce((sum, val, i) => sum + val * signal[i], 0);
        const sumXX = x.reduce((sum, val) => sum + val * val, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Remove trend
        return signal.map((val, i) => val - (slope * i + intercept));
    },
    
    /**
     * Find peaks in signal
     */
    findPeaks: (signal, minDistance, prominence) => {
        const peaks = [];
        
        for (let i = 1; i < signal.length - 1; i++) {
            const current = signal[i];
            const prev = signal[i - 1];
            const next = signal[i + 1];
            
            // Check if it's a local maximum
            if (current > prev && current > next) {
                // Check minimum distance from previous peaks
                let validPeak = true;
                for (let j = 0; j < peaks.length; j++) {
                    if (Math.abs(i - peaks[j]) < minDistance) {
                        // If this peak is higher, replace the previous one
                        if (current > signal[peaks[j]]) {
                            peaks[j] = i;
                        }
                        validPeak = false;
                        break;
                    }
                }
                
                if (validPeak) {
                    // Check prominence
                    let leftMin = current;
                    let rightMin = current;
                    
                    // Find minimum to the left
                    for (let j = i - 1; j >= 0; j--) {
                        if (signal[j] < leftMin) {
                            leftMin = signal[j];
                        }
                    }
                    
                    // Find minimum to the right
                    for (let j = i + 1; j < signal.length; j++) {
                        if (signal[j] < rightMin) {
                            rightMin = signal[j];
                        }
                    }
                    
                    const peakProminence = Math.min(current - leftMin, current - rightMin);
                    
                    if (peakProminence >= prominence) {
                        peaks.push(i);
                    }
                }
            }
        }
        
        return peaks.sort((a, b) => a - b);
    }
};

export default NoddingCalculator;
