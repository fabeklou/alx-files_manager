import sha1 from 'sha1';
import dbClient from '../utils/db';

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
}

module.exports = UsersController;
