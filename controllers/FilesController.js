// controllers/FilesController.js
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  /**
   * @route POST /files
   * @description Creates a new file or folder in the database and disk
   * @access Private
   */
  static async postUpload(req, res) {
    const token = req.header('X-Token');

    try {
      // Validate user token
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const {
        name, type, parentId = '0', isPublic = false, data,
      } = req.body;

      // Validate request body
      if (!name) return res.status(400).json({ error: 'Missing name' });
      if (!['folder', 'file', 'image'].includes(type)) return res.status(400).json({ error: 'Missing type' });
      if (!data && type !== 'folder') return res.status(400).json({ error: 'Missing data' });

      let parentObjectId = parentId;
      if (parentId !== '0') {
        parentObjectId = new ObjectId(parentId);
        const parentFile = await dbClient.db
          .collection('files')
          .findOne({ _id: parentObjectId });
        if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
        if (parentFile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
      }

      const fileDocument = {
        userId: new ObjectId(userId),
        name,
        type,
        isPublic,
        parentId: parentId === '0' ? '0' : parentObjectId,
      };

      // Process file or image type
      if (type === 'file' || type === 'image') {
        const fileUuid = uuidv4();
        const localPath = path.join(FOLDER_PATH, fileUuid);

        if (!fs.existsSync(FOLDER_PATH)) {
          fs.mkdirSync(FOLDER_PATH, { recursive: true });
        }

        fs.writeFileSync(localPath, Buffer.from(data, 'base64'));
        fileDocument.localPath = localPath;
      }

      // Insert the file into the database
      const result = await dbClient.db.collection('files').insertOne(fileDocument);
      fileDocument.id = result.insertedId;

      return res.status(201).json({
        id: fileDocument.id.toString(),
        userId: fileDocument.userId.toString(),
        name: fileDocument.name,
        type: fileDocument.type,
        isPublic: fileDocument.isPublic,
        parentId: fileDocument.parentId.toString(),
      });
    } catch (err) {
      console.error('Error during file upload:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getShow(req, res) {
    const token = req.header('X-Token');
    const fileId = req.params.id;

    try {
      // Validate token
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // Fetch file
      const file = await dbClient.db.collection('files').findOne({
        _id: ObjectId(fileId),
        userId: ObjectId(userId),
      });
      if (!file) return res.status(404).json({ error: 'Not found' });

      return res.status(200).json(file);
    } catch (err) {
      console.error('Error during fetching file:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token');
    const { parentId = '0', page = 0 } = req.query;
    const PAGE_SIZE = 20;

    try {
      // Validate token
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // Build match filter
      const matchFilter = {
        userId: ObjectId(userId),
        parentId: parentId === '0' ? '0' : ObjectId(parentId),
      };

      // Pagination and filtering
      const files = await dbClient.db.collection('files')
        .aggregate([
          { $match: matchFilter },
          { $skip: parseInt(page, 10) * PAGE_SIZE },
          { $limit: PAGE_SIZE },
        ])
        .toArray();

      // Transform output
      const response = files.map((file) => ({
        id: file._id.toString(),
        userId: file.userId.toString(),
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      }));

      return res.status(200).json(response);
    } catch (err) {
      console.error('Error during fetching files:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async putPublish(req, res) {
    const token = req.header('X-Token');
    const { id } = req.params;

    try {
      // Validate token
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // Check if the file exists and belongs to the user
      const file = await dbClient.db.collection('files').findOne({
        _id: ObjectId(id),
        userId: ObjectId(userId),
      });
      if (!file) return res.status(404).json({ error: 'Not found' });

      // Update isPublic to false
      await dbClient.db.collection('files').updateOne(
        { _id: ObjectId(id) },
        { $set: { isPublic: true } },
      );

      // Retrieve the updated document
      const updatedFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(id) });

      return res.status(200).json(updatedFile);
    } catch (err) {
      console.error('Error during updating file:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async putUnpublish(req, res) {
    const token = req.header('X-Token');
    const { id } = req.params;

    try {
      // Validate token
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // Check if the file exists and belongs to the user
      const file = await dbClient.db.collection('files').findOne({
        _id: ObjectId(id),
        userId: ObjectId(userId),
      });
      if (!file) return res.status(404).json({ error: 'Not found' });

      // Update isPublic to false
      await dbClient.db.collection('files').updateOne(
        { _id: ObjectId(id) },
        { $set: { isPublic: false } },
      );

      // Retrieve the updated document
      const updatedFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(id) });

      return res.status(200).json(updatedFile);
    } catch (err) {
      console.error('Error during updating file:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default FilesController;
