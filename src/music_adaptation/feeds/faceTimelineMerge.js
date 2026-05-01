/**
 * In-memory rolling face timeline (same field layout as the former localStorage blob).
 * Drives emotion rows for `ReactionSensingFeedSnapshot.emotionDataArray`.
 */

import { DATA_COLLECTION_WINDOW } from '../../hooks/ReactionMapperConfig';

/**
 * @param {object|null|undefined} existingData
 * @param {{
 *   tempLandmarks: unknown[],
 *   tempTimestamps: number[],
 *   tempConfidences: number[],
 *   tempCenterX: number[],
 *   tempCenterY: number[],
 *   tempWidths: number[],
 *   tempHeights: number[],
 *   tempFrequencies: number[],
 *   tempAmplitudes: number[],
 *   tempSmiling: number[],
 *   tempJawOpen: number[],
 * }} batch
 * @param {{ frequency: number, amplitude: number }} latestNodding
 * @param {number} nowEpochMs
 * @param {number} [bufferWindowMs]
 * @returns {object}
 */
export function mergeFaceTimelineWindow(
    existingData,
    batch,
    latestNodding,
    nowEpochMs,
    bufferWindowMs = DATA_COLLECTION_WINDOW,
) {
    const {
        tempLandmarks,
        tempTimestamps,
        tempConfidences,
        tempCenterX,
        tempCenterY,
        tempWidths,
        tempHeights,
        tempFrequencies,
        tempAmplitudes,
        tempSmiling,
        tempJawOpen,
    } = batch;

    const facePositionDataArrays = {
        frequencyArray: tempFrequencies,
        amplitudeArray: tempAmplitudes,
        smilingArray: tempSmiling,
        jawOpenArray: tempJawOpen,
        landmarks: tempLandmarks,
        timestamps: tempTimestamps,
        confidences: tempConfidences,
        centerXPositions: tempCenterX,
        centerYPositions: tempCenterY,
        widthPositions: tempWidths,
        heightPositions: tempHeights,
        lastUpdated: nowEpochMs,
        landmarkCount:
            tempLandmarks.length > 0 && Array.isArray(tempLandmarks[tempLandmarks.length - 1])
                ? tempLandmarks[tempLandmarks.length - 1].length
                : 0,
        faceConfidence:
            tempConfidences.length > 0 ? tempConfidences[tempConfidences.length - 1] : 0,
        noddingFrequency: latestNodding.frequency,
        noddingAmplitude: latestNodding.amplitude,
        smilingIntensity: tempSmiling.length > 0 ? tempSmiling[tempSmiling.length - 1] : 0,
        jawOpenIntensity: tempJawOpen.length > 0 ? tempJawOpen[tempJawOpen.length - 1] : 0,
    };

    if (existingData && existingData.timestamps) {
        const recentExistingData = existingData.timestamps
            .map((timestamp, index) => ({ timestamp, index }))
            .filter((item) => nowEpochMs - item.timestamp <= bufferWindowMs)
            .map((item) => item.index);
        facePositionDataArrays.frequencyArray = [
            ...recentExistingData.map((i) => existingData.frequencyArray[i]).filter((v) => v !== undefined),
            ...tempFrequencies,
        ];
        facePositionDataArrays.amplitudeArray = [
            ...recentExistingData.map((i) => existingData.amplitudeArray[i]).filter((v) => v !== undefined),
            ...tempAmplitudes,
        ];
        facePositionDataArrays.smilingArray = [
            ...recentExistingData.map((i) => existingData.smilingArray[i]).filter((v) => v !== undefined),
            ...tempSmiling,
        ];
        facePositionDataArrays.jawOpenArray = [
            ...recentExistingData.map((i) => existingData.jawOpenArray[i]).filter((v) => v !== undefined),
            ...tempJawOpen,
        ];
        facePositionDataArrays.timestamps = [
            ...recentExistingData.map((i) => existingData.timestamps[i]).filter((v) => v !== undefined),
            ...tempTimestamps,
        ];
        facePositionDataArrays.centerXPositions = [
            ...recentExistingData.map((i) => existingData.centerXPositions[i]).filter((v) => v !== undefined),
            ...tempCenterX,
        ];
        facePositionDataArrays.centerYPositions = [
            ...recentExistingData.map((i) => existingData.centerYPositions[i]).filter((v) => v !== undefined),
            ...tempCenterY,
        ];
        facePositionDataArrays.widthPositions = [
            ...recentExistingData.map((i) => existingData.widthPositions[i]).filter((v) => v !== undefined),
            ...tempWidths,
        ];
        facePositionDataArrays.heightPositions = [
            ...recentExistingData.map((i) => existingData.heightPositions[i]).filter((v) => v !== undefined),
            ...tempHeights,
        ];
        facePositionDataArrays.landmarks = [
            ...recentExistingData.map((i) => existingData.landmarks?.[i]).filter((v) => v !== undefined),
            ...tempLandmarks,
        ];
        facePositionDataArrays.confidences = [
            ...recentExistingData.map((i) => existingData.confidences?.[i]).filter((v) => v !== undefined),
            ...tempConfidences,
        ];
    }

    const lm = facePositionDataArrays.landmarks;
    const cf = facePositionDataArrays.confidences;
    const sm = facePositionDataArrays.smilingArray;
    const jw = facePositionDataArrays.jawOpenArray;
    facePositionDataArrays.landmarkCount =
        lm.length > 0 && Array.isArray(lm[lm.length - 1]) ? lm[lm.length - 1].length : 0;
    facePositionDataArrays.faceConfidence = cf.length > 0 ? cf[cf.length - 1] : 0;
    facePositionDataArrays.smilingIntensity = sm.length > 0 ? sm[sm.length - 1] : 0;
    facePositionDataArrays.jawOpenIntensity = jw.length > 0 ? jw[jw.length - 1] : 0;

    return facePositionDataArrays;
}

/**
 * @param {object|null|undefined} parsedArrays merged face blob from {@link mergeFaceTimelineWindow}
 * @returns {import('../adapters/visionCueAdapter').EmotionDatapoint[]}
 */
export function emotionDataPointsFromFaceBlob(parsedArrays) {
    if (!parsedArrays?.timestamps?.length) return [];
    const latestAmplitude = parsedArrays.noddingAmplitude ?? 0;
    const latestFrequency = parsedArrays.noddingFrequency ?? 0;
    return parsedArrays.timestamps.map((timestamp, index) => ({
        timestamp,
        smiling: parsedArrays.smilingArray ? parsedArrays.smilingArray[index] : 0,
        jawOpen: parsedArrays.jawOpenArray ? parsedArrays.jawOpenArray[index] : 0,
        frequency: parsedArrays.frequencyArray ? parsedArrays.frequencyArray[index] : latestFrequency,
        amplitude: parsedArrays.amplitudeArray ? parsedArrays.amplitudeArray[index] : latestAmplitude,
        xPosition: parsedArrays.centerXPositions[index],
        yPosition: parsedArrays.centerYPositions[index],
        width: parsedArrays.widthPositions[index],
        height: parsedArrays.heightPositions[index],
    }));
}
