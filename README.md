# Polyglot AI Gateway (TypeScript + Python)

A hardened Node/Express gateway paired with a Python/FastAPI AI microservice. Demonstrates production AI engineering patterns: fail-open Redis caching, strict schema validation (Zod + Pydantic), and rate limiting.

## Architecture
1. **API Gateway (TypeScript/Express):** Handles rate limiting, caching, security (Helmet), and request tracing.
2. **AI Agent Service (Python/FastAPI):** Handles the GenAI orchestration and prompt execution.

## What it does (The "Why")
- **Multi-Language Microservices:** Proves ability to bridge Node.js API routing with Python AI logic.
- **Strict Validation:** Zod on the TS side, Pydantic on the Python side.
- **Fail-Open Redis:** If Redis dies, the gateway bypasses the cache and calls the Python AI service directly.
- **Corrupt-Cache Safety:** Invalid JSON in Redis is treated as a miss, not a 500 error.

## How to run locally

**1. Start Redis:**
`docker run -d -p 6379:6379 redis:7-alpine`

**2. Start Python AI Service:**
```bash
cd ai_service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000
