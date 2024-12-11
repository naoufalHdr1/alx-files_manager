// tests/AuthController.js
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import app from '../server';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import sha1 from 'sha1';

chai.use(chaiHttp);

describe('AuthController Endpoints', () => {
  let authToken;
  let userId;

  before(async () => {
    // Ensure the database connection is established
    await dbClient.connectionPromise
    await dbClient.db.collection('users').deleteMany({});

    const testUser = {
      email: 'test@example.com',
      password: sha1('password123'),
    }
    const result = await dbClient.db.collection('users').insertOne(testUser);
	  userId = result.insertedId;
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
          expect(res.body).to.have.property('id', userId.toString());
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
