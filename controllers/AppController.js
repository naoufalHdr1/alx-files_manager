// controllers/AppController.js
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  /**
   * GET /status - Returns the status of Redis and DB connections.
   *
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   */
  static getStatus(req, res) {
    const redisStatus = redisClient.isAlive();
    const dbStatus = dbClient.isAlive();

    res.status(200).json({
      redis: redisStatus,
      db: dbStatus,
    });
  }

  /**
   * GET /stats - Returns the number of users and files in the DB.
   *
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   */
  static async getStats(req, res) {
    try {
      const users = await dbClient.nbUsers();
      const files = await dbClient.nbFiles();

      res.status(200).json({
        users,
        files,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
      res.status(500).json({
        message: 'Internal server error',
      });
    }
  }
}

export default AppController;
