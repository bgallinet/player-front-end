import { enrichAnalyticsRequestBody } from './clientEnvironment';
import { mergeActiveExperimentIntoAnalyticsRequestBody } from './experimentSession';

const APICall = async (requestBody, url) => {
    const idToken = localStorage.getItem('idToken');
    if (!idToken) {
        console.log('No token found');
        return null;
    }
    
    
    try {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        };
        
        
        const bodyToSend =
            typeof requestBody === 'string'
                ? enrichAnalyticsRequestBody(
                      mergeActiveExperimentIntoAnalyticsRequestBody(requestBody)
                  )
                : requestBody;

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: bodyToSend
        });
        
        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            return {
                body: JSON.stringify({
                    status: 'error',
                    message: `HTTP error: ${response.status}`,
                    statusCode: response.status
                })
            };
        }
        
        const data = await response.json();
        return {
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('Error calling API ' + url + ':', error);
        return {
            body: JSON.stringify({
                error: error.message,
                statusCode: 500
            })
        };
    }
};

export default APICall;