// tests/redisClient.test.js
import { expect }from 'chai';
import redisClient from '../utils/redis';

describe('Redis Client', () => {

  afterEach(async () => {
    await redisClient.client.flushdb();
  })
  
  it('Should confirm the client is alive', () => {
    expect(redisClient.isAlive()).to.be.true;
  });

  it('Should set and retrieve a key-value pair', async () => {
    await redisClient.set('test_key', 'test_value', 10);
    const value = await redisClient.get('test_key');
    expect(value).to.equal('test_value');
  });

  it('Should delete a key', async () => {
    await redisClient.set('test_key', 'test_value', 10);
    await redisClient.del('test_key');
    const value = await redisClient.get('test_key');
    expect(value).to.be.null;
  });
});
