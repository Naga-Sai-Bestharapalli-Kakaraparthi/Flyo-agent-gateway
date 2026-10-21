import express from 'express';
import path from 'path';
import { createApp } from './app';
import { createRedisClient } from './cache';
import { mockLlm } from './travelAgent';
import { logger } from './logger';

if (require.main === module) {
  const redis = createRedisClient();
  const app = createApp({ redis, llm: mockLlm });

  // Serve the demo UI
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const PORT = Number(process.env.PORT ?? 3000);
  const server = app.listen(PORT, () =>
    logger.info({ port: PORT }, 'server_listening')
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutdown_initiated');
    server.close();
    await redis.quit().catch(() => redis.disconnect());
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught_exception');
    process.exit(1);
  });
  process.on('unhandledRejection', (err) => {
    logger.error({ err }, 'unhandled_rejection');
  });
}

export { createApp };
