import {
  expect,
  use,
  should,
  request,
} from 'chai';
import chaiHttp from 'chai-http';
import sinon from 'sinon';
import { ObjectId } from 'mongodb';
import app from '../server';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

use(chaiHttp);
should();

describe('User Endpoints', () => {
  const credentials = 'Basic Ym9iQGR5bGFuLmNvbTp0b3RvMTIzNCE=';
  let token = '';
  let userId = '';
  const user = {
    email: 'bob@dylan.com',
    password: 'toto1234!',
  };

  before(async () => {
    while (!dbClient.isAlive()) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await redisClient._client.flushall('ASYNC');
    await dbClient._db.collection('users').deleteMany({});
    await dbClient._db.collection('files').deleteMany({});
  });

  after(async () => {
    await redisClient._client.flushall('ASYNC');
    await dbClient._db.collection('users').deleteMany({});
    await dbClient._db.collection('files').deleteMany({});
  });

  describe('POST /users', () => {
    it('should create new user', async () => {
      const response = await request(app).post('/users').send(user);
      const body = JSON.parse(response.text);
      expect(body.email).to.equal(user.email);
      expect(body).to.have.property('id');
      expect(response.statusCode).to.equal(201);

      userId = body.id;
      const userMongo = await dbClient._db.collection('users').findOne({
        _id: ObjectId(body.id),
      });
      expect(userMongo).to.exist;
    });

    it('should return 400 Missing password', async () => {
      const user = {
        email: 'bob@dylan.com',
      };
      const response = await request(app).post('/users').send(user);
      const body = JSON.parse(response.text);
      expect(body).to.eql({ error: 'Missing password' });
      expect(response.statusCode).to.equal(400);
    });

    it('shiuld return 400 Missing email', async () => {
      const user = {
        password: 'toto1234!',
      };
      const response = await request(app).post('/users').send(user);
      const body = JSON.parse(response.text);
      expect(body).to.eql({ error: 'Missing email' });
      expect(response.statusCode).to.equal(400);
    });

    it('should return 400 Already exist', async () => {
      const user = {
        email: 'bob@dylan.com',
        password: 'toto1234!',
      };
      const response = await request(app).post('/users').send(user);
      const body = JSON.parse(response.text);
      expect(body).to.eql({ error: 'Already exist' });
      expect(response.statusCode).to.equal(400);
    });
  });

  describe('GET /connect', () => {
    it('should return 401 Unauthorized', async () => {
      const response = await request(app).get('/connect').send();
      const body = JSON.parse(response.text);
      expect(body).to.eql({ error: 'Unauthorized' });
      expect(response.statusCode).to.equal(401);
    });

    it('should authenticate user', async () => {
      const spyRedisSet = sinon.spy(redisClient, 'set');

      const response = await request(app)
        .get('/connect')
        .set('Authorization', credentials)
        .send();
      const body = JSON.parse(response.text);
      token = body.token;
      expect(body).to.have.property('token');
      expect(response.statusCode).to.equal(200);
      expect(
        spyRedisSet.calledOnceWithExactly(`auth_${token}`, userId, 24 * 3600)
      ).to.be.true;

      spyRedisSet.restore();
    });

    it('should get session token from redis client', async () => {
      const redisToken = await redisClient.get(`auth_${token}`);
      expect(redisToken).to.exist;
    });
  });

  describe('GET /disconnect', () => {
    after(async () => {
      await redisClient._client.flushall('ASYNC');
    });

    it('should return 401 Unauthorized', async () => {
      const response = await request(app).get('/disconnect').send();
      const body = JSON.parse(response.text);
      expect(body).to.eql({ error: 'Unauthorized' });
      expect(response.statusCode).to.equal(401);
    });

    it('should sign-out the user based on session token', async () => {
      const response = await request(app)
        .get('/disconnect')
        .set('X-Token', token)
        .send();
      expect(response.text).to.be.equal('');
      expect(response.statusCode).to.equal(204);
    });

    it('should not get user ssession token', async () => {
      const redisToken = await redisClient.get(`auth_${token}`);
      expect(redisToken).to.not.exist;
    });
  });

  describe('GET /users/me', () => {
    before(async () => {
      const response = await request(app)
        .get('/connect')
        .set('Authorization', credentials)
        .send();
      const body = JSON.parse(response.text);
      token = body.token;
    });

    it('should return 401 unauthorized', async () => {
      const response = await request(app).get('/users/me').send();
      const body = JSON.parse(response.text);

      expect(body).to.be.eql({ error: 'Unauthorized' });
      expect(response.statusCode).to.equal(401);
    });

    it('should retrieve user document', async () => {
      const response = await request(app)
        .get('/users/me')
        .set('X-Token', token)
        .send();
      const body = JSON.parse(response.text);

      expect(body).to.be.eql({ id: userId, email: user.email });
      expect(response.statusCode).to.equal(200);
    });
  });
});
