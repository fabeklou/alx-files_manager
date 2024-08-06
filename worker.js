import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs';
import { ObjectId } from 'mongodb';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue');
const userQueue = new Queue('userQueue');

userQueue.process(async (job, done) => {
  try {
    const { userId } = job.data;

    if (!userId) throw new Error('Missing userId');

    const userCollection = dbClient._db.collection('users');
    const user = await userCollection.findOne({ _id: ObjectId(userId) });

    if (!user) throw new Error('User not found');

    console.log(`Welcome ${user.email}!`);
  } catch (error) {
    done(error);
  }

  done();
});

fileQueue.process(async (job, done) => {
  try {
    const { userId, fileId } = job.data;

    if (!fileId) throw new Error('Missing fileId');
    if (!userId) throw new Error('Missing userId');

    const fileCollection = dbClient._db.collection('files');
    const file = await fileCollection.findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });

    if (!file) throw new Error('File not found');

    const imageThumbnailSizes = [500, 250, 100];
    const originalFilePath = file.localPath;

    for (const thumbnailWidth of imageThumbnailSizes) {
      const options = { width: thumbnailWidth, withMetaData: true };
      // eslint-disable-next-line no-await-in-loop
      const thumbnail = await imageThumbnail(originalFilePath, options);
      fs.writeFileSync(`${originalFilePath}_${thumbnailWidth}`, thumbnail);
    }
  } catch (error) {
    done(error);
  }

  done();
});

export { userQueue, fileQueue };
