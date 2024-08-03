import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).send({ error: 'Missing email' });
    }

    if (!password) {
      return res.status(400).send({ error: 'Missing password' });
    }

    const usersCollection = dbClient._db.collection('users');
    const user = await usersCollection.findOne({ email });

    if (user) return res.status(400).send({ error: 'Already exist' });

    const enryptedPassword = sha1(password);
    const { insertedId } = await usersCollection.insertOne({ email, password: enryptedPassword });
    return res.status(201).json({ email, id: insertedId });
  }

  static async getMe(req, res) {
    const sessionToken = req.headers['x-token'];

    if (!sessionToken) return res.status(401).send({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${sessionToken}`);

    if (!userId) return res.status(401).send({ error: 'Unauthorized' });

    const usersCollection = dbClient._db.collection('users');
    const user = await usersCollection.findOne({ _id: ObjectId(userId) });

    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    return res.send({ email: user.email, id: user._id.toString() });
  }
}

module.exports = UsersController;
