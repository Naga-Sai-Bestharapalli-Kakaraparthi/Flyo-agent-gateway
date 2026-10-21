# LLM Gateway Resilience

A hardened Express + Redis gateway for LLM-backed APIs. Demonstrates production patterns that keep an API up when Redis is slow, unreachable, or returning garbage.

## What it does

- **Strict validation** — Zod `strict()` schema rejects extra fields; input is trimmed and bounded (5–2000 chars, ≤16kb body).
- **Deterministic caching** — SHA-256 of the normalized input → Redis key. Same prompt twice = one LLM call.
- **Fail-open Redis** — Every Redis command is raced against a 300ms timeout. If Redis is slow or down, the request falls through to the LLM instead of hanging.
- **Corrupt-cache safety** — Invalid JSON in Redis is treated as a miss, not a 500.
- **Structured logs** — pino with secret redaction and per-request `requestId`.
- **Security headers** — helmet with a CSP tuned for the included demo UI.
- **Rate limiting** — 30 req/min on the LLM route.
- **Graceful shutdown** — SIGTERM/SIGINT drain in-flight requests and quit Redis.

## Run locally

```bash
cp .env.example .env
npm install
# start a local Redis (or point REDIS_URL at one)
docker run -d -p 6379:6379 redis:7-alpine
npm run dev
# open http://localhost:3000
