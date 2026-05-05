"""
brand_extractor.py — OpenRouter-powered NER with retry, validation, and fallback.

Pipeline:
  1. Ask Claude (via OpenRouter) to extract brand names as a JSON array
  2. Validate and clean the response
  3. On network/rate-limit failure → retry (tenacity)
  4. On JSON parse failure → immediate regex fallback (no useless retry)
  5. Deduplicate and normalise casing
"""

import asyncio
import json
import os
import re
from typing import Any

from dotenv import load_dotenv
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from logger import log

load_dotenv()

_EXTRACTION_PROMPT = """\
You are a brand intelligence analyst. Extract ONLY company and brand names from the AI response below.

STRICT RULES — read carefully:
- Extract ONLY the parent brand/company name (e.g. "Samsung", "Apple", "Motorola")
- Do NOT include specific product model names (e.g. NOT "iPhone 18 Pro Max", NOT "Galaxy S26 Ultra", NOT "Edge 60 Ultra")
- Do NOT include operating systems or software platforms (e.g. NOT "OxygenOS", NOT "iOS", NOT "Android")
- Do NOT include chip/processor names (e.g. NOT "A20 Pro", NOT "Snapdragon", NOT "Dimensity")
- Do NOT include generic words like "supplement", "product", "brand", "series", "lineup"
- Do NOT include common adjectives like "best", "top", "great", "premium"
- Use the exact capitalisation as written (e.g. "Pure Encapsulations", not "pure encapsulations")
- If unsure whether something is a brand or a product model, EXCLUDE it

GOOD examples: ["Apple", "Samsung", "Motorola", "Google", "OnePlus", "Sony", "Xiaomi"]
BAD examples: ["iPhone 18 Pro Max", "Galaxy S26", "OxygenOS", "A20 Pro", "Snapdragon 8 Elite"]

Response text:
{text}

Return ONLY a valid JSON array of brand/company name strings. No markdown. No explanation.
"""

# Model for extraction — lighter model is fine here, saves cost
_EXTRACT_MODEL = os.getenv("MODEL_EXTRACT", "mistralai/mistral-7b-instruct:free")
_OPENROUTER_BASE = "https://openrouter.ai/api/v1"


def _get_client():
    """Singleton-style OpenRouter client for brand extraction."""
    import openai
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY not set")
    return openai.AsyncOpenAI(
        api_key=api_key,
        base_url=_OPENROUTER_BASE,
        default_headers={
            "HTTP-Referer": os.getenv("SITE_URL", "http://localhost:5173"),
            "X-Title": os.getenv("SITE_NAME", "AEO Diagnostic"),
        },
        timeout=20,
    )


def _validate_and_clean(raw: str) -> list[str]:
    """Parse JSON response and remove obvious non-brands. Raises on parse failure."""
    raw = re.sub(r"```(?:json)?|```", "", raw).strip()
    # Try direct parse first
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract array substring before giving up
        m = re.search(r"\[.*?\]", raw, re.DOTALL)
        if m:
            parsed = json.loads(m.group())
        else:
            raise ValueError("No JSON array found in response")

    if not isinstance(parsed, list):
        raise ValueError("Response is not a JSON list")

    # Known non-brand noise words
    _NOISE = {
        "amazon", "google", "ai", "the", "a", "an", "and", "or",
        "supplement", "product", "brand", "company", "formula",
        # OS / software platforms
        "oxygenos", "ios", "android", "hyperos", "one ui", "miui",
        "harmonyos", "coloros", "funtouch", "magicos",
        # Generic tech terms
        "series", "lineup", "edition", "ultra", "pro", "max", "plus",
        "flagship", "premium", "tier", "chip", "processor",
    }

    # Pattern: likely a product model name if it contains digits or
    # looks like "Brand Model123" — filter these out
    _MODEL_PATTERN = re.compile(
        r'\b(?:'
        r'\d+'           # contains digits (e.g. "S26", "18 Pro", "A20")
        r'|(?:pro|max|ultra|plus|mini|lite|edge|note|fold|flip)\s*\d*'  # model suffixes
        r')\b',
        re.IGNORECASE
    )

    result: list[str] = []
    seen: set[str] = set()
    for item in parsed:
        if not isinstance(item, str):
            continue
        item = item.strip()
        if not item or len(item) < 2:
            continue
        if item.lower() in _NOISE:
            continue
        # Skip anything that looks like a product model name
        if _MODEL_PATTERN.search(item):
            continue
        low = item.lower()
        if low not in seen:
            seen.add(low)
            result.append(item)
    return result[:40]  # cap at 40 brands per response


