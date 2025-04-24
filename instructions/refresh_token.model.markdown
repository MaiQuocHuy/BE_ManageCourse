# Refresh Token Model

## Overview

The Refresh Token model manages authentication persistence, enabling users to maintain login sessions without needing to repeatedly enter their credentials.

## Schema

```typescript
interface RefreshToken {
  id?: number;
  user_id: number;
  token: string;
  expires_at: Date;
  is_revoked: boolean;
  created_at?: Date;
  updated_at?: Date;
}
```

## Database Table

```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## Methods

- `createRefreshToken`: Generates a new refresh token for a user.
- `findRefreshToken`: Searches for a refresh token using its token string, ensuring it hasn’t been revoked.
- `revokeRefreshToken`: Invalidates a specific refresh token, typically used when a user logs out.
- `revokeAllUserRefreshTokens`: Invalidates all refresh tokens associated with a user, often for security reasons like changing a password.
- `removeExpiredRefreshTokens`: Removes all tokens that have exceeded their expiration date from the database as a maintenance task.
