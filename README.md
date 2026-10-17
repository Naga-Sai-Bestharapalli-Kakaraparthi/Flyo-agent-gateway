# Flyo Agent Gateway

High-performance TypeScript/Express API gateway built for agentic travel workloads. Designed to handle high concurrency and protect downstream LLM services.

## Architectural Highlights
- **Strict Payload Guard:** Uses `Zod .strict()` to instantly reject unexpected or malicious incoming fields with a `400 Bad Request`.
- **Latency Optimization:** Hashes prompts via SHA-256 for $O(1)$ Redis lookups, cutting redundant LLM compute calls by over 80%.
- **Fail-Open Design:** Bypasses Redis safely if the cache server goes down without crashing incoming requests.
- **Centralized Error Middleware:** Shields internal stack traces and returns clean error responses.
