# Redis Setup for Smart Token Management

## 📋 Overview

This project implements advanced token management using Redis with the following features:

- **JWT ID (jti)** tracking for immediate token revocation
- **Token versioning** for user-wide token invalidation  
- **Device tracking** and session management
- **Refresh token status** in Redis for performance
- **TTL auto-cleanup** to prevent memory leaks

## 🚀 Redis Installation

### Local Development

```bash
# Install Redis on macOS
brew install redis
brew services start redis

# Install Redis on Ubuntu/Debian
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis

# Install Redis on Windows
# Download from: https://redis.io/download
# Or use Docker: docker run -d -p 6379:6379 redis:alpine
```

### Docker Setup

```bash
# Run Redis with Docker
docker run -d \
  --name redis-server \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:alpine

# Redis with password
docker run -d \
  --name redis-server \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:alpine \
  redis-server --requirepass yourpassword
```

## ⚙️ Environment Configuration

Add these variables to your `.env` file:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT Configuration  
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_secure
```

## 📦 Dependencies

Make sure these packages are installed:

```bash
npm install ioredis
npm install jsonwebtoken
npm install uuid
npm install @types/uuid
```

Or add to your `package.json`:

```json
{
  "dependencies": {
    "ioredis": "^5.3.2",
    "jsonwebtoken": "^9.0.2", 
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.7"
  }
}
```

## 🔑 Redis Key Structure

The system uses structured Redis keys:

```
token:jti:{uuid}           # JWT ID storage (TTL: 15 min)
tokens:user:{userId}       # User's active JTIs set
refresh:{tokenId}          # Refresh token status (TTL: 30 days)
```

### Example Redis Data:

```bash
# Active JWT
redis> GET token:jti:abc123-def456-789
{"userId":"user123","tokenVersion":1,"deviceInfo":{"device_name":"Chrome Browser"},"createdAt":"2024-01-26T10:00:00.000Z"}

# User's active tokens
redis> SMEMBERS tokens:user:user123
1) "abc123-def456-789"
2) "def456-789-abc123"

# Refresh token status
redis> GET refresh:token123
{"userId":"user123","isRevoked":false,"updatedAt":"2024-01-26T10:00:00.000Z"}
```

## 🛡️ Security Features Implemented

### 1. **JWT ID (jti) Tracking**
- Every access token has unique UUID
- Stored in Redis with 15-minute TTL
- Immediate revocation capability

### 2. **Cross-Validation Middleware**
```typescript
// 5 layers of validation:
// 1. JWT format validation
// 2. JWT signature verification  
// 3. JTI existence check in Redis
// 4. User existence verification
// 5. Token version matching
```

### 3. **Smart Logout Options**
```bash
# Logout current device (by JTI)
POST /api/users/logout

# Logout all devices (token version bump)
POST /api/users/logout-all  

# Logout specific device by JTI
POST /api/users/logout-device-jti/{jti}

# Logout specific device by token ID
POST /api/users/logout-device/{tokenId}
```

### 4. **Session Management**
```bash
# Get active sessions with JTI tracking
GET /api/users/sessions

# Response includes both Redis (JTI) and DB (refresh) sessions
{
  "data": [
    {
      "id": 0,
      "jti": "abc123-def456-789", 
      "device_name": "Chrome Browser",
      "is_current": true,
      "token_version": 1
    }
  ],
  "meta": {
    "total": 2,
    "current_jti": "abc123-def456-789"
  }
}
```

## 📊 Monitoring & Statistics

### Admin Token Stats
```bash
GET /api/users/token-stats

{
  "redis": {
    "totalJtis": 156,
    "totalRefreshTokens": 89,
    "memoryUsage": "2.1MB"
  },
  "database": {
    "totalRefreshTokens": 234,
    "activeRefreshTokens": 89, 
    "revokedRefreshTokens": 145
  }
}
```

### Redis Monitoring Commands
```bash
# Check Redis status
redis-cli ping

# Monitor Redis operations
redis-cli monitor

# Check memory usage
redis-cli info memory

# See all JTI keys
redis-cli keys "token:jti:*"

# Count active sessions
redis-cli eval "return #redis.call('keys', 'token:jti:*')" 0
```

## 🔄 Token Flow

### Login Process:
1. User authenticates → generates JTI
2. Store JTI in Redis (15min TTL)
3. Create refresh token in DB + Redis
4. Return access token with JTI embedded

### API Request:
1. Extract JWT → decode JTI + version
2. Verify JTI exists in Redis
3. Cross-validate version with user DB
4. Allow/deny request

### Logout Process:
1. **Single device**: Delete JTI from Redis
2. **All devices**: Increment user token_version + clear Redis
3. **Specific device**: Delete target JTI

## 🧹 Cleanup & Maintenance

### Automatic Cleanup:
- Redis TTL auto-expires keys
- No manual cleanup needed for JTIs
- Refresh tokens cleaned by service

### Manual Cleanup:
```bash
# Remove expired tokens (DB)
npm run cleanup:tokens

# Redis memory optimization
redis-cli --latency-history -i 1
```

## 🚨 Troubleshooting

### Common Issues:

1. **Redis Connection Failed**
   ```bash
   # Check Redis is running
   redis-cli ping
   # Should return: PONG
   ```

2. **JTI Not Found Errors**
   ```bash
   # Check if keys exist
   redis-cli keys "token:jti:*"
   ```

3. **High Memory Usage**
   ```bash
   # Check Redis memory
   redis-cli info memory
   
   # Clear test data
   redis-cli flushdb
   ```

4. **Token Version Mismatch**
   - User may need to login again
   - Check user.token_version in database

### Performance Monitoring:
```bash
# Redis slow queries
redis-cli slowlog get 10

# Check connection pool
redis-cli client list
```

## 🔧 Production Configuration

### Redis Production Setup:
```redis.conf
# Memory management
maxmemory 1gb
maxmemory-policy allkeys-lru

# Persistence (optional for tokens)
save ""
appendonly no

# Security
requirepass your_strong_password
bind 127.0.0.1

# Performance
tcp-keepalive 300
timeout 300
```

This setup provides enterprise-level token security with immediate revocation capabilities! 🎯 