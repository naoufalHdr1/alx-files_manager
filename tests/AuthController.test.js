// tests/AuthController.js
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import app from '../server';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import sha1 from 'sha1';

chai.use(chaiHttp);

const waitForConnection = async () => {
  let retries = 5; // Number of retries
  const delay = 500; // Delay between retries in milliseconds

  while (retries > 0) {
    if (dbClient.isConnected && dbClient.db) {
      return; // Connection established
    }
    retries -= 1;
    // Wait for the delay
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error('Failed to connect to the database');
};

describe('AuthController Endpoints', () => {
  let authToken;
  let userId;

  before(async () => {

    await waitForConnection();
    await dbClient.db.collection('users').deleteMany({});

    // Create a test user for the /connect, /disconnect, and /users/me tests
    const testUser = {
      email: 'test@example.com',
      password: sha1('password123'),
    }
    await dbClient.db.collection('users').insertOne(testUser);
  });

  after(async () => {
    await dbClient.db.collection('users').deleteMany({});
  });

  describe('GET /connect', () => {
    it('Should return a token for a valid email and password', (done) => {
      const user = { email: 'test@example.com', password: 'password123' };
      const base64Credentials = Buffer.from(`${user.email}:${user.password}`).toString('base64');

      chai.request(app)
        .get('/connect')
        .set('Authorization', `Basic ${base64Credentials}`)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('token').that.is.a('string');
          authToken = res.body.token;
          done();
        });
    });
    
    it('Should return 401 for invalid email and password', (done) => {
      const user = { email: 'wrong@example.com', password: 'wrongpwd' };
      const base64Credentials = Buffer.from(`${user.email}:${user.password}`).toString('base64');

      chai.request(app)
        .get('/connect')
        .set('Authorization', `Basic ${base64Credentials}`)
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.body).to.have.property('error', 'Unauthorized');
          done();
        });
    })

    it('Should return 401 if no authorization header is provided', (done) => {
      chai.request(app)
        .get('/connect')
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.body).to.have.property('error').that.equals('Unauthorized');
          done();
        });
    });
  });

  describe('GET /users/me', () => {
    it('Should return user data for valid token', (done) => {
      chai.request(app)
        .get('/users/me')
        .set('X-Token', authToken)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('id');
          expect(res.body).to.have.property('email', 'test@example.com');
          done();
        });
    });

    it('Should return 401 for invalid or missing token', (done) => {
      chai.request(app)
        .get('/users/me')
        .set('X-Token', 'invalid_token')
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.body).to.have.property('error', 'Unauthorized');
          done();
        });
    });
  });

  describe('GET /disconnect', () => {
    it('Should return 204 for succesful sign-out with valid token', (done) => {
      chai.request(app)
        .get('/disconnect')
        .set('X-Token', authToken)
        .end((err, res) => {
          expect(res).to.have.status(204);
          done();
        });
    });

    it('Should return 401 for invalid or missing token', (done) => {
      chai.request(app)
        .get('/disconnect')
        .set('X-Token', 'invalid_token')
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.body).to.have.property('error', 'Unauthorized');
          done();
        });
    });
  });
});
