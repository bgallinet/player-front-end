import PublicAPICall from '../utils/PublicAPICall';
import EnvironmentVariables from '../utils/EnvironmentVariables';

const InfoAPI = async (requestBody, useAuth = false) => {
    const data = await PublicAPICall(requestBody, EnvironmentVariables.InfoAPI_URL, useAuth);
    return data;
};

export default InfoAPI;