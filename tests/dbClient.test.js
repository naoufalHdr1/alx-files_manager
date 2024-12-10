// tests/dbClient.test.js
import { expect } from 'chai';
import dbClient from '../utils/db';

describe('DB Client', () => {
  
  before(async () => {
    if (dbClient.isAlive()) {
      // Clear collections before each test
      await dbClient.db.collection('users').deleteMany({});
      await dbClient.db.collection('files').deleteMany({});
    }
  });

  after(async () => {
    if (dbClient.isAlive()) {
      // Clear collections before each test
      await dbClient.db.collection('users').deleteMany({});
      await dbClient.db.collection('files').deleteMany({});
    }
  });

  it('Should confirm the database conncetion is alive', () => {
    expect(dbClient.isAlive()).to.be.true;
  });

  it('Should return the number of users', async () => {
    let count = await dbClient.nbUsers();
    expect(count).to.equal(0);

    // Insert a user into the 'users' collection
    await dbClient.db.collection('users').insertOne({
      name: 'test_name',
      email: 'test@email.com',
    })
    count = await dbClient.nbUsers();
    expect(count).to.equal(1);
  });

  it('Should return the number of files', async () => {
    let count = await dbClient.nbFiles();
    expect(count).to.equal(0);

    // Insert a file into the 'files' collection
    await dbClient.db.collection('files').insertOne({
      name: 'test_fileName',
      type: 'test_type',
      data: 'test_data',
    })
    count = await dbClient.nbFiles();
    expect(count).to.equal(1);
  });
});
