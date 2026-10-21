import Redis from 'ioredis';
import { logger } from './logger';

export const REDIS_TIMEOUT_MS = 300;

export function createRedisClient(
  url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'
): Redis {
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 100, 2000),
  });

  client.on('error', (err) => logger.error({ err: err.message }, 'redis_error'));
  client.on('connect', () => logger.info('redis_connected'));
  client.on('reconnecting', (ms) => logger.warn({ in: ms }, 'redis_reconnecting'));

  return client;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  const guarded = promise.catch((err) => {
    logger.debug({ err: (err as Error).message }, 'redis_command_failed');
    return null;
  });
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));
  return Promise.race([guarded, timeout]);
}

export async function cacheGet<T>(redis: Redis, key: string): Promise<T | null> {
  const raw = await withTimeout(redis.get(key), REDIS_TIMEOUT_MS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn({ err: (err as Error).message, key }, 'cache_corrupt_entry');
    return null;
  }
}

export async function cacheSet<T>(
  redis: Redis,
  key: string,
  val: T,
  ttl = 3600
): Promise<void> {
  await withTimeout(redis.set(key, JSON.stringify(val), 'EX', ttl), REDIS_TIMEOUT_MS);
}
