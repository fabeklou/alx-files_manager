import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const dbName = process.env.DB_DATABASE || 'files_manager';

    const uri = `mongodb://${host}:${port}`;

    this._client = new MongoClient(uri, { useUnifiedTopology: true });

    this._client.connect().then(() => {
      this._db = this._client.db(dbName);
    }).catch((error) => {
      this._db = false;
      console.log(error);
    });
  }

  isAlive() {
    if (this._db) return true;
    return false;
  }

  async nbUsers() {
    const users = this._db.collection('users');
    return users.estimatedDocumentCount();
  }

  async nbFiles() {
    const files = this._db.collection('files');
    return files.estimatedDocumentCount();
  }
}

const dbClient = new DBClient();

module.exports = dbClient;
