import Redis from 'ioredis';

let redisConnection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  return redisConnection;
}

export { redisConnection };
