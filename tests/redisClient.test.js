import { expect } from 'chai';
import redisClient from '../utils/redis';

describe('redisClient tests', () => {
  describe('constructor', () => {
    it('should create a Redis client instance', () => {
      expect(redisClient).to.exist;
      expect(redisClient.constructor.name).to.equal('RedisClient');
    });
  });

  describe('isAlive method', () => {
    it('should return true if connected to Redis server', () => {
      expect(redisClient.isAlive()).to.be.true;
    });
  });

  describe('set and get methods', () => {
    it('should return the Redis key', async () => {
      const key = 'Country';
      const value = 'TOGO';

      await redisClient.set(key, value, 100);
      expect(await redisClient.get(key)).to.equal(value);
    });
  });

  describe('del method', () => {
    it('should delete the Redis key', async () => {
      const key = 'City';
      const value = 'LOME';

      await redisClient.set(key, value, 100);
      expect(await redisClient.get(key)).to.equal(value);
      await redisClient.del(key);

      const getValue = await redisClient.get(key);
      expect(getValue).to.equal(null);
    });
  });
});
