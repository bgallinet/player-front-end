import APICall from '../utils/APICall';
import EnvironmentVariables from '../utils/EnvironmentVariables';

const UserAPI = async (requestBody) => {
    const data = await APICall(requestBody, EnvironmentVariables.UserAPI_URL);
    return data;
};

export default UserAPI;