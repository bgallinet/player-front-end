/**
 * HandRaiseCalculator - Frontend implementation of hand raising detection
 * 
 * This component calculates hand raising frequency and amplitude from wrist position data
 * relative to shoulder position, using peak detection on detrended signals.
 */

const HandRaiseCalculator = {
    /**
     * Calculate hand raising frequency and amplitude from wrist/shoulder position data
     * @param {Array} timestamps - Array of timestamps in milliseconds
     * @param {Array} wristYPositions - Array of wrist Y positions (normalized 0-1, lower = higher on screen)
     * @param {Array} shoulderYPositions - Array of shoulder Y positions (normalized 0-1)
     * @param {boolean} previousIsRaised - Previous raised state for hysteresis (default false)
     * @returns {Object} - {frequency: number, amplitude: number, isRaised: boolean}
     */
    calculateHandRaise: (timestamps, wristYPositions, shoulderYPositions, previousIsRaised = false) => {
        // Minimum frames required for analysis
        const frameThreshold = 10;
        const targetFps = 10;
        const prominence = 0.01; // Peak detection sensitivity for hand raising
        const minAmplitude = 0.01; // Minimum amplitude threshold to filter noise
        const raiseThreshold = 0.03; // Threshold for considering hand "raised" (wrist significantly above shoulder) - lowered for better detection
        const lowerThreshold = 0.01; // Threshold for considering hand "lowered" (hysteresis to prevent flickering)
        
        try {
            // Convert to arrays and validate
            const ts = Array.from(timestamps);
            const wristY = Array.from(wristYPositions);
            const shoulderY = Array.from(shoulderYPositions);
            
            // Check minimum data length
            if (ts.length < frameThreshold || wristY.length < frameThreshold || 
                shoulderY.length < frameThreshold) {
                return { frequency: 0, amplitude: 0, isRaised: false };
            }
            
            // Check for invalid values
            if (ts.some(t => isNaN(t) || !isFinite(t)) ||
                wristY.some(val => isNaN(val) || !isFinite(val)) ||
                shoulderY.some(val => isNaN(val) || !isFinite(val))) {
                return { frequency: 0, amplitude: 0, isRaised: false };
            }
            
            // Calculate relative wrist position (shoulder Y - wrist Y)
            // Positive values mean wrist is above shoulder (raised)
            // Negative values mean wrist is below shoulder (lowered)
            const relativePositions = wristY.map((w, i) => {
                const s = shoulderY[i];
                return s - w; // Positive when wrist is above shoulder (raised)
            });
            
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
                return { frequency: 0, amplitude: 0, isRaised: false };
            }
            
            // Filter arrays to valid indices
            const validTs = validIndices.map(i => normalizedTs[i]);
            const validRelative = validIndices.map(i => relativePositions[i]);
            
            // Resample to uniform time intervals
            const timeDuration = validTs[validTs.length - 1] - validTs[0];
            if (timeDuration <= 0) {
                return { frequency: 0, amplitude: 0, isRaised: false };
            }
            
            const numSamples = Math.ceil(timeDuration * targetFps / 1000);
            if (numSamples < frameThreshold) {
                return { frequency: 0, amplitude: 0, isRaised: false };
            }
            
            const uniformTimes = [];
            for (let i = 0; i < numSamples; i++) {
                uniformTimes.push((i / (numSamples - 1)) * timeDuration);
            }
            
            // Interpolate positions to uniform sampling
            const relativeUniform = HandRaiseCalculator.interpolate(validTs, validRelative, uniformTimes);
            
            // Check for invalid interpolation results
            if (relativeUniform.some(val => isNaN(val) || !isFinite(val))) {
                return { frequency: 0, amplitude: 0, isRaised: false };
            }
            
            // Check if hand is currently raised (using actual relative positions, before detrending)
            // Use recent samples to determine current state with hysteresis to prevent flickering
            const recentRelative = relativeUniform.slice(-10); // Last 10 samples (more stable)
            const avgRecentRelative = HandRaiseCalculator.mean(recentRelative);
            const mostRecentRelative = recentRelative[recentRelative.length - 1]; // Most recent value
            
            // Check if most recent samples are above threshold (persistent raised state)
            const recentAboveThreshold = recentRelative.filter(val => val > raiseThreshold).length;
            const recentBelowLowerThreshold = recentRelative.filter(val => val < lowerThreshold).length;
            
            // Hysteresis: if previously raised, require more evidence to lower; if previously lowered, require less to raise
            let isRaised;
            if (previousIsRaised) {
                // Once raised, stay raised until clearly below lower threshold
                isRaised = recentBelowLowerThreshold < 8; // Need at least 8 out of 10 samples below threshold to lower
            } else {
                // Not raised, need clear evidence to raise
                isRaised = recentAboveThreshold >= 7; // At least 7 out of 10 samples above threshold to raise
            }
            
            // Detrend the signal for frequency/amplitude calculation
            const relativeDetrended = HandRaiseCalculator.detrend(relativeUniform);
            
            // Apply smoothing filter to reduce noise
            const relativeSmoothed = HandRaiseCalculator.smoothSignal(relativeDetrended, 2);
            
            // Find peaks (hand going up) and troughs (hand going down)
            const peaks = HandRaiseCalculator.findPeaks(relativeSmoothed, 1, prominence);
            const troughs = HandRaiseCalculator.findPeaks(relativeSmoothed.map(val => -val), 1, prominence);
            
            // Calculate cycle times between consecutive peaks
            const cycleTimes = [];
            for (let i = 0; i < peaks.length - 1; i++) {
                const cycleTime = uniformTimes[peaks[i + 1]] - uniformTimes[peaks[i]];
                cycleTimes.push(cycleTime);
            }
            
            // Calculate frequency and amplitude
            let frequency = 0;
            let amplitude = 0;
            
            // Add minimum number of cycles requirement for frequency/amplitude calculation
            // But still return isRaised even if cycles are insufficient
            if (cycleTimes.length < 2) {
                return { frequency: 0, amplitude: 0, isRaised };
            }
            
            if (cycleTimes.length > 0) {
                const avgCycleTime = HandRaiseCalculator.mean(cycleTimes);
                frequency = avgCycleTime > 0 ? 1000 / avgCycleTime : 0; // Convert to Hz
                
                // Calculate amplitude more robustly
                const amplitudes = [];
                
                // Match each peak with the nearest trough
                for (let i = 0; i < peaks.length; i++) {
                    const peakIdx = peaks[i];
                    const peakVal = relativeSmoothed[peakIdx];
                    
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
                        const troughVal = relativeSmoothed[nearestTroughIdx];
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
                    amplitude = filteredAmps.length > 0 ? HandRaiseCalculator.median(filteredAmps) : 0;
                    
                    // Apply minimum threshold
                    if (amplitude < minAmplitude) {
                        amplitude = 0;
                        frequency = 0; // If amplitude is too low, likely no real movement
                    }
                }
            }
            
            return {
                frequency: Math.round(frequency * 100) / 100, // Round to 2 decimal places
                amplitude: Math.round(amplitude * 1000) / 1000, // Round to 3 decimal places
                isRaised
            };
            
        } catch (error) {
            return { frequency: 0, amplitude: 0, isRaised: false };
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

export default HandRaiseCalculator;

