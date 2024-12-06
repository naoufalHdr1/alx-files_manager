import { promisify } from 'util';
import { createClient } from 'redis';

/**
 * Represents a Redis client.
 */
class RedisClient {
  /**
   * Initializes the Redis client and handles connection status.
   */
  constructor() {
    this.client = createClient();

    // Display errors on connection
    this.client.on('error', (err) => {
      console.error('Redis client error:', err.message || err.toString());
    });

    this.getAsync = promisify(this.client.GET).bind(this.client);
    this.setexAsync = promisify(this.client.SETEX).bind(this.client);
    this.delAsync = promisify(this.client.DEL).bind(this.client);
  }

  /**
   * Checks if the Redis client is connected.
   * @returns {boolean}
   */
  isAlive() {
    return this.client.connected;
  }

  /**
   * Retrieves the value of a given key.
   * @param {string} key The key to retrieve.
   * @returns {Promise<string | null>} The value or null if not found.
   */
  async get(key) {
    try {
      return await this.getAsync(key);
    } catch (err) {
      console.error(`Error getting key "${key}":`, err);
      return null;
    }
  }

  /**
   * Stores a key-value pair in Redis with an expiration time.
   * @param {string} key The key to store.
   * @param {string | number | boolean} value The value to store.
   * @param {number} duration The expiration time in seconds.
   * @returns {Promise<void>}
   */
  async set(key, value, duration) {
    try {
      await this.setexAsync(key, duration, value);
    } catch (err) {
      console.error(`Error setting key "${key}":`, err);
    }
  }

  /**
   * Deletes a key from Redis.
   * @param {string} key The key to delete.
   * @returns {Promise<void>}
   */
  async del(key) {
    try {
      await this.delAsync(key);
    } catch (err) {
      console.error(`Error deleting key "${key}":`, err);
    }
  }
}

const redisClient = new RedisClient();
export default redisClient;
