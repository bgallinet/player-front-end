import UserAPI from '../../utils/UserAPI';
import InfoAPI from '../../utils/InfoAPI';
import { getSessionNameFromUrl, createAuthenticatedRequestBody } from '../../hooks/sessionUtils';

/**
 * Upload detection data to backend API
 * Common logic for emotion, landmark, and pose data uploads
 * 
 * @param {Object} params - Upload parameters
 * @param {Array} params.dataArray - Array of detection data
 * @param {Array} params.timestampArray - Array of timestamps
 * @param {Array} params.confidenceArray - Array of confidence values (optional)
 * @param {string} params.dataType - Type of data ('emotion', 'landmark', 'pose')
 * @param {boolean} params.is_demo_session - Whether it's a demo session
 * @param {string} params.sessionName - Session name
 * @param {Object} params.additionalData - Additional data to include in request (optional)
 * 
 * @returns {Promise<Object>} - Parsed response object
 */
export const uploadDetectionData = async ({
    dataArray,
    timestampArray,
    confidenceArray = null,
    dataType, // 'landmark', 'pose'
    is_demo_session,
    sessionName,
    demo_username = null, // Demo username for demo sessions
    additionalData = {}
}) => {
    // Map data type to request keys
    const dataTypeMap = {
        'landmark': {
            arrayKey: 'landmark_array',
            requestType: 'info',
            infoType: 'local_detection'
        },
        'pose': {
            arrayKey: 'pose_array',
            requestType: 'info',
            infoType: 'local_detection'
        }
    };

    const config = dataTypeMap[dataType];
    if (!config) {
        throw new Error(`Unknown data type: ${dataType}`);
    }

    // Build request body
    const requestData = {
        [config.arrayKey]: dataArray,
        'timestamp_array': timestampArray,
        ...additionalData
    };

    // Add confidence array if provided
    if (confidenceArray) {
        requestData['confidence_array'] = confidenceArray;
    }

    let result = null;

    // Send data based on session type
    if (is_demo_session) {
        // Create request body directly (no double stringify/parse)
        const requestBody = createAuthenticatedRequestBody({
            "request_type": config.requestType,
            "info_type": config.infoType,
            "user_name": demo_username, // Pass demo username for backend
            ...requestData
        }, true, false); // Don't auto-add session_name, add it manually
        
        // Manually set the session name
        requestBody.session_name = sessionName || getSessionNameFromUrl();
        
        const bodyData = JSON.stringify(requestBody);
        const data = await InfoAPI(bodyData, false);
        
        if (data && data.body) {
            let responseData;
            if (typeof data.body === 'string') {
                responseData = JSON.parse(data.body);
            } else {
                responseData = data.body;
            }
            
            if (responseData.body && typeof responseData.body === 'string') {
                result = JSON.parse(responseData.body);
            } else {
                result = responseData.body;
            }
        }
    } else {
        // Create request body directly (no double stringify/parse)
        const requestBody = createAuthenticatedRequestBody({
            "request_type": "user",
            "user_request_type": "local_detection",
            ...requestData
        }, false, false); // Don't auto-add session_name, add it manually
        
        // Manually set the session name
        requestBody.session_name = sessionName || getSessionNameFromUrl();
        
        const bodyData = JSON.stringify(requestBody);
        
        const data = await UserAPI(bodyData);
        
        if (data && data.body) {
            let responseData;
            if (typeof data.body === 'string') {
                responseData = JSON.parse(data.body);
            } else {
                responseData = data.body;
            }
            
            if (responseData.body && typeof responseData.body === 'string') {
                result = JSON.parse(responseData.body);
            } else {
                result = responseData.body;
            }
        }
    }

    return result;
};

/**
 * Safely clear arrays and ensure they're empty
 * @param {Array} arrays - Arrays to clear
 */
export const clearArrays = (...arrays) => {
    arrays.forEach(array => {
        array.length = 0;
    });
};

/**
 * Check if arrays should be uploaded based on time threshold or sample count
 * @param {Array} timestampArray - Array of timestamps
 * @param {number} timeThreshold - Time threshold in ms (e.g., 800, 1000)
 * @returns {boolean} - True if should upload
 */
export const shouldUpload = (timestampArray, timeThreshold) => {
    if (!timestampArray || timestampArray.length === 0) {
        return false;
    }
    
    const timeSpan = Math.max(...timestampArray) - Math.min(...timestampArray);
    return timeSpan > timeThreshold;
};

