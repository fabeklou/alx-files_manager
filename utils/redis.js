import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    const client = createClient();
    client.on('error', (err) => {
      console.log(err);
    });

    this._client = client;
    this.getAsync = promisify(client.get).bind(client);
    this.setAsync = promisify(client.set).bind(client);
    this.delAsync = promisify(client.del).bind(client);
    this.pingAsync = promisify(client.ping).bind(client);
  };

  isAlive() {
    return this._client.connected;
  };

  async get(key) {
    return await this.getAsync(key);
  };

  async set(key, value, duration) {
    await this.setAsync(key, value, 'EX', duration);
  };

  async del(key) {
    await this.delAsync(key);
  };
};

const redisClient = new RedisClient();

module.exports = redisClient;
