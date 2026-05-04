"""
ai_caller.py — OpenRouter-backed parallel AI engine caller.

All three engines (GPT-4o, Claude, Gemini) are called via a single
OpenRouter endpoint using the OpenAI-compatible API.  This eliminates
the need for separate OpenAI / Anthropic / Google API keys.

Features:
  - Single AsyncOpenAI client (singleton) pointed at OpenRouter
  - All 3 engines called concurrently via asyncio.gather()
  - Per-engine timeout (30 s) via asyncio.wait_for()
  - Exponential-back-off retries for transient errors only (tenacity)
  - Structured logging of latency
  - Graceful degradation: engine failure → error payload, not exception
"""

import asyncio
import os
import time
from typing import Any

import httpx
from dotenv import load_dotenv
from tenacity import (
    RetryError,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from logger import log

load_dotenv()

# ── Config ─────────────────────────────────────────────────────────────────────
_TIMEOUT_S = 30  # per-engine hard timeout

# Model identifiers — overridable via env vars for easy future updates
_MODEL_GPT    = os.getenv("MODEL_GPT",    "openai/gpt-4o")
_MODEL_CLAUDE = os.getenv("MODEL_CLAUDE", "anthropic/claude-sonnet-4-5")
_MODEL_GEMINI = os.getenv("MODEL_GEMINI", "google/gemini-pro-latest")

_OPENROUTER_BASE = "https://openrouter.ai/api/v1"

# ── Shared system prompt ───────────────────────────────────────────────────────
_SYSTEM = (
    "You are a knowledgeable product recommendation assistant for shoppers. "
    "When asked about products, ALWAYS name at least 6-8 specific brands and/or products, "
    "explain why each is recommended, and use clear formatting. "
    "Be specific — generic answers are not helpful."
)

# ── Singleton async HTTP client via openai SDK ─────────────────────────────────
# Initialised once at module level — avoids per-request TCP handshakes.
def _get_client():
    """Return a lazily-initialised AsyncOpenAI client for OpenRouter."""
    import openai
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set in environment / .env")
    return openai.AsyncOpenAI(
        api_key=api_key,
        base_url=_OPENROUTER_BASE,
        default_headers={
            "HTTP-Referer": os.getenv("SITE_URL", "http://localhost:5173"),
            "X-Title": os.getenv("SITE_NAME", "AEO Diagnostic"),
        },
        timeout=_TIMEOUT_S,
    )


# ── Retry decorator — transient errors only ────────────────────────────────────
def _make_retry():
    """Retry only on network/timeout errors, NOT on JSON or auth errors."""
    import openai
    transient = (
        openai.RateLimitError,
        openai.APIConnectionError,
        openai.APITimeoutError,
        httpx.ConnectError,
        httpx.TimeoutException,
        ConnectionError,
        TimeoutError,
    )
    return retry(
        retry=retry_if_exception_type(transient),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )


# ── Internal engine caller ─────────────────────────────────────────────────────
async def _call_engine_inner(
    model: str,
    engine_label: str,
    query: str,
) -> dict[str, Any]:
    """Call a single OpenRouter model and return a standardised response dict."""
    client = _get_client()
    t0 = time.monotonic()
    resp = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": query},
        ],
        max_tokens=1400,
        temperature=0.7,
    )
    latency = round(time.monotonic() - t0, 2)
    text = resp.choices[0].message.content or ""
    tokens = resp.usage.total_tokens if resp.usage else None
    log.info("engine_done", engine=engine_label, latency_s=latency, tokens=tokens, chars=len(text))
    return {"engine": engine_label, "text": text, "error": None, "latency_s": latency}


async def _call_engine(
    model: str,
    engine_label: str,
    query: str,
) -> dict[str, Any]:
    """Wrap _call_engine_inner with retry + timeout + error shielding."""
    decorated = _make_retry()(lambda q: _call_engine_inner(model, engine_label, q))
    try:
        return await asyncio.wait_for(decorated(query), timeout=_TIMEOUT_S + 5)
    except RetryError as e:
        log.error("engine_failed_retries", engine=engine_label, err=str(e))
        return {"engine": engine_label, "text": "", "error": f"Rate limit / retries exhausted: {e}", "latency_s": None}
    except asyncio.TimeoutError:
        log.error("engine_timeout", engine=engine_label)
        return {"engine": engine_label, "text": "", "error": "Request timed out", "latency_s": None}
    except Exception as e:
        log.error("engine_failed", engine=engine_label, err=str(e))
        return {"engine": engine_label, "text": "", "error": str(e), "latency_s": None}


# ── Public per-engine callers (kept for backward compatibility) ────────────────
async def call_openai(query: str) -> dict[str, Any]:
    return await _call_engine(_MODEL_GPT, "GPT-4o", query)


async def call_claude(query: str) -> dict[str, Any]:
    return await _call_engine(_MODEL_CLAUDE, "Claude Sonnet", query)


async def call_gemini(query: str) -> dict[str, Any]:
    return await _call_engine(_MODEL_GEMINI, "Gemini Pro Latest", query)


# ── Parallel orchestrator ──────────────────────────────────────────────────────
async def call_all_engines(query: str) -> list[dict[str, Any]]:
    """
    Fire all three AI engines concurrently via OpenRouter.
    Returns list[{engine, text, error, latency_s}].
    Never raises — engine errors are embedded in the payload.
    """
    log.info("engines_start", query=query[:80])
    t0 = time.monotonic()
    results = await asyncio.gather(
        call_openai(query),
        call_claude(query),
        call_gemini(query),
        return_exceptions=False,
    )
    total = round(time.monotonic() - t0, 2)
    successful = sum(1 for r in results if not r.get("error"))
    log.info("engines_done", total_s=total, successful=successful, total=len(results))
    return list(results)
