# User Model

## Overview

The User model represents individuals who can interact with the platform as students, instructors, or administrators. Users can have multiple roles.

## Schema

```typescript
interface User {
  id?: number;
  name: string;
  email: string;
  password: string;
  bio?: string;
  profile_thumbnail?: string;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}
```

## Database Table

```sql
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  bio TEXT,
  profile_thumbnail VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Additional Table: user_roles

To manage multiple roles per user.

```sql
CREATE TABLE IF NOT EXISTS user_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role ENUM('student', 'instructor', 'admin') NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, role)
);
```

## Methods

- `createUser`: Creates a new user with a hashed password.
- `getUserById`: Retrieves a user by their unique ID.
- `getUserByEmail`: Finds a user by their email address.
- `updateUser`: Updates user information.
- `deleteUser`: Removes a user from the system.
- `getAllUsers`: Retrieves all users with optional filtering and pagination.
- `changePassword`: Updates a user's password.
- `verifyPassword`: Checks if a provided password matches the stored hashed password.
- `addUserRole`: Adds a role to a user.
- `removeUserRole`: Removes a role from a user.
- `getUserRoles`: Retrieves all roles for a user.
