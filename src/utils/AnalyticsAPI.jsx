import PublicAPICall from './PublicAPICall';
import EnvironmentVariables from './EnvironmentVariables';
import { enrichAnalyticsRequestBody } from './clientEnvironment';

const AnalyticsAPI = async (requestBody, useAuth = false) => {
    const enriched =
        typeof requestBody === 'string' ? enrichAnalyticsRequestBody(requestBody) : requestBody;
    const data = await PublicAPICall(enriched, EnvironmentVariables.AnalyticsAPI_URL, useAuth);
    return data;
};

export default AnalyticsAPI;