# 0x04. Files manager
`#Back-end` `#JavaScript` `#ES6` `#NoSQL` `#MongoDB` `#Redis` `#NodeJS` `#ExpressJS` `#Kue`

## Description

The **Files Manager** project is a full-stack back-end application designed to facilitate file management. Users can upload, view, and manage files via a secure API. The project demonstrates core back-end concepts, including user authentication, file handling, database storage, background processing, and API design.

This project consolidates knowledge of:
- **Authentication** via tokens
- **Node.js**, **MongoDB**, and **Redis**
- **Background workers** for processing tasks
- **Pagination** for listing resources efficiently
- **Thumbnail generation** for image files

The project is designed for educational purposes to integrate various back-end technologies into a cohesive platform.

## Features

1. User Authentication
- Secure login using tokens.
- Token-based authorization for accessing resources.

2. File Management
- Upload new files.
- List all uploaded files with pagination.
- View file details or download files.
- Modify file permissions.

3. Image Processing
- Generate thumbnails for uploaded images.

4. Background Processing
- Use a background worker for tasks such as thumbnail generation.

5. Data Handling
- Persistent storage in MongoDB.
- Temporary storage in Redis for session management and caching.

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-repo/files-manager.git
cd files-manager
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
- Create a `.env` file at the root of the project.
- Add the required environment variables (e.g., database URIs, Redis configuration, etc.).

4. Start the server:
```bash
npm start
```

5. Run the application in development mode with live reloading:
```bash
npm run dev
```

## Technologies Used

- **Node.js:** Server-side runtime environment.
- **Express.js:** Web framework for creating APIs.
- **MongoDB:** Database for persistent storage.
- **Redis:** In-memory store for caching and temporary data.
- **Kue:** Library for creating background job queues.
- **Mocha:** Testing framework for unit tests.
- **Bull:** Task queue for managing background jobs.

## Learning Objectives

By the end of this project, you will understand:
- How to create and structure an API using Express.js.
- Authentication techniques using tokens.
- Data storage and retrieval using MongoDB.
- Temporary data management with Redis.
- Setting up and managing background workers for tasks.
- Implementing pagination for listing resources.
- Generating and serving image thumbnails.

## Provided Files
- `package.json:` Includes project dependencies and scripts.
- `.eslintrc.js:` ESLint configuration for code linting.
- `babel.config.js:` Babel configuration for ES6+ transpilation.

Ensure you run `npm install` to set up the dependencies before starting the project.

## Usage

1. Start the application and authenticate to receive a token.
2. Use the API endpoints to:
- Upload files.
- View and manage uploaded files.
- Generate thumbnails for images.
3. Check the background worker queue for thumbnail generation status.

## Testing

Run unit tests using Mocha:
```bash
npm test
```

## Tasks

### Task 0: Redis utils

1. Constructor:
- Connects to Redis and logs errors.
2. Methods:
- `isAlive()`: Checks Redis connection status.
- `get(key)`: Retrieves value for a given key.
- `set(key, value, duration)`: Stores a key-value pair with expiration.
- `del(key)`: Deletes a key from Redis.
3. Export: Create and export an instance of `RedisClient` as `redisClient`.

### Task 1: MongoDB utils

1. Constructor:
- Connects to MongoDB using environment variables (`DB_HOST`, `DB_PORT`, `DB_DATABASE`)
2. Methods:
- `isAlive()`: Checks MongoDB connection status.
- `nbUsers()`: Returns the number of documents in the users collection.
- `nbFiles()`: Returns the number of documents in the files collection.
3. Export: Create and export an instance of `DBClient` as `dbClient`.

### Task 2: First API

1. Server (`server.js`):
- Start Express on `PORT` (default: `5000`).
- Load routes from `routes/index.js`.
2. Routes (`routes/index.js`):
- `GET /status` → `AppController.getStatus`.
- `GET /stats` → `AppController.getStats`.
3. Controllers (`AppController.js`):
- `GET /status`: Return `{ "redis": true, "db": true }`.
- `GET /stats`: Return `{ "users": X, "files": Y }` using DB counts.

### Task 3: Create a new user

1. Endpoint:
- Add `POST /users` in `routes/index.js` → `UsersController.postNew`.
2. Validation:
- Missing email/password → Return `400` with appropriate error.
- Email exists → Return `400` with `Already exist`.
3. Logic:
- Hash password with SHA1.
- Save `email` and hashed `password` to `users` collection.
4. Response:
- Return `201` with `id` and `email`.

### Task 4: Authenticate a user

1. Routes (`routes/index.js`):
- `GET /connect` → `AuthController.getConnect`.
- `GET /disconnect` → `AuthController.getDisconnect`.
- `GET /users/me` → `UserController.getMe`.
2. Controllers:
  - **AuthController**:
    - `GET /connect`: Authenticate via Basic Auth, generate token, store in Redis for 24h, return token (`200`).
    - `GET /disconnect`: Sign out by deleting token from Redis, return `204` or `401` if not found.
  - **UserController**:
    - `GET /users/me`: Retrieve user by token, return user data or `401`.

### Task 5: First file

1. Route:
- `POST /files` → `FilesController.postUpload`.
2. Controller:
  - Validation:
    - Authenticate via token (`401 Unauthorized if invalid`).
    - Validate `name` (`400 Missing name`), `type` (`400 Missing/invalid type`), and `data` for `file/image` (`400 Missing data`).
    - Check `parentId` if provided (`400 Parent not found` or `400 Parent is not a folder`).
  - File Handling:
    - `folder`: Save in DB, return `201 Created`.
    - `file/image`: Save locally (`FOLDER_PATH or /tmp/files_manager`), store absolute path in DB, return `201 Created`.

### Task 6: Get and list file

1. Routes:
- `GET /files/:id` → Fetch file by ID.
- `GET /files` → Fetch files with pagination.
2. Controller:
- Authenticate via token (`401 Unauthorized` if invalid).
- Return file document (`404 Not Found` if unavailable).
- Support `parentId` (default: `0`) and pagination (20 items/page).

### Task 7: File publihs/unpublish

1. Routes:
- `PUT /files/:id/publish` → Publish file (`isPublic: true`).
- `PUT /files/:id/unpublish` → Unpublish file (`isPublic: false`).
2. Controller:
- Authenticate via token (`401 Unauthorized` if invalid).
- Return `404 Not Found` if no file linked to user and ID.
- Update and return file document (`200 OK`) with the updated `isPublic` status.

### Task 8: File data

1. Route:
- `GET /files/:id/data` → Retrieves file content.
2. Controller:
- Return `404 Not Found` if:
    - No file linked to the provided ID.
    - File is not public (`isPublic: false`), user is unauthenticated, or not the owner.
    - File is not locally present.
- Return `400 Bad Request` if the file type is a folder.
- Use `mime-types` to get the file's MIME-type.
- eturn file content with the correct MIME-type.
