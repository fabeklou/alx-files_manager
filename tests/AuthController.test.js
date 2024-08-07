import {
  expect, request, use,
} from 'chai';
import chaiHttp from 'chai-http';
import dbClient from '../utils/db';

use(chaiHttp);
const url = 'http://0.0.0.0:5000';

describe('authController tests', () => {
  const user = {
    email: 'bob@dylan.com',
    password: 'toto1234!',
  };

  beforeEach(async () => {
    await new dbClient.constructor();
    await request(url).post('/users').send(user);
  });

  afterEach(async () => {
    await dbClient._db.collection('users').deleteOne({ email: user.email });
  });

  const authValue = 'Basic Ym9iQGR5bGFuLmNvbTp0b3RvMTIzNCE=';

  describe('[GET] /connect route', () => {
    it('should return a token if find user', async () => {
      const response = await request(url).get('/connect').set('authorization', authValue).send();
      expect(response.body).to.have.property('token');
      expect(response.statusCode).equals(200);
    });

    it('should return an error if user not find', async () => {
      const errorAuthValue = 'Basic Ym9iQGR5bGFuLmNvbTp0b3RvMTIzNC9=';
      const response = await request(url).get('/connect').set('authorization', errorAuthValue).send();
      expect(response.body).to.deep.equal({ error: 'Unauthorized' });
      expect(response.statusCode).equals(401);
    });
  });

  describe('[GET] /disconnect route', () => {
    it('should delete the token and return nothing', async () => {
      const connectResponse = await request(url).get('/connect').set('authorization', authValue).send();
      const { token } = connectResponse.body;
      const disconnectResponse = await request(url).get('/disconnect').set('x-token', token).send();
      expect(disconnectResponse.request.header['x-token']).equals(token);
      expect(disconnectResponse.body).to.deep.equal({});
      expect(disconnectResponse.statusCode).equals(204);
    });

    it('should return an error if fake token is passed', async () => {
      const errorToken = '04ced7ff-e339-4646-872d-783525fc145b';
      const response = await request(url).get('/disconnect').set('x-token', errorToken).send();
      expect(response.body).to.deep.equal({ error: 'Unauthorized' });
      expect(response.statusCode).equals(401);
    });
  });
});
