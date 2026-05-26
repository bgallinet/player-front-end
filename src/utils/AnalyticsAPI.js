import PublicAPICall from './PublicAPICall';
import EnvironmentVariables from '../EnvironmentVariables';
import { enrichAnalyticsRequestBody } from './clientEnvironment';
import { mergeActiveExperimentIntoAnalyticsRequestBody } from './experimentSession';

const AnalyticsAPI = async (requestBody, useAuth = false) => {
    const withExperiment =
        typeof requestBody === 'string'
            ? mergeActiveExperimentIntoAnalyticsRequestBody(requestBody)
            : requestBody;
    const enriched =
        typeof withExperiment === 'string' ? enrichAnalyticsRequestBody(withExperiment) : withExperiment;
    const data = await PublicAPICall(enriched, EnvironmentVariables.AnalyticsAPI_URL, useAuth);
    return data;
};

export default AnalyticsAPI;
