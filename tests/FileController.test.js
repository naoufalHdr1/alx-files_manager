// tests/FileController.test.js

/* WARNING:
 * To avoids accidental deletion of production or important data you:
 * should create env variable "FOLDER_PATH='/tmp/file_manager_test'"
 * should create env variable "DB_DATABASE='/files_manager_test'"
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

// read the directory's contents and then delete each file
const deleteAllFiles = (dirPath) => {
  try {
    const files = fs.readdirSync(folderPath);
    files.forEach((file) => {
      const filePath = path.join(folderPath, file);
      fs.unlinkSync(filePath);
    });
  } catch (err) {
    console.error('Error deleting files:', err);
  }
};

describe('FilesController Endpoints', () => {
  let authToken;
  let userId;
  let fileId;
  let data = 'SGVsbG8gV2Vic3RhY2shCg==';

  before(async () => {
    deleteAllFiles(folderPath);

    // Ensure the database connection is established
    await dbClient.connectionPromise;

    await dbClient.db.collection('users').deleteMany({});
    await dbClient.db.collection('files').deleteMany({});

    const testUser = { email: 'test@example.com', password: 'pwd123' };
    const testFile = {name: 'Test File', type: 'file', data };

    const user = await dbClient.db.collection('users').insertOne(testUser);
    const file = await dbClient.db.collection('files').insertOne(testFile);

    userId = user.insertedId;
    fileId = file.insertedId;

    // Simulate authentication token
    authToken = uuidv4();
    await redisClient.set(`auth_${authToken}`, userId.toString(), 24*60*60);

    // Stubbing database methods
  });

  after(async () => {
    // Cleanup after all tests are done
    await dbClient.db.collection('users').deleteMany({});
    await dbClient.db.collection('files').deleteMany({});
    await redisClient.del(`auth_${authToken}`);

    deleteAllFiles(folderPath);
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
      const fakeId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
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

});
