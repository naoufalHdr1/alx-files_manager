// controllers/AuthController.js
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';

class AuthController {
  
  /**
   * @route GET /connect
   * @description Signs in the user by generating a new authentication token
   *
   * @header Authorization - Basic Authentication header containing email and password (Base64 encoded)
   * @returns {Object} - The token object: { token: <auth_token> }
   * @status 200 - Successfully generated a new authentication token
   * @status 401 - Unauthorized if invalid credentials are provided
   */
  static async getConnect(req, res) {
    const authorization = req.headers.authorization;
    if (!authorization)
      return res.status(401).json({ error: 'Unauthorized' });

    // Decode Base64 authorization header
    const base64Credentials = authorization.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [email, password] = credentials.split(':');

    if (!email || !password)
      return res.status(401).json({ error: 'Unauthorized' });

    const hashedPassword = sha1(password);

    try {
      // Find user in database
      const user = await dbClient.db.collection('users').findOne({ email, password: hashedPassword });
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      // Generate Token and store it in Redis
      const token = uuidv4();
      await redisClient.set(`auth_${token}`, user._id.toString(), 24*60*60)

      return res.status(200).json({ token  });
    } catch(err) {
      console.error('Database error during authentication:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * @route GET /disconnect
   * @description Signs out the user by deleting the authentication token
   *
   * @header X-Token - Authentication token used for the current session
   * @returns {Object} - No content if successful
   * @status 204 - Successfully signed out (token deleted)
   * @status 401 - Unauthorized if the token is invalid or not found
   */
  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      // Retrieve the user id based on the token
      const key = `auth_${token}`
      const userId = await redisClient.get(key);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      await redisClient.del(key);

      return res.status(204).send();
    } catch(err) {
      console.error('Error during sign-out:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * @route GET /users/me
   * @description Retrieves the user based on the authentication token
   * @access Private
   */
  static async getMe(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      // Retrieve the user id based on the token
      const key = `auth_${token}`
      const userId = await redisClient.get(key);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // Find the user based on the ID retrieved from Redis
      const _id = ObjectId(userId);
      const user = await dbClient.db.collection('users').findOne({ _id });
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      return res.json({
        id: user._id,
        email: user.email
      });
    } catch(err) {
      console.error('Error during sign-out:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default AuthController;
