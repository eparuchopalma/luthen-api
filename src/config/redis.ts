import { createClient } from 'redis';

const client = createClient({ url: process.env.REDIS_URL });

class RedisClient {

  async read(userID: string) {
    try {
      if (!client.isOpen) await client.connect();
      const response = await client.hGetAll(`user:${userID}`);
      if (JSON.stringify(response) === '{}') return null
      const string = JSON.parse(JSON.stringify(response)).funds;
      return JSON.parse(string);
    } catch (error) {
      throw error;
    }
  }

  async write(userID: string, payload: any) {
    try {
      if (!client.isOpen) await client.connect();
      const response = await client
        .hSet(`user:${userID}`, { funds: JSON.stringify(payload) });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async delete(userID: string) {
    try {
      if (!client.isOpen) await client.connect();
      const response = await client
        .hDel(`user:${userID}`, 'funds');
      return response;
    } catch (error) {
      throw error;
    }
  }

}

export default RedisClient;