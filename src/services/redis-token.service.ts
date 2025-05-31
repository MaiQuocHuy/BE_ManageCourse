import { v4 as uuidv4 } from 'uuid';
import RedisClient from '../config/redis';
import { Redis } from 'ioredis';

/**
 * Redis Token Store Service
 * Manages JWT IDs (jti) for immediate token revocation
 * Uses centralized Redis connection from RedisClient
 */
class RedisTokenService {
  private redis: Redis;

  constructor() {
    this.redis = RedisClient.getInstance();
  }

  // Key naming conventions
  private getJtiKey(jti: string): string {
    return `token:jti:${jti}`;
  }

  private getUserTokensKey(userId: string): string {
    return `tokens:user:${userId}`;
  }

  private getRefreshTokenKey(tokenId: string): string {
    return `refresh:${tokenId}`;
  }

  /**
   * Generate unique JWT ID
   */
  generateJti(): string {
    return uuidv4();
  }

  /**
   * Store JWT ID in Redis with TTL
   * @param jti - JWT ID
   * @param userId - User ID
   * @param tokenVersion - Token version
   * @param deviceInfo - Device information
   * @param ttlSeconds - TTL in seconds (should match access token expiry)
   */
  async storeJti(
    jti: string,
    userId: string,
    tokenVersion: number,
    deviceInfo?: any,
    ttlSeconds: number = 900 // 15 minutes default
  ): Promise<void> {
    try {
      const jtiKey = this.getJtiKey(jti);
      const userTokensKey = this.getUserTokensKey(userId);

      const tokenData = {
        userId,
        tokenVersion,
        deviceInfo: deviceInfo || {},
        createdAt: new Date().toISOString(),
      };

      // Use pipeline for atomic operations
      const pipeline = this.redis.pipeline();

      // Store JTI with TTL
      pipeline.setex(jtiKey, ttlSeconds, JSON.stringify(tokenData));

      // Add JTI to user's token set with TTL
      pipeline.sadd(userTokensKey, jti);
      pipeline.expire(userTokensKey, ttlSeconds + 60); // Extra 60s buffer

      await pipeline.exec();

      console.log(`JTI stored: ${jti} for user: ${userId}, TTL: ${ttlSeconds}s`);
    } catch (error) {
      console.error('Error storing JTI:', error);
      throw error;
    }
  }

  /**
   * Verify if JTI exists and is valid
   * @param jti - JWT ID to verify
   * @returns Token data if valid, null if invalid/expired
   */
  async verifyJti(jti: string): Promise<{
    userId: string;
    tokenVersion: number;
    deviceInfo: any;
    createdAt: string;
  } | null> {
    try {
      const jtiKey = this.getJtiKey(jti);
      const data = await this.redis.get(jtiKey);

      if (!data) {
        return null; // JTI not found or expired
      }

      return JSON.parse(data);
    } catch (error) {
      console.error('Error verifying JTI:', error);
      return null;
    }
  }

  /**
   * Revoke specific JTI (logout single device)
   * @param jti - JWT ID to revoke
   * @param userId - User ID (for cleanup)
   */
  async revokeJti(jti: string, userId?: string): Promise<void> {
    try {
      const jtiKey = this.getJtiKey(jti);

      const pipeline = this.redis.pipeline();
      pipeline.del(jtiKey);

      if (userId) {
        const userTokensKey = this.getUserTokensKey(userId);
        pipeline.srem(userTokensKey, jti);
      }

      await pipeline.exec();
      console.log(`JTI revoked: ${jti}`);
    } catch (error) {
      console.error('Error revoking JTI:', error);
      throw error;
    }
  }

  /**
   * Revoke all JTIs for a user (logout all devices)
   * @param userId - User ID
   */
  async revokeAllUserJtis(userId: string): Promise<void> {
    try {
      const userTokensKey = this.getUserTokensKey(userId);

      // Get all JTIs for the user
      const jtis = await this.redis.smembers(userTokensKey);

      if (jtis.length > 0) {
        const pipeline = this.redis.pipeline();

        // Delete all JTI keys
        jtis.forEach(jti => {
          pipeline.del(this.getJtiKey(jti));
        });

        // Delete user tokens set
        pipeline.del(userTokensKey);

        await pipeline.exec();
        console.log(`All JTIs revoked for user: ${userId}, count: ${jtis.length}`);
      }
    } catch (error) {
      console.error('Error revoking all user JTIs:', error);
      throw error;
    }
  }

  /**
   * Store refresh token status in Redis
   * @param refreshTokenId - Refresh token ID
   * @param userId - User ID
   * @param isRevoked - Revocation status
   * @param ttlSeconds - TTL in seconds
   */
  async storeRefreshTokenStatus(
    refreshTokenId: string,
    userId: string,
    isRevoked: boolean = false,
    ttlSeconds: number = 2592000 // 30 days default
  ): Promise<void> {
    try {
      const key = this.getRefreshTokenKey(refreshTokenId);
      const data = {
        userId,
        isRevoked,
        updatedAt: new Date().toISOString(),
      };

      await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
    } catch (error) {
      console.error('Error storing refresh token status:', error);
      throw error;
    }
  }

  /**
   * Check if refresh token is revoked
   * @param refreshTokenId - Refresh token ID
   * @returns true if revoked, false if valid, null if not found
   */
  async isRefreshTokenRevoked(refreshTokenId: string): Promise<boolean | null> {
    try {
      const key = this.getRefreshTokenKey(refreshTokenId);
      const data = await this.redis.get(key);

      if (!data) {
        return null; // Token not found in Redis
      }

      const tokenData = JSON.parse(data);
      return tokenData.isRevoked;
    } catch (error) {
      console.error('Error checking refresh token status:', error);
      return null;
    }
  }

  /**
   * Revoke refresh token in Redis
   * @param refreshTokenId - Refresh token ID
   */
  async revokeRefreshToken(refreshTokenId: string): Promise<void> {
    try {
      const key = this.getRefreshTokenKey(refreshTokenId);
      const data = await this.redis.get(key);

      if (data) {
        const tokenData = JSON.parse(data);
        tokenData.isRevoked = true;
        tokenData.revokedAt = new Date().toISOString();

        // Keep the revoked status with original TTL
        const ttl = await this.redis.ttl(key);
        if (ttl > 0) {
          await this.redis.setex(key, ttl, JSON.stringify(tokenData));
        } else {
          await this.redis.set(key, JSON.stringify(tokenData));
        }
      }
    } catch (error) {
      console.error('Error revoking refresh token:', error);
      throw error;
    }
  }

  /**
   * Get active sessions for a user
   * @param userId - User ID
   * @returns List of active JTIs with their data
   */
  async getUserActiveSessions(userId: string): Promise<
    Array<{
      jti: string;
      tokenVersion: number;
      deviceInfo: any;
      createdAt: string;
    }>
  > {
    try {
      const userTokensKey = this.getUserTokensKey(userId);
      const jtis = await this.redis.smembers(userTokensKey);

      if (jtis.length === 0) {
        return [];
      }

      const pipeline = this.redis.pipeline();
      jtis.forEach(jti => {
        pipeline.get(this.getJtiKey(jti));
      });

      const results = await pipeline.exec();
      const sessions: Array<any> = [];

      results?.forEach((result, index) => {
        if (result && result[1]) {
          try {
            const data = JSON.parse(result[1] as string);
            sessions.push({
              jti: jtis[index],
              ...data,
            });
          } catch (e) {
            console.error('Error parsing session data:', e);
          }
        }
      });

      return sessions;
    } catch (error) {
      console.error('Error getting user active sessions:', error);
      return [];
    }
  }

  /**
   * Cleanup expired tokens (manual cleanup - Redis TTL handles this automatically)
   * This is mainly for monitoring purposes
   */
  async cleanupExpiredTokens(): Promise<{
    cleanedJtis: number;
    cleanedRefreshTokens: number;
  }> {
    try {
      let cleanedJtis = 0;
      let cleanedRefreshTokens = 0;

      // Scan for JTI keys
      const jtiStream = this.redis.scanStream({
        match: 'token:jti:*',
        count: 100,
      });

      jtiStream.on('data', async keys => {
        for (const key of keys) {
          const ttl = await this.redis.ttl(key);
          if (ttl === -2) {
            // Key expired and deleted
            cleanedJtis++;
          }
        }
      });

      // Scan for refresh token keys
      const refreshStream = this.redis.scanStream({
        match: 'refresh:*',
        count: 100,
      });

      refreshStream.on('data', async keys => {
        for (const key of keys) {
          const ttl = await this.redis.ttl(key);
          if (ttl === -2) {
            // Key expired and deleted
            cleanedRefreshTokens++;
          }
        }
      });

      return { cleanedJtis, cleanedRefreshTokens };
    } catch (error) {
      console.error('Error during cleanup:', error);
      return { cleanedJtis: 0, cleanedRefreshTokens: 0 };
    }
  }

  /**
   * Get Redis connection stats for monitoring
   */
  async getStats(): Promise<{
    totalJtis: number;
    totalRefreshTokens: number;
    memoryUsage: string;
  }> {
    try {
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown';

      // Count JTIs
      const jtiKeys = (await this.redis.eval(
        `
        local keys = redis.call('KEYS', 'token:jti:*')
        return #keys
      `,
        0
      )) as number;

      // Count refresh tokens
      const refreshKeys = (await this.redis.eval(
        `
        local keys = redis.call('KEYS', 'refresh:*')
        return #keys
      `,
        0
      )) as number;

      return {
        totalJtis: jtiKeys,
        totalRefreshTokens: refreshKeys,
        memoryUsage,
      };
    } catch (error) {
      console.error('Error getting Redis stats:', error);
      return {
        totalJtis: 0,
        totalRefreshTokens: 0,
        memoryUsage: 'Error',
      };
    }
  }

  /**
   * Check Redis connection status
   */
  async isConnected(): Promise<boolean> {
    return RedisClient.isRedisConnected();
  }
}

export default new RedisTokenService();
