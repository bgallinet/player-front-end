import PublicAPICall from './PublicAPICall';
import EnvironmentVariables from './EnvironmentVariables';

const AnalyticsAPI = async (requestBody, useAuth = false) => {
    const data = await PublicAPICall(requestBody, EnvironmentVariables.AnalyticsAPI_URL, useAuth);
    return data;
};

export default AnalyticsAPI;