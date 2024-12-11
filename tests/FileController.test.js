// tests/FileController.test.js

/* WARNING:
 * To avoids accidental deletion of production or important data you:
 * should create env variable "FOLDER_PATH='/tmp/file_manager_test'"
 * should create env variable "DB_DATABASE='/files_manager_test'"
 * 
 * ALERT: 
 * double-check the path you provide to avoid deleting critical data accidentally.
 */

import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import app from '../server';
import { v4 as uuidv4 } from 'uuid';
import sinon from 'sinon';
import fs from 'fs';
import { ObjectId } from 'mongodb';
import path from 'path';
import mime from 'mime-types';

chai.use(chaiHttp);
const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager_test';

// Helper function to insert test files
const insertTestFiles = async (numFiles, userId, parentId) => {
  const filesCollection = dbClient.db.collection('files');  

  const testFiles = Array.from({ length: numFiles }, (_, i) => ({
    userId,
    parentId,
    name: `File ${i + 1}`,
    type: 'file',
  }));

  await filesCollection.insertMany(testFiles);
};

describe('FilesController Endpoints', () => {
  let authToken;
  let userId;
  let fileId;
  let data = 'SGVsbG8gV2Vic3RhY2shCg==';
  const fakeId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
  const parentId = new ObjectId();

  before(async () => {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Ensure the database connection is established
    await dbClient.connectionPromise;

    await dbClient.db.collection('users').deleteMany({});
    await dbClient.db.collection('files').deleteMany({});

    // Create a test user 
    const testUser = { email: 'test@example.com', password: 'pwd123' };
    const user = await dbClient.db.collection('users').insertOne(testUser);
    userId = user.insertedId;

    // Create a test file in database and disk
    const localPath = path.join(folderPath, uuidv4());
    const testFile = {userId, name: 'TestFile.txt', type: 'file', data, parentId, localPath};
    const file = await dbClient.db.collection('files').insertOne(testFile);
    fileId = file.insertedId;
    fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

    // Simulate authentication token
    authToken = uuidv4();
    await redisClient.set(`auth_${authToken}`, userId.toString(), 24*60*60);

    // create mutiple files for pagination testing
    const numFiles = 25;
    await insertTestFiles(numFiles, userId, parentId);
  });

  after(async () => {
    // Cleanup after all tests are done
    await dbClient.db.collection('users').deleteMany({});
    await dbClient.db.collection('files').deleteMany({});
    await redisClient.del(`auth_${authToken}`);

    // Drop the database
    await dbClient.db.dropDatabase();

    fs.rmSync(folderPath, { recursive: true, force: true });
  });

  describe('POST /files', () => {
    it('Should return 401 if no token is provided', (done) => {
      chai.request(app)
        .post('/files')
        .send({name: 'Test File', type: 'file', data})
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.body).to.have.property('error', 'Unauthorized');
          done();
        });
    });

    it('Should return 401 if no user found', (done) => {
      chai.request(app)
        .post('/files')
        .send({name: 'Test File', type: 'file', data})
        .set('X-Token', 'invalid-token')
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.body).to.have.property('error', 'Unauthorized');
          done();
        });
    });

    it('Should return 400 if missing name', (done) => {
      chai.request(app)
        .post('/files')
        .send({type: 'file', data})
        .set('X-Token', authToken)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body).to.have.property('error', 'Missing name');
          done();
        });
    });

    it('Should return 400 if missing or invalid type', (done) => {
      chai.request(app)
        .post('/files')
        .send({name: 'Test File', type: 'invalid-type', data})
        .set('X-Token', authToken)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body).to.have.property('error', 'Missing type');
          done();
        });
    });

    it('Should return 400 if missing data', (done) => {
      chai.request(app)
        .post('/files')
        .send({name: 'Test File', type: 'file'})
        .set('X-Token', authToken)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body).to.have.property('error', 'Missing data');
          done();
        });
    });

    it('Should return 400 if including data with folder type', (done) => {
      chai.request(app)
        .post('/files')
        .send({name: 'Test File', type: 'folder', data})
        .set('X-Token', authToken)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body).to.have.property('error', 'Missing data');
          done();
        });
    });
    
    it('Should return 400 if parentId is invalid', (done) => {
      chai.request(app)
        .post('/files')
        .send({name: 'Test File', type: 'file', data, parentId: fakeId})
        .set('X-Token', authToken)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body).to.have.property('error', 'Parent not found');
          done();
        });
    });

    it('Should return 400 if parentId is not type of folder', (done) => {
      chai.request(app)
        .post('/files')
        .send({name: 'Test File', type: 'file', data, parentId: fileId})
        .set('X-Token', authToken)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body).to.have.property('error', 'Parent is not a folder');
          done();
        });
    });

    it('Should return 201 and uplaod a file successfully', (done) => {
      chai.request(app)
        .post('/files')
        .send({name: 'Test File', type: 'file', data})
        .set('X-Token', authToken)
        .end(async (err, res) => {
          expect(res).to.have.status(201);
          expect(res.body).to.have.property('id').that.is.a('string');
          expect(res.body).to.have.property('userId')
            .that.is.a('string').that.equal(userId.toString());
          expect(res.body).to.have.property('name').that.equal('Test File');
          expect(res.body).to.have.property('type').that.equal('file');
          expect(res.body).to.have.property('isPublic').that.is.a('boolean');
          expect(res.body).to.have.property('parentId').that.is.a('string');
          const file = await dbClient.db.collection('files').findOne({
            _id: ObjectId(res.body.id),
          });
		      expect(file).to.exist;
          expect(fs.existsSync(file.localPath)).to.be.true;
          
          const fileData = fs.readFileSync(file.localPath, 'base64');
          expect(fileData).to.be.equal(data);

          done();
        });
    });

    it('Should return 201 for folder creation without data', (done) => {
      chai.request(app)
        .post('/files')
        .send({name: 'Test Folder', type: 'folder'})
        .set('X-Token', authToken)
        .end(async (err, res) => {
          expect(res).to.have.status(201);
          expect(res.body).to.have.property('id').that.is.a('string');
          expect(res.body).to.have.property('userId')
            .that.is.a('string').that.equal(userId.toString());
          expect(res.body).to.have.property('name').that.equal('Test Folder');
          expect(res.body).to.have.property('type').that.equal('folder');
          expect(res.body).to.have.property('isPublic').that.is.a('boolean');
          expect(res.body).to.have.property('parentId').that.is.a('string');
          const dir = await dbClient.db.collection('files').findOne({
            _id: ObjectId(res.body.id),
          });
          expect(dir).to.exist;

          done();
        });
    });
  });
  
  describe('GET /files/:id', () => {
    it('should return 401 if the token is missing or invalid', (done) => {
      chai.request(app)
        .get(`/files/${fileId.toString()}`)
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.body).to.have.property('error', 'Unauthorized');
          done();
        });
    });

    it('should return 404 if the file does not exist', (done) => {
      chai.request(app)
        .get(`/files/${fakeId.toString()}`)
        .set('X-Token', authToken)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body).to.have.property('error', 'Not found');
          done();
        });
    });

    it('should retrieve a file successfully', (done) => {
      chai.request(app)
        .get(`/files/${fileId.toString()}`)
        .set('X-Token', authToken)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.be.a('object');
          expect(res.body).to.have.property('_id', fileId.toString());
          expect(res.body).to.have.property('userId', userId.toString());
          done();
        });
    });
  });

  describe('GET /files', () => {
    it('Should return 401 if the token is missing or invalid', (done) => {
      chai.request(app)
        .get('/files')
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.body).to.have.property('error', 'Unauthorized');
          done();
        });
    });

    it('Should retrieve files for a specific parentId', (done) => {
      chai.request(app)
        .get('/files')
        .set('X-Token', authToken)
        .query({ parentId: parentId.toString() })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('array').that.have.length(20);
          // Verify that all retrieved files have the correct parentId
          res.body.forEach((file) => {
            expect(file).to.have.property('parentId', parentId.toString());
            expect(file).to.have.property('userId', userId.toString());
          })
          done();
        });
    });

    it('Should paginate results', async () => {
      // Fetch page 0
      const resPage1 = await chai.request(app)
        .get('/files')
        .set('X-Token', authToken)
        .query({ parentId: parentId.toString(), page: 0 });
      expect(resPage1).to.have.status(200);
      expect(resPage1.body).to.be.an('array').that.have.length(20);
      resPage1.body.forEach((file) => {
        expect(file).to.have.property('parentId', parentId.toString());
        expect(file).to.have.property('userId', userId.toString());
      });

      // Fetch page 1
      const resPage2 = await chai.request(app)
        .get('/files')
        .set('X-Token', authToken)
        .query({ parentId: parentId.toString(), page: 1 });
      expect(resPage2).to.have.status(200);
      const count = await dbClient.db.collection('files').countDocuments({ parentId });
      expect(resPage2.body).to.be.an('array').that.have.length(count - 20);
      resPage2.body.forEach((file) => {
        expect(file).to.have.property('parentId', parentId.toString());
        expect(file).to.have.property('userId', userId.toString());
      });

      // Fetch page 2 (beyond the total number of documents)
      const resPage3 = await chai.request(app)
        .get('/files')
        .set('X-Token', authToken)
        .query({ parentId: parentId.toString(), page: 2 });
      expect(resPage3).to.have.status(200);
      expect(resPage3.body).to.be.an('array').that.is.empty;
    });
  });

  describe('PUT /files/:id/publish', () => {
    it('should return 401 if token is missing or invalid', (done) => {
      chai.request(app)
        .put(`/files/${fileId}/publish`)
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.body.error).to.equal('Unauthorized');
          done();
        });
    });

    it('should return 404 if file is not found', (done) => {
      chai
        .request(app)
        .put(`/files/${new ObjectId()}/publish`)
        .set('X-Token', authToken)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.error).to.equal('Not found');
          done();
        });
    });

    it('should publish the file and return the updated file', (done) => {
      chai
        .request(app)
        .put(`/files/${fileId}/publish`)
        .set('X-Token', authToken)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.isPublic).to.be.true;
          expect(res.body._id).to.equal(fileId.toString());
          expect(res.body.userId).to.equal(userId.toString());
          done();
        });
    });
  });

  describe('PUT /files/:id/unpublish', () => {
    it('should return 401 if token is invalid or missing', (done) => {
      chai
        .request(app)
        .put(`/files/${fileId}/unpublish`)
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.body.error).to.equal('Unauthorized');
          done();
        });
    });

    it('should return 404 if file is not found', (done) => {
      chai
        .request(app)
        .put(`/files/${fakeId}/unpublish`)
        .set('X-Token', authToken)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.error).to.equal('Not found');
          done();
        });
    });

    it('should unpublish the file and return the updated file', (done) => {
      chai
        .request(app)
        .put(`/files/${fileId}/unpublish`)
        .set('X-Token', authToken)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.isPublic).to.be.false;
          expect(res.body._id).to.equal(fileId.toString());
          expect(res.body.userId).to.equal(userId.toString());
          done();
        });
    });
  });

  describe('FilesController - GET /files/:id/data', () => {
    it('should return 404 if the file does not exist', (done) => {
      chai.request(app)
        .get(`/files/${fakeId}/data`)
        .set('X-Token', authToken)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.error).to.equal('Not found');
          done();
        });
    });

    it('should return 400 if the file is a folder', async () => {
      // Seed a folder in the database
      const folderId = (await dbClient.db.collection('files').insertOne({
        userId,
        name: 'test-folder',
        type: 'folder',
      })).insertedId;

      const res = await chai.request(app)
        .get(`/files/${folderId}/data`)
        .set('X-Token', authToken);
      expect(res).to.have.status(400);
      expect(res.body.error).to.equal("A folder doesn't have content");
    });

    it('should return 404 if the file is not public and the user is unauthorized', (done) => {
      chai.request(app)
        .get(`/files/${fileId}/data`)
        .set('X-Token', 'invalid_token')
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.error).to.equal('Not found');
          done();
        });
    });

    it('should return 404 if the file does not exist locally', (done) => {
      chai.request(app)
        .get(`/files/${fileId}/data`)
        .set('X-Token', authToken)
        .query({ size: 'small' })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.error).to.equal('Not found');
          done();
        });
    });

    it('should return 200 and the file if it is public', async () => {
      // Update isPublic to true before testing
      await dbClient.db.collection('files').updateOne(
        { _id: fileId },
        { $set: { isPublic: true } },
      );
      
      const res = await chai.request(app)
        .get(`/files/${fileId}/data`)
      expect(res).to.have.status(200);
      expect(res.header['content-type']).to.equal('text/plain; charset=utf-8');
      expect(res.text).to.equal('Hello Webstack!\n');
    });

    it('should return 200 and the file if the user is authorized', (done) => {
      chai.request(app)
        .get(`/files/${fileId}/data`)
        .set('X-Token', authToken)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.header['content-type']).to.equal('text/plain; charset=utf-8');
          expect(res.text).to.equal('Hello Webstack!\n');
          done();
        });
    });
  });
});
