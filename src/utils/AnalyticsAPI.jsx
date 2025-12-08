import PublicAPICall from './PublicAPICall';
import EnvironmentVariables from './EnvironmentVariables';

const AnalyticsAPI = async (requestBody, useAuth = false) => {
    console.log('AnalyticsAPI body:', requestBody);
    const data = await PublicAPICall(requestBody, EnvironmentVariables.AnalyticsAPI_URL, useAuth);
    console.log('AnalyticsAPI data:', data);
    return data;
};

export default AnalyticsAPI;