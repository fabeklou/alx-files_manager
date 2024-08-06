import fs from 'fs';
import mime from 'mime-types';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import { fileQueue } from '../worker';

const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';

/** Create folder path when module is loaded */
(() => {
  fs.access(folderPath, (error) => {
    if (error) {
      fs.mkdir(folderPath, { recursive: true }, (error) => {
        if (error) console.log('Error While Creating The Folder Path');
      });
    }
  });
})();

class FilesController {
  static async addJob(userId, fileId) {
    await fileQueue.add({ userId, fileId });
  }

  static async getFile(req, res) {
    const { id } = req.params;
    const { size } = req.query;
    const sessionToken = req.headers['x-token'];

    if (!id) return res.status(404).send({ error: 'Not found' });

    const fileCollection = dbClient._db.collection('files');
    const file = await fileCollection.findOne({ _id: ObjectId(id) });
    if (!file) return res.status(404).send({ error: 'Not found' });

    if (!file.isPublic) {
      if (!sessionToken) return res.status(404).send({ error: 'Not found' });

      const userId = await redisClient.get(`auth_${sessionToken}`);

      if (!userId) return res.status(404).send({ error: 'Not found' });

      const userCollection = dbClient._db.collection('users');
      const user = await userCollection.findOne({ _id: ObjectId(userId) });

      if (!user || String(file.userId) !== String(user._id)) {
        return res.status(404).send({ error: 'Not found' });
      }
    }

    if (file.type === 'folder') return res.status(400).send({ error: "A folder doesn't have content" });

    const thumbnailSuffix = size ? `_${size}` : '';
    const requestedFilePath = `${file.localPath}${thumbnailSuffix}`;
    return fs.access(requestedFilePath, (error) => {
      if (error) {
        return res.status(404).send({ error: 'Not found' });
      }
      const fileMimeType = mime.contentType(requestedFilePath);
      return res.sendFile(requestedFilePath, { headers: { 'Content-Type': fileMimeType } });
    });
  }

  static async togglePutPublish(req, res, status) {
    const { id } = req.params;
    const sessionToken = req.headers['x-token'];

    if (!sessionToken) return res.status(401).send({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${sessionToken}`);

    if (!userId) return res.status(401).send({ error: 'Unauthorized' });

    const userCollection = dbClient._db.collection('users');
    const user = await userCollection.findOne({ _id: ObjectId(userId) });

    if (!user) return res.status(401).send({ error: 'Unauthorized' });
    if (!id) return res.status(404).send({ error: 'Not found' });

    const fileCollection = dbClient._db.collection('files');
    const file = await fileCollection.findOne({ _id: ObjectId(id), userId: ObjectId(userId) });
    if (!file) return res.status(404).send({ error: 'Not found' });

    await fileCollection.updateOne(
      { _id: ObjectId(id), userId: ObjectId(userId) },
      { $set: { isPublic: status } },
    );

    const fileUpdatedData = {
      id: String(file._id),
      userId: String(file.userId),
      name: file.name,
      type: file.type,
      isPublic: status,
      parentId: String(file.parentId),
    };

    return res.status(200).send(fileUpdatedData);
  }

  static async putPublish(req, res) {
    return FilesController.togglePutPublish(req, res, true);
  }

  static async putUnpublish(req, res) {
    return FilesController.togglePutPublish(req, res, false);
  }

  static async getShow(req, res) {
    const { id } = req.params;
    const sessionToken = req.headers['x-token'];

    if (!sessionToken) return res.status(401).send({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${sessionToken}`);

    if (!userId) return res.status(401).send({ error: 'Unauthorized' });

    const userCollection = dbClient._db.collection('users');
    const user = await userCollection.findOne({ _id: ObjectId(userId) });

    if (!user) return res.status(401).send({ error: 'Unauthorized' });
    if (!id) return res.status(404).send({ error: 'Not found' });

    const fileCollection = dbClient._db.collection('files');
    const file = await fileCollection.findOne({ _id: ObjectId(id), userId: ObjectId(userId) });
    if (!file) return res.status(404).send({ error: 'Not found' });

    const fileDocument = {
      id: String(file._id),
      userId: String(file.userId),
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: String(file.parentId),
    };
    return res.send(fileDocument);
  }

  static async getIndex(req, res) {
    const { parentId, page } = req.query;
    const sessionToken = req.headers['x-token'];

    if (!sessionToken) return res.status(401).send({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${sessionToken}`);

    if (!userId) return res.status(401).send({ error: 'Unauthorized' });

    const userCollection = dbClient._db.collection('users');
    const user = await userCollection.findOne({ _id: ObjectId(userId) });

    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    const fileCollection = dbClient._db.collection('files');
    const researchData = {
      parentId: parentId ? ObjectId(parentId) : '0',
      userId: user._id,
    };
    const maxPageSize = 20;
    const fileDocuments = await fileCollection.aggregate([
      { $match: researchData },
      { $skip: page ? Number(page) * maxPageSize : 0 },
      { $limit: maxPageSize },
    ]).toArray();

    if (!fileDocuments) return res.send([]);

    const listOfFiles = [];
    for (const file of fileDocuments) {
      const fileData = {
        id: String(file._id),
        userId: String(file.userId),
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: String(file.parentId),
      };

      listOfFiles.push(fileData);
    }

    return res.send(listOfFiles);
  }

  static async postUpload(req, res) {
    const sessionToken = req.headers['x-token'];

    if (!sessionToken) return res.status(401).send({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${sessionToken}`);

    if (!userId) return res.status(401).send({ error: 'Unauthorized' });

    const usersCollection = dbClient._db.collection('users');
    const user = await usersCollection.findOne({ _id: ObjectId(userId) });

    if (!user) return res.status(401).send({ error: 'Unauthorized' });

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

    const fileData = {
      name,
      type,
      parentId: parentId ? ObjectId(parentId) : '0',
      isPublic: fileIsPublic,
      userId: user._id,
    };

    const responseData = {
      name,
      type,
      parentId: parentId || 0,
      isPublic: fileIsPublic,
      userId,
    };

    if (type === 'folder') {
      const { insertedId } = await filesCollection.insertOne(fileData);
      responseData.id = insertedId;
      return res.status(201).send(responseData);
    }

    const fileNameOnDisk = uuidv4();
    const localPath = `${folderPath}/${fileNameOnDisk}`;

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

    /** Create a fileQueue job for image thumbnails */
    if (type === 'image') {
      await FilesController.addJob(userId, insertedId);
    }

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
}

module.exports = FilesController;
