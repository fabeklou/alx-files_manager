import { expect } from 'chai';
import { before } from 'mocha';
import dbClient from '../utils/db';

describe('dbClient tests', () => {
  before(async () => {
    await new dbClient.constructor();
  });

  describe('nbUsers method', () => {
    it('should return the number of users in db', async () => {
      const users = await dbClient.nbUsers();
      expect(users).to.be.a('number');
      expect(users).to.be.above(0);
    });
  });

  describe('nbFiles method', () => {
    it('should return the number of files in db', async () => {
      const files = await dbClient.nbFiles();
      expect(files).to.be.a('number');
      expect(files).to.be.above(0);
    });
  });

  describe('isAlive method', () => {
    it('should return true if connected to the db', async () => {
      const connected = await dbClient.isAlive();
      expect(connected).to.be.true;
    });

    it('should return false if not connected to the db', async () => {
      dbClient._db = null;
      const disconnected = await dbClient.isAlive();
      expect(disconnected).to.be.false;
    });
  });
});
