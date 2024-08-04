import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager/';

class FilesController {
  static async postUpload(req, res) {
    const sessionToken = req.headers['x-token'];

    if (!sessionToken) return res.status(401).send('Unauthorized');

    const userId = await redisClient.get(`auth_${sessionToken}`);

    if (!userId) return res.status(401).send('Unauthorized');

    const usersCollection = dbClient._db.collection('users');
    const user = await usersCollection.findOne({ _id: ObjectId(userId) });

    if (!user) return res.status(401).send('Unauthorized');

    const {
      name, type, data, parentId, isPublic,
    } = req.body;

    const acceptedType = ['folder', 'file', 'image'];

    /** Data validation */

    if (!name) return res.status(400).send({ error: 'Missing name' });
    if (!type || !acceptedType.includes(type)) return res.status(400).send({ error: 'Missing type' });
    if (!data && type !== 'folder') return res.status(400).send({ error: 'Missing data' });

    const filesCollection = dbClient._db.collection('files');

    if (parentId) {
      const fileParent = await filesCollection.findOne({ _id: ObjectId(parentId) });

      if (!fileParent) return res.status(400).send({ error: 'Parent not found' });
      if (fileParent.type !== 'folder') return res.status(400).send({ error: 'Parent is not a folder' });
    }

    const fileIsPublic = isPublic || false;
    const fileParentId = parentId || 0;

    const fileData = {
      name,
      type,
      parentId: fileParentId,
      isPublic: fileIsPublic,
      userId: user._id,
    };

    const responseData = {
      name,
      type,
      parentId: fileParentId,
      isPublic: fileIsPublic,
      userId,
    };

    if (type === 'folder') {
      const { insertedId } = await filesCollection.insertOne(fileData);
      responseData.id = insertedId;
      return res.status(201).send(responseData);
    }

    const fileNameOnDisk = uuidv4();
    const localPath = `${folderPath}${fileNameOnDisk}`;

    /** Create folder path if not present */
    await FilesController.createFolderPath(folderPath);
    let decodedData;

    if (type === 'file') {
      /** decode text data */
      decodedData = Buffer.from(data, 'base64').toString('utf8');
    } else {
      /** decode image data */
      decodedData = Buffer.from(data, 'base64');
    }

    /** create file/image with data on disc */
    await FilesController.createFile(localPath, decodedData, type);

    fileData.localPath = localPath;
    const { insertedId } = await filesCollection.insertOne(fileData);
    responseData.id = insertedId;

    return res.status(201).send(responseData);
  }

  static async createFile(filePath, data, type) {
    const options = (type === 'file')
      ? { encoding: 'utf8', flag: 'w' }
      : { flag: 'w' };

    fs.writeFile(filePath, data, options,
      (error) => {
        if (error) console.log(`Error While Creating A New File: ${filePath}`);
      });
  }

  static async createFolderPath(folderPath) {
    fs.access(folderPath, (error) => {
      if (error) {
        fs.mkdir(folderPath, { recursive: true }, (error) => {
          if (error) console.log('Error While Creating The Folder Path');
        });
      }
    });
  }
}

module.exports = FilesController;
