# AEO Diagnostic Backend ⚙️

The high-performance FastAPI engine powering parallel AI search analysis.

## Tech Stack

- **FastAPI** — Modern, high-performance Python framework
- **Pydantic v2** — Strict data validation and schema enforcement
- **Structlog** — Production-grade structured colored logging
- **Tenacity** — Robust exponential backoff retry logic for LLM APIs
- **Cachetools** — 5-minute TTL caching for cost and speed optimization
- **WeasyPrint** — Headless PDF generation from Jinja2 templates

## Core Architecture

- **Parallel Execution:** Uses `asyncio.gather` to trigger GPT-4o, Claude 3.5 Sonnet, and Gemini 1.5 Pro simultaneously.
- **Brand Extraction:** Employs Claude's reasoning to identify and normalize brand names from unstructured AI text.
- **Scoring Engine:** A position-weighted algorithm that calculates visibility based on mention frequency, sentiment, and ranking.
- **Gap Analysis:** Intelligent comparison logic that identifies what top competitors have that your brand lacks.

## API Specification

| Endpoint | Method | Description |
|---|---|---|
| `/api/diagnostic` | `POST` | Primary entry point for running a full AEO scan |
| `/api/health` | `GET` | Connectivity check and API key validation |
| `/api/export/pdf` | `GET` | Exports the last generated result as a PDF |
| `/api/export/pdf-from-result` | `POST` | Stateless PDF generation from a provided JSON result |

## Getting Started

1. **Environment Setup:**
   Create a `.env` file based on `.env.example`:
   ```env
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   GOOGLE_API_KEY=AIza...
   ```

2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run Server:**
   ```bash
   uvicorn main:app --reload --port 8000
   ```

## Resilience

The backend is hardened for production:
- **Timeouts:** 30-second hard cap on engine responses.
- **Graceful Failure:** If one AI engine fails, the system provides a partial report rather than crashing.
- **Structured Logs:**Machine-readable logs for latency tracking and debugging.
