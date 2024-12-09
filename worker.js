// worker.js
import Queue from 'bull';
import { ObjectId } from 'mongodb';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs';
import dbClient from './utils/db';

const fileQueue = Queue('fileQueue');

fileQueue.process(async (job) => {
  const { userId, fileId } = job.data;

  if (!userId) throw new Error('Missing userId');
  if (!fileId) throw new Error('Missing fileId');

  try {
    const file = await dbClient.db.collection('files').findOne({
      _id: ObjectId(fileId),
      userId: ObjectId(userId),
    });

    if (!file) throw new Error('File not found');

    const filePath = file.localPath;

    // Generate thumbnails concurrently
    const sizes = [500, 250, 100];
    const thumbnailPromises = sizes.map(async (size) => {
      const thumbnail = await imageThumbnail(filePath, { width: size });
      const thumbnailPath = `${filePath}_${size}`;
      fs.writeFileSync(thumbnailPath, thumbnail);
    });

    // Wait for all thumbnails to be generated
    await Promise.all(thumbnailPromises);
  } catch (err) {
    console.error('Error during processing job:', err);
    throw new Error(err.message);
  }
});
