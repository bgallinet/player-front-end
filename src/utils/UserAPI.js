import APICall from './APICall';
import EnvironmentVariables from '../EnvironmentVariables';

const UserAPI = async (requestBody) => {
    const data = await APICall(requestBody, EnvironmentVariables.UserAPI_URL);
    return data;
};

export default UserAPI;
