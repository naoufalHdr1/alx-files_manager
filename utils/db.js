// utils/db.js

import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    // Get the environment variables or default values
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const uri = `mongodb://${host}:${port}`;

    // Create MongoClient instance
    this.client = new MongoClient(uri, { useUnifiedTopology: true });
    this.db = null;
    this.isConnected = false;

    // Establish connection & Check if it's successful
    this.client.connect((err) => {
      if (err) {
        console.error('Failed to connect to MongoDB:', err);
        this.isConnected = false;
      } else {
        this.isConnected = true;
        this.db = this.client.db(database);
      }
    });
  }

  /**
   * Check if the MongoDB connection is alive
   * @returns {boolean} - true if connected, false otherwise
   */
  isAlive() {
    return this.isConnected;
  }

  /**
   * Get the number of documents in the 'users' collection
   * @returns {Promise<number>} - The number of documents in the 'users' collection
   */
  async nbUsers() {
    try {
      if (!this.db) throw new Error('Database not connected');
      const usersCollection = this.db.collection('users');
      const count = await usersCollection.countDocuments();
      return count;
    } catch (err) {
      console.error('Error fetching users count:', err);
      return 0;
    }
  }

  /**
   * Get the number of documents in the 'files' collection
   * @returns {Promise<number>} - The number of documents in the 'files' collection
   */
  async nbFiles() {
    try {
      if (!this.db) throw new Error('Database not connected');
      const filesCollection = this.db.collection('files');
      const count = await filesCollection.countDocuments();
      return count;
    } catch (err) {
      console.error('Error fetching files count:', err);
      return 0;
    }
  }
}

// Create an instance of DBClient and export it
const dbClient = new DBClient();
export default dbClient;
