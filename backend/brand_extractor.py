"""
brand_extractor.py — Claude-powered NER with retry, validation, and fallback.

Pipeline:
  1. Ask Claude Sonnet to extract brand names as a JSON array
  2. Validate and clean the response
  3. On any failure → regex fallback extractor
  4. Deduplicate and normalise casing
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
You are a brand intelligence analyst. Extract every brand name, product name, \
or company name mentioned in the AI response below.

Rules:
- Include ALL brands, even if mentioned briefly
- Use the exact capitalisation as written (e.g. "Pure Encapsulations", not "pure encapsulations")
- Do NOT include generic words like "supplement", "product", "brand"
- Do NOT include common adjectives like "best", "top", "great"

Response text:
{text}

Return ONLY a valid JSON array of strings. No markdown. No explanation. Example:
["Brand A", "Brand B", "Product X"]
"""


def _validate_and_clean(raw: str, source_text: str) -> list[str]:
    """Parse Claude's JSON response and remove obvious non-brands."""
    raw = re.sub(r"```(?:json)?|```", "", raw).strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract array substring
        m = re.search(r"\[.*?\]", raw, re.DOTALL)
        if m:
            parsed = json.loads(m.group())
        else:
            raise ValueError("No JSON array found")

    if not isinstance(parsed, list):
        raise ValueError("Response is not a list")

    _NOISE = {
        "amazon", "google", "ai", "the", "a", "an", "and", "or",
        "supplement", "product", "brand", "company", "formula",
    }
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
        low = item.lower()
        if low not in seen:
            seen.add(low)
            result.append(item)
    return result[:40]  # cap at 40 brands per response


@retry(
    retry=retry_if_exception_type(Exception),
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    reraise=False,
)
async def _extract_via_claude(text: str) -> list[str]:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"), timeout=20)
    msg = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=512,
        messages=[{"role": "user", "content": _EXTRACTION_PROMPT.format(text=text[:3000])}],
    )
    raw = msg.content[0].text if msg.content else "[]"
    return _validate_and_clean(raw, text)


def _regex_fallback(text: str) -> list[str]:
    """Lightweight regex heuristic for brand extraction when Claude is unavailable."""
    pattern = r"\*{0,2}([A-Z][a-zA-Z']+(?:\s[A-Z][a-zA-Z']+){0,3})\*{0,2}"
    candidates = re.findall(pattern, text)
    _STOP = {
        "When", "For", "The", "This", "These", "That", "They", "Here",
        "With", "From", "And", "But", "Not", "Are", "Has", "Have", "Its",
        "You", "Your", "Also", "Some", "Many", "Best", "Top", "Great",
        "Good", "More", "Most", "Each", "Both", "Such", "Just", "Note",
        "Key", "Very", "Well", "High", "Low", "New", "Old", "One", "Two",
        "First", "Second", "Third", "Last", "Overall", "Final",
    }
    seen: set[str] = set()
    result: list[str] = []
    for c in candidates:
        c = c.strip()
        if c and c not in _STOP and len(c) > 2 and c.lower() not in seen:
            seen.add(c.lower())
            result.append(c)
    return result[:35]


async def extract_brands(ai_response: str) -> list[str]:
    """
    Extract brand names from an AI response text.
    Tries Claude first; falls back to regex on any error.
    """
    if not ai_response or not ai_response.strip():
        return []

    if not os.getenv("ANTHROPIC_API_KEY"):
        log.warning("extract_brands_no_key", method="regex")
        return _regex_fallback(ai_response)

    try:
        brands = await _extract_via_claude(ai_response)
        log.info("extract_brands_done", method="claude", count=len(brands))
        return brands
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
