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

    // Create a test file 
    const testFile = {userId, name: 'Test File', type: 'file', data, parentId};
    const file = await dbClient.db.collection('files').insertOne(testFile);
    fileId = file.insertedId;

    // Simulate authentication token
    authToken = uuidv4();
    await redisClient.set(`auth_${authToken}`, userId.toString(), 24*60*60);

    // Stubbing database methods
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
});
