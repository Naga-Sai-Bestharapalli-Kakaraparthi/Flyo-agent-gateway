import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import createRedisClient from 'ioredis';
import crypto from 'crypto';

// 1. Strict Input Schema (Prevents Payload Pollution)
const TravelQuerySchema = z.object({
  prompt: z.string().min(5, "Prompt too short"),
  maxBudgetINR: z.number().positive().optional(),
}).strict(); // Rejects extra or unexpected fields instantly

const app = express();
app.use(express.json());

// Redis Client Setup (Fail-open design)
const redis = new createRedisClient({ lazyConnect: true });

// 2. Gateway Route with Caching & Defensive Error Handling
app.post('/api/travel-agent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Step A: Strict Validation
    const validatedBody = TravelQuerySchema.parse(req.body);

    // Step B: SHA-256 Hashing for O(1) Redis Key Lookup
    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedBody)).digest('hex');
    const cacheKey = `prompt:${hash}`;

    // Step C: Check Cache
    const cachedResponse = await redis.get(cacheKey).catch(() => null); // Fail-open
    if (cachedResponse) {
      return res.status(200).json({ source: 'REDIS_CACHE_HIT', data: JSON.parse(cachedResponse) });
    }

    // Step D: Simulated Execution & Cache Population
    const result = { itinerary: `3-Day Plan for: ${validatedBody.prompt}`, status: "SUCCESS" };
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600).catch(() => null);

    return res.status(200).json({ source: 'LLM_EXECUTION', data: result });
  } catch (error) {
    next(error); // Passes to Centralized Error Middleware
  }
});

// 3. Centralized Async Error Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: "VALIDATION_FAILED", details: err.errors });
  }
  return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "Server shielded" });
});
