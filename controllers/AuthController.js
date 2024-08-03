import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(req, res) {
    const { authorization } = req.headers;

    if (!authorization) return res.status(401).send({ error: 'Unauthorized' });

    const encodedCredentials = authorization.split(' ')[1];

    try {
      const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf8');
      const [email, password] = decodedCredentials.split(':');

      if (!email || !password) return res.status(401).send({ error: 'Unauthorized' });

      const usersCollection = dbClient._db.collection('users');
      const user = await usersCollection.findOne({ email, password: sha1(password) });

      if (!user) return res.status(401).send({ error: 'Unauthorized ' });

      const sessionToken = uuidv4();

      /** 24 Hours -> 86400 Seconds */
      await redisClient.set(`auth_${sessionToken}`, user._id.toString(), 86400);
      return res.status(200).send({ token: sessionToken });
    } catch (error) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
  }

  static async getDisconnect(req, res) {
    const sessionToken = req.headers['x-token'];

    if (!sessionToken) return res.status(401).send({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${sessionToken}`);

    if (!userId) return res.status(401).send({ error: 'Unauthorized' });

    const usersCollection = dbClient._db.collection('users');
    const user = usersCollection.findOne({ _id: userId });

    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    await redisClient.del(`auth_${sessionToken}`);
    return res.status(204).end();
  }
}

module.exports = AuthController;
