// tests/appController.test.js
import chai from 'chai';
import chaiHttp from 'chai-http';
import AppController from '../controllers/AppController'
import app from '../server';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

chai.use(chaiHttp);
const { expect } = chai;

describe('GET /status', () => {
  it('Should return the status of Redis and DB connections', (done) => {
    chai
      .request(app)
      .get('/status')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('object');
        expect(res.body).to.have.property('redis').that.is.a('boolean');
        expect(res.body).to.have.property('db').that.is.a('boolean');
        done();
      });
  });
});


describe('GET /stats', () => {
  before(async () => {
    // Clear the database and add test data
    if (dbClient.isAlive()) {
      await dbClient.db.collection('users').deleteMany({});
      await dbClient.db.collection('files').deleteMany({});

      // Add test users and files
      await dbClient.db.collection('users').insertOne({ name: 'Test User', email: 'test@example.com' });
      await dbClient.db.collection('files').insertOne({ name: 'Test File', type: 'file', data: 'Sample data' });
    }
  });

  after(async () => {
    // Clean up the database after each test
    if (dbClient.isAlive()) {
      await dbClient.db.collection('users').deleteMany({});
      await dbClient.db.collection('files').deleteMany({});
    }
  });

  it('Should returns the number of users and files in the DB', (done) => {
    chai
      .request(app)
      .get('/stats')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('object');
        expect(res.body).to.have.property('users').that.is.a('number');
        expect(res.body).to.have.property('files').that.is.a('number');
        expect(res.body.users).to.equal(1);
        expect(res.body.files).to.equal(1);
        done();
      });
  });
});

