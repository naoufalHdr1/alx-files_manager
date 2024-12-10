// tests/UsersController.js
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import app from '../server';
import dbClient from '../utils/db';

chai.use(chaiHttp);

describe('POST /users', () => {
  beforeEach(async () => {
    // Clear the users collection to ensure tests are isolated
    await dbClient.db.collection('users').deleteMany({});
  });

  afterEach(async () => {
    // Clear the users collection to ensure tests are isolated
    await dbClient.db.collection('users').deleteMany({});
  });

  it('should create a new user and return 201 status', (done) => {
    const user = {
      email: 'test@exmaple.com',
      password: 'password123',
    }

    chai.request(app)
      .post('/users')
      .send(user)
      .end(async (err, res) => {
        expect(res).to.have.status(201);
        expect(res.body).to.have.property('id').that.is.a('string');
        expect(res.body).to.have.property('email').that.equals(user.email);

        // Verify user is created in DB
        const newUser = await dbClient.db.collection('users').findOne({
          email: user.email
        })
        expect(newUser).to.not.be.null;
        expect(newUser.email).to.equal(user.email);

        done();
      })
  });

  it('Should return 400 if email is missing', (done) => {
    chai.request(app)
      .post('/users')
      .send({password: 'password123'})
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body).to.have.property('error', 'Missing email');
        done();
      })
  });

  it('Should return 400 if password is missing', (done) => {
    chai.request(app)
      .post('/users')
      .send({email: 'test@exmaple.com'})
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body).to.have.property('error', 'Missing password');
        done();
      })
  });

  it('Should return 400 if email already exists', (done) => {
    const user = {
      email: 'test@exmaple.com',
      password: 'password123',
    }

    // First create the user
    chai.request(app)
      .post('/users')
      .send(user)
      .end((err, res) => {
        expect(res).to.have.status(201);
        // Try creating the same user again
        chai.request(app)
          .post('/users')
          .send(user)
          .end((err, res) => {
            expect(res).to.have.status(400);
            expect(res.body).to.have.property('error').that.equals('Already exist');
            done();
          });
      });
  })
})
