# AEO Diagnostic Backend

This FastAPI backend serves as the orchestration layer for the AEO (Answer Engine Optimization) diagnostic tool. It acts as a unified proxy to OpenRouter, querying multiple LLM endpoints simultaneously, processing their outputs, and determining brand visibility rankings.

## Architecture & Engineering
- **Unified Gateway**: We use OpenRouter instead of fragmented provider SDKs (OpenAI, Anthropic, Google). This drastically reduces dependency bloat and provides a single billing and rate-limit surface.
- **Connection Pooling**: Uses the `openai` SDK's `AsyncOpenAI` client as a singleton. This maintains persistent TCP connections via `httpx`, eliminating the latency overhead of establishing new TLS handshakes for every API call.
- **Resilience**: 
  - Transient HTTP/Timeout errors are wrapped in `tenacity` exponential backoff retries.
  - JSON Parsing errors do not crash the engine; they gracefully degrade and return standard error payloads back to the client.
- **Scoring Engine**: Implements `rapidfuzz` for robust Named Entity Recognition (NER). If a brand is "Doctor's Best" but an LLM outputs "Doctors Best", it is still correctly scored. We also implemented ordinal list scoring (e.g. `1.`, `2.`, `3.`) to accurately map AI recommendations to RAG thresholds.
- **Security**: 
  - `slowapi` rate limits incoming requests by IP to prevent quota theft.
  - Strict CORS validation (`CORS_ORIGINS`).
  - Jinja2 `autoescape=True` for PDF exports prevents XSS/template injection.

## Environment Variables
See `.env.example` for required variables. The critical ones are:
- `OPENROUTER_API_KEY`: Required.
- `CORS_ORIGINS`: Comma separated list of allowed origins.

## Running Locally
```bash
pip install -r requirements.txt
uvicorn main:app --reload
```