# ── Retry only on transient network/rate-limit errors ─────────────────────────
def _transient_retry():
    import openai, httpx
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
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=4),
        reraise=True,
    )


async def _extract_via_openrouter(text: str) -> list[str]:
    """Call OpenRouter to extract brands. Separates network errors from parse errors."""
    client = _get_client()

    @_transient_retry()
    async def _fetch() -> str:
        resp = await client.chat.completions.create(
            model=_EXTRACT_MODEL,
            max_tokens=300,  # brand list is short, 300 is plenty
            messages=[{"role": "user", "content": _EXTRACTION_PROMPT.format(text=text[:2000])}],
        )
        return resp.choices[0].message.content or "[]"

    raw = await _fetch()
    # JSON parse failure is NOT retried — Claude will return the same output again
    return _validate_and_clean(raw)


def _regex_fallback(text: str) -> list[str]:
    """Lightweight regex heuristic for brand extraction when AI is unavailable."""
    pattern = r"\*{0,2}([A-Z][a-zA-Z']+(?:\s[A-Z][a-zA-Z']+){0,2})\*{0,2}"
    candidates = re.findall(pattern, text)
    _STOP = {
        "When", "For", "The", "This", "These", "That", "They", "Here",
        "With", "From", "And", "But", "Not", "Are", "Has", "Have", "Its",
        "You", "Your", "Also", "Some", "Many", "Best", "Top", "Great",
        "Good", "More", "Most", "Each", "Both", "Such", "Just", "Note",
        "Key", "Very", "Well", "High", "Low", "New", "Old", "One", "Two",
        "First", "Second", "Third", "Last", "Overall", "Final",
        # OS / platform names to exclude
        "OxygenOS", "HarmonyOS", "ColorOS", "HyperOS", "FunTouch",
    }
    # Filter out strings containing digits (product model numbers)
    _has_digit = re.compile(r'\d')
    seen: set[str] = set()
    result: list[str] = []
    for c in candidates:
        c = c.strip()
        if not c or c in _STOP or len(c) <= 2:
            continue
        if _has_digit.search(c):  # skip "iPhone 18", "Galaxy S26", "A20 Pro"
            continue
        if c.lower() not in seen:
            seen.add(c.lower())
            result.append(c)
    return result[:35]


async def extract_brands(ai_response: str) -> list[str]:
    """
    Extract brand names from an AI response text.
    Tries OpenRouter first; falls back to regex on any error.
    """
    if not ai_response or not ai_response.strip():
        return []

    if not os.getenv("OPENROUTER_API_KEY"):
        log.warning("extract_brands_no_key", method="regex")
        return _regex_fallback(ai_response)

    try:
        brands = await _extract_via_openrouter(ai_response)
        log.info("extract_brands_done", method="openrouter", count=len(brands))
        return brands
    except (ValueError, json.JSONDecodeError) as e:
        # JSON parse error — don't retry, go straight to fallback
        log.warning("extract_brands_parse_error", err=str(e), method="regex")
        return _regex_fallback(ai_response)
    except Exception as e:
        log.warning("extract_brands_fallback", err=str(e), method="regex")
        return _regex_fallback(ai_response)


async def extract_brands_parallel(responses: list[dict]) -> list[str]:
    """
    Extract brands from all engine responses in parallel.
    Returns a flat, deduplicated list of brand names.
    """
    tasks = [extract_brands(r.get("text", "")) for r in responses]
    results = await asyncio.gather(*tasks, return_exceptions=False)

    seen: set[str] = set()
    all_brands: list[str] = []
    for brand_list in results:
        for brand in brand_list:
            if brand.lower() not in seen:
                seen.add(brand.lower())
                all_brands.append(brand)
    log.info("brands_total", count=len(all_brands))
    return all_brands
