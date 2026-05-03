"""
ai_caller.py — Robust parallel AI engine caller with tenacity retries.

Features:
  - All 3 engines called concurrently via asyncio.gather()
  - Per-engine timeout (30 s) via asyncio.wait_for()
  - Exponential-back-off retries via tenacity (up to 3 attempts)
  - Structured logging of latency and token usage
  - Graceful degradation: engine failure → error payload, not exception
"""

import asyncio
import os
import time
from typing import Any

from dotenv import load_dotenv
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
    RetryError,
)

from logger import log

load_dotenv()

# ── Shared system prompt ───────────────────────────────────────────────────────
_SYSTEM = (
    "You are a knowledgeable product recommendation assistant for shoppers. "
    "When asked about products, ALWAYS name at least 6-8 specific brands and/or products, "
    "explain why each is recommended, and use clear formatting. "
    "Be specific — generic answers are not helpful."
)

_TIMEOUT_S = 30  # per-engine hard timeout


# ── Retry decorator factory ────────────────────────────────────────────────────
def _make_retry():
    """Return a tenacity retry decorator for transient AI API errors."""
    import openai, anthropic

    transient = (
        openai.RateLimitError,
        openai.APIConnectionError,
        openai.APITimeoutError,
        anthropic.RateLimitError,
        anthropic.APIConnectionError,
        anthropic.APITimeoutError,
        ConnectionError,
        TimeoutError,
    )
    return retry(
        retry=retry_if_exception_type(transient),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )


# ── OpenAI ────────────────────────────────────────────────────────────────────
async def _call_openai_inner(query: str) -> dict[str, Any]:
    import openai

    client = openai.AsyncOpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        timeout=_TIMEOUT_S,
    )
    t0 = time.monotonic()
    resp = await client.chat.completions.create(
        model="gpt-4o",
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
    log.info("openai_done", latency_s=latency, tokens=tokens, chars=len(text))
    return {"engine": "GPT-4o", "text": text, "error": None, "latency_s": latency}


async def call_openai(query: str) -> dict[str, Any]:
    decorated = _make_retry()(_call_openai_inner)
    try:
        return await asyncio.wait_for(decorated(query), timeout=_TIMEOUT_S + 5)
    except RetryError as e:
        log.error("openai_failed_retries", err=str(e))
        return {"engine": "GPT-4o", "text": "", "error": f"Rate limit / retries exhausted: {e}", "latency_s": None}
    except Exception as e:
        log.error("openai_failed", err=str(e))
        return {"engine": "GPT-4o", "text": "", "error": str(e), "latency_s": None}


# ── Anthropic Claude ───────────────────────────────────────────────────────────
async def _call_claude_inner(query: str) -> dict[str, Any]:
    import anthropic

    client = anthropic.AsyncAnthropic(
        api_key=os.getenv("ANTHROPIC_API_KEY"),
        timeout=_TIMEOUT_S,
    )
    t0 = time.monotonic()
    msg = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1400,
        system=_SYSTEM,
        messages=[{"role": "user", "content": query}],
    )
    latency = round(time.monotonic() - t0, 2)
    text = msg.content[0].text if msg.content else ""
    tokens = (msg.usage.input_tokens + msg.usage.output_tokens) if msg.usage else None
    log.info("claude_done", latency_s=latency, tokens=tokens, chars=len(text))
    return {"engine": "Claude Sonnet", "text": text, "error": None, "latency_s": latency}


async def call_claude(query: str) -> dict[str, Any]:
    decorated = _make_retry()(_call_claude_inner)
    try:
        return await asyncio.wait_for(decorated(query), timeout=_TIMEOUT_S + 5)
    except RetryError as e:
        log.error("claude_failed_retries", err=str(e))
        return {"engine": "Claude Sonnet", "text": "", "error": f"Rate limit / retries exhausted: {e}", "latency_s": None}
    except Exception as e:
        log.error("claude_failed", err=str(e))
        return {"engine": "Claude Sonnet", "text": "", "error": str(e), "latency_s": None}


# ── Google Gemini ──────────────────────────────────────────────────────────────
async def _call_gemini_inner(query: str) -> dict[str, Any]:
    import google.generativeai as genai
    from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable

    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
    model = genai.GenerativeModel(
        model_name="gemini-1.5-pro",
        system_instruction=_SYSTEM,
    )
    t0 = time.monotonic()
    loop = asyncio.get_event_loop()

    def _sync_call():
        return model.generate_content(
            query,
            generation_config={"max_output_tokens": 1400, "temperature": 0.7},
            request_options={"timeout": _TIMEOUT_S},
        )

    resp = await loop.run_in_executor(None, _sync_call)
    latency = round(time.monotonic() - t0, 2)
    text = resp.text if hasattr(resp, "text") else ""
    log.info("gemini_done", latency_s=latency, chars=len(text))
    return {"engine": "Gemini 1.5 Pro", "text": text, "error": None, "latency_s": latency}


async def call_gemini(query: str) -> dict[str, Any]:
    decorated = _make_retry()(_call_gemini_inner)
    try:
        return await asyncio.wait_for(decorated(query), timeout=_TIMEOUT_S + 5)
    except RetryError as e:
        log.error("gemini_failed_retries", err=str(e))
        return {"engine": "Gemini 1.5 Pro", "text": "", "error": f"Rate limit / retries exhausted: {e}", "latency_s": None}
    except Exception as e:
        log.error("gemini_failed", err=str(e))
        return {"engine": "Gemini 1.5 Pro", "text": "", "error": str(e), "latency_s": None}


# ── Parallel orchestrator ──────────────────────────────────────────────────────
async def call_all_engines(query: str) -> list[dict[str, Any]]:
    """
    Fire all three AI engines concurrently.
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
