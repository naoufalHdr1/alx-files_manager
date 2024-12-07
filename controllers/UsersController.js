// controllers/UsersControllers.js
import sha1 from 'sha1';
import dbClient from '../utils/db';

class UsersController {
  /**
   * POST /users - Creates a new user in the database.
   *
   * @param {Object} req - The request object, containing email and password in the body.
   * @param {Object} res - The response object.
   */
  static async postNew(req, res) {
    console.log(req.body.email);
    console.log(req.body.password);
    const { email, password } = req.body;

    // Validate email
    if (!email) return res.status(400).json({ error: 'Missing email' });

    // Validate password
    if (!password) return res.status(400).json({ error: 'Missing password' });

    try {
      const usersCollection = dbClient.db.collection('users');

      // Check if email already exists
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) return res.status(400).json({ error: 'Already exist' });

      // Create new user
      const hashedPassword = sha1(password);
      const user = { email, password: hashedPassword };
      const result = await usersCollection.insertOne(user);

      return res.status(201).json({
        id: result.insertedId,
        email,
      });
    } catch (err) {
      console.error('Error creating new user:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default UsersController;
