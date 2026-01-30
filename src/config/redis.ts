import { createClient } from 'redis';
import fundModel from '../models/fundModel';

const client = createClient({ url: process.env.REDIS_URL });

class RedisClient {

  async read(userID: string) {
    try {
      if (!client.isOpen) await client.connect();
      const response = await client.get(`user:${userID}`);
      if (response) return JSON.parse(response) as fundModel[];
      else return null;
    } catch (error) {
      throw error;
    }
  }

  async write(userID: string, payload: any) {
    try {
      if (!client.isOpen) await client.connect();
      const response = await client.set(`user:${userID}`, JSON.stringify(payload));
      if (response !== 'OK') await this.delete(userID);
      return;
    } catch (error) {
      throw error;
    }
  }

  async delete(userID: string) {
    try {
      if (!client.isOpen) await client.connect();
      const response = await client.del(`user:${userID}`);
      return response;
    } catch (error) {
      throw error;
    }
  }

}

export default RedisClient;