import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import crypto from 'crypto';
import { z } from 'zod';
import Redis from 'ioredis';
import { TravelQuerySchema } from './schema';
import { cacheGet, cacheSet, withTimeout } from './cache';
import { LlmFn } from './travelAgent';
import { logger } from './logger';

export interface AppDeps {
  redis: Redis;
  llm: LlmFn;
  disableRateLimit?: boolean;
}

export function createApp(deps: AppDeps): express.Express {
  const { redis, llm } = deps;
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'"],
        },
      },
    })
  );

  app.use(express.json({ limit: '16kb' }));

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) =>
        (req.headers['x-request-id'] as string) ?? crypto.randomUUID(),
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500
          ? 'error'
          : res.statusCode >= 400
            ? 'warn'
            : 'info',
    })
  );

  // Health probe — never fails the app if Redis is down
  app.get('/health', async (_req: Request, res: Response) => {
    const pong = await withTimeout(redis.ping(), 100);
    res.status(pong === 'PONG' ? 200 : 503).json({
      status: pong === 'PONG' ? 'ok' : 'degraded',
      redis: pong === 'PONG' ? 'up' : 'down',
      uptime: Math.floor(process.uptime()),
    });
  });

  const limiter = rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'RATE_LIMITED', message: 'Max 30 requests per minute' },
  });

  app.post(
    '/api/travel-agent',
    deps.disableRateLimit ? (_req, _res, next) => next() : limiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = TravelQuerySchema.parse(req.body);

        const hash = crypto
          .createHash('sha256')
          .update(
            JSON.stringify({
              prompt: body.prompt,
              maxBudgetINR: body.maxBudgetINR ?? null,
            })
          )
          .digest('hex');
        const cacheKey = `prompt:${hash}`;

        const cached = await cacheGet<{ itinerary: string; status: string }>(
          redis,
          cacheKey
        );
        if (cached) {
          req.log.info({ cacheKey }, 'cache_hit');
          return res.status(200).json({ source: 'REDIS_CACHE_HIT', data: cached });
        }

        const result = await llm(body);
        
        // BEST-EFFORT CACHE WRITE:
        // We do not await this. If Redis is down, the user still gets a 200 OK.
        // The .catch() prevents an unhandled promise rejection.
        cacheSet(redis, cacheKey, result, 3600).catch((err) => {
          req.log.warn({ err, cacheKey }, 'cache_set_failed_but_request_succeeded');
        });

        req.log.info({ cacheKey }, 'llm_executed');
        return res.status(200).json({ source: 'LLM_EXECUTION', data: result });
      } catch (err) {
        next(err);
      }
    }
  );

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'NOT_FOUND', path: req.path });
  });

  // Centralized error handler
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const requestId = (req as any).id;

    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        requestId,
        details: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }

    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'INVALID_JSON', requestId });
    }

    // Type assertion for the 'entity.too.large' express parser error
    const expressErr = err as { type?: string };
    if (expressErr?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', requestId });
    }

    req.log?.error({ err }, 'unhandled_error');
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', requestId });
  });

  return app;
}
