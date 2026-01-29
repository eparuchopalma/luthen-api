import { authConfig } from '../config';
import sequelize from '../config/sequelize';

import axios from 'axios';

const { clientID, clientSecret, issuerBaseURL: domain } = authConfig;

const { Fund } = sequelize.models;

class UserService {
  async destroy(user_id: string) {
		const transaction = await sequelize.transaction();
		try {
			const accessToken = await getAccessToken();
      const userDeleted = await axios.request({
        method: 'DELETE',
        url: `${domain}api/v2/users/${user_id}`,
        headers: { 'Authorization': `Bearer ${accessToken}` },
			});
      if (userDeleted.status >= 400) throw new Error('Error deleting user');
			return await Fund!.destroy({ where: { user_id } });
		} catch (error) {
			await transaction.rollback();
      throw error;
		}
	}
}

async function getAccessToken() {
  try {
    const options = {
      method: 'POST',
      url: `${domain}oauth/token`,
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      data: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: `${clientID}`,
        client_secret: `${clientSecret}`,
        audience: `${domain}api/v2/`
      })
    };    
    const response = await axios.request(options);
    return response.data.access_token;
  } catch (error) {
    throw error;
  }
}


export default UserService;
