import Redis from 'ioredis';
import { config } from 'dotenv';

config();

class RedisClient {
  private static instance: Redis | null = null;
  private static isConnected: boolean = false;

  /**
   * Get Redis instance (Singleton pattern)
   */
  public static getInstance(): Redis {
    if (!RedisClient.instance) {
      RedisClient.instance = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        lazyConnect: true,
      });

      RedisClient.instance.on('connect', () => {
        console.log('✅ Redis connected successfully');
        RedisClient.isConnected = true;
      });

      RedisClient.instance.on('error', (error: any) => {
        console.error('❌ Redis connection error:', error);
        RedisClient.isConnected = false;
      });

      RedisClient.instance.on('close', () => {
        console.log('🔌 Redis connection closed');
        RedisClient.isConnected = false;
      });
    }

    return RedisClient.instance;
  }

  /**
   * Check if Redis is connected
   */
  public static isRedisConnected(): boolean {
    return RedisClient.isConnected;
  }

  /**
   * Close Redis connection
   */
  public static async disconnect(): Promise<void> {
    if (RedisClient.instance) {
      await RedisClient.instance.quit();
      RedisClient.instance = null;
      RedisClient.isConnected = false;
    }
  }

  /**
   * Test Redis connection
   */
  public static async testConnection(): Promise<boolean> {
    try {
      const redis = RedisClient.getInstance();
      await redis.ping();
      return true;
    } catch (error) {
      console.error('Redis connection test failed:', error);
      return false;
    }
  }
}

export default RedisClient;
