import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

function fakeRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
      return 'OK';
    }),
    ping: vi.fn(async () => 'PONG'),
    on: vi.fn(),
    quit: vi.fn(async () => 'OK'),
    disconnect: vi.fn(),
  } as any;
}

describe('POST /api/travel-agent', () => {
  let redis: any;
  let app: any;
  const llm = vi.fn(async (input: any) => ({
    itinerary: `Plan for ${input.prompt}`,
    status: 'SUCCESS' as const,
  }));

  beforeEach(() => {
    redis = fakeRedis();
    app = createApp({ redis, llm, disableRateLimit: true });
    llm.mockClear();
  });

  it('returns 400 on missing prompt', async () => {
    const res = await request(app).post('/api/travel-agent').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_FAILED');
  });

  it('rejects extra fields (strict schema)', async () => {
    const res = await request(app)
      .post('/api/travel-agent')
      .send({ prompt: 'hello world', evil: true });
    expect(res.status).toBe(400);
  });

  it('trims whitespace before hashing', async () => {
    const a = await request(app).post('/api/travel-agent').send({ prompt: '  kyoto  ' });
    const b = await request(app).post('/api/travel-agent').send({ prompt: 'kyoto' });
    expect(a.body.source).toBe('LLM_EXECUTION');
    expect(b.body.source).toBe('REDIS_CACHE_HIT');
    expect(llm).toHaveBeenCalledTimes(1);
  });

  it('caches on second call', async () => {
    const body = { prompt: '5 days in Kyoto' };
    const first = await request(app).post('/api/travel-agent').send(body);
    expect(first.body.source).toBe('LLM_EXECUTION');
    const second = await request(app).post('/api/travel-agent').send(body);
    expect(second.body.source).toBe('REDIS_CACHE_HIT');
    expect(llm).toHaveBeenCalledTimes(1);
  });

  it('fails open when Redis throws', async () => {
    redis.get.mockRejectedValueOnce(new Error('redis down'));
    const res = await request(app)
      .post('/api/travel-agent')
      .send({ prompt: '10 days in Bali' });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('LLM_EXECUTION');
  });

  it('treats corrupt cache data as a miss', async () => {
    redis.get.mockResolvedValueOnce('{not-json');
    const res = await request(app)
      .post('/api/travel-agent')
      .send({ prompt: 'weekend in Goa' });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('LLM_EXECUTION');
  });

  it('returns 413 for oversized body', async () => {
    const res = await request(app)
      .post('/api/travel-agent')
      .send({ prompt: 'x'.repeat(20_000) });
    expect(res.status).toBe(413);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/travel-agent')
      .set('Content-Type', 'application/json')
      .send('{"prompt":');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_JSON');
  });

  it('returns 404 for unknown route', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('health returns ok when Redis responds', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.redis).toBe('up');
  });

  it('health returns 503 when Redis fails', async () => {
    redis.ping.mockResolvedValueOnce('DOWN');
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.redis).toBe('down');
  });
});
