"""
gap_analyser.py — OpenRouter-powered competitive gap analysis with retry.

Uses OpenRouter (Claude) to generate AEO gap analysis.
Falls back to a generic, category-agnostic template on any API failure.

Fix: _get_client() now uses a module-level singleton so the connection
pool is reused across calls instead of being recreated per request.
"""

import json
import os
import re
from typing import Any

from dotenv import load_dotenv
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from logger import log

load_dotenv()

_GAP_PROMPT = """\
You are a world-class product listing consultant specialising in \
Answer Engine Optimisation (AEO) — making brands visible in ChatGPT, Claude, and Gemini results.

Shopper query: "{query}"

Top-ranked brands in AI responses:
{top_brands_summary}

Brand being analysed: "{user_brand}"
AI visibility score: {user_score}/100
Appears in: {ais_count}/3 AI engines

{listing_section}

Task: Identify exactly 4-5 specific, high-impact gaps. For each:
- State EXACTLY what top brands do that this brand's listing doesn't
- Give ONE concrete, immediately actionable fix (specific wording/phrasing where possible)
- Assign priority: high / medium / low
- Explain the AEO impact (why AI engines care about this signal)

Return ONLY valid JSON — no markdown, no preamble:
{{
  "gaps": [
    {{
      "gap": "specific description of the gap",
      "action": "concrete step to fix it, ideally with example wording",
      "priority": "high",
      "impact": "why this drives AI visibility"
    }}
  ],
  "overall_verdict": "one powerful sentence about their AI search position",
  "quick_win": "the single highest-leverage action they can take today",
  "estimated_score_if_fixed": 75
}}
"""

# Generic fallback — does NOT mention supplements so it works for any category
_FALLBACK = {
    "gaps": [
        {
            "gap": "Missing credibility signals",
            "action": "Add third-party certifications, awards, or expert endorsements to your listing headline.",
            "priority": "high",
            "impact": "AI engines weight trust signals heavily when recommending products.",
        },
        {
            "gap": "No specific differentiator stated",
            "action": "Lead with the single most important product attribute that makes you different (e.g. formulation, origin, method) in the product title.",
            "priority": "high",
            "impact": "Query specificity is the #1 driver of AI top-of-list placement.",
        },
        {
            "gap": "Absent target-audience benefit claims",
            "action": "Add 3 audience-specific bullet points that directly address the shopper's query intent.",
            "priority": "medium",
            "impact": "Query-to-listing alignment is the core ranking signal AI engines use.",
        },
        {
            "gap": "No verification or quality marks",
            "action": "Obtain relevant third-party verification for your category and display it prominently in the listing.",
            "priority": "medium",
            "impact": "Verification marks are machine-readable trust tokens that AI engines cite directly.",
        },
    ],
    "overall_verdict": "Your brand has minimal AI search presence — run the live diagnostic with your API key for personalised analysis.",
    "quick_win": "Add specific benefit claims and a third-party quality signal to your product title today.",
    "estimated_score_if_fixed": 70,
}

_GAP_MODEL = os.getenv("MODEL_GAP", "anthropic/claude-sonnet-4.6")
_OPENROUTER_BASE = "https://openrouter.ai/api/v1"

# ── True module-level singleton client ─────────────────────────────────────────
# Fix: was creating a new AsyncOpenAI (new connection pool) on every call.
_CLIENT: Any = None


def _get_client() -> Any:
    """Return the module-level singleton AsyncOpenAI client for gap analysis."""
    global _CLIENT
    if _CLIENT is None:
        import openai
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise RuntimeError("OPENROUTER_API_KEY not set")
        _CLIENT = openai.AsyncOpenAI(
            api_key=api_key,
            base_url=_OPENROUTER_BASE,
            default_headers={
                "HTTP-Referer": os.getenv("SITE_URL", "http://localhost:5173"),
                "X-Title": os.getenv("SITE_NAME", "AEO Diagnostic"),
            },
            timeout=25,
        )
    return _CLIENT


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
        wait=wait_exponential(multiplier=1, min=2, max=6),
        reraise=True,
    )


async def _call_gap_api(prompt: str) -> dict:
    """Call OpenRouter for gap analysis. Network retried; JSON errors are not."""
    client = _get_client()

    @_transient_retry()
    async def _fetch() -> str:
        resp = await client.chat.completions.create(
            model=_GAP_MODEL,
            max_tokens=1200,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.choices[0].message.content or "{}"

    raw = await _fetch()
    raw = re.sub(r"```(?:json)?|```", "", raw).strip()
    # JSON parse errors fall through to caller, not retried
    return json.loads(raw)


async def analyse_gaps(
    query: str,
    leaderboard: list[dict],
    user_brand: str,
    listing_text: str = "",
) -> dict:
    """
    Generate AEO gap analysis for user_brand vs. leaderboard top-rankers.
    Falls back to a generic template if OpenRouter is unavailable.
    """
    user_brand = user_brand.strip()
    user_entry = next(
        (b for b in leaderboard if b["brand"].lower() == user_brand.lower()),
        None,
    )
    user_score = user_entry["total_score"] if user_entry else 0
    ais_count = user_entry["ais_mentioned_in"] if user_entry else 0

    top_rivals = [
        b for b in leaderboard[:6]
        if b["brand"].lower() != user_brand.lower()
    ][:4]
    top_brands_summary = "\n".join(
        f"  #{b['rank']} {b['brand']}: score {b['total_score']}/100, "
        f"in {b['ais_mentioned_in']}/3 engines"
        for b in top_rivals
    ) or "  (No competing brands ranked yet)"

    listing_section = (
        f'Current listing text (first 600 chars):\n"""\n{listing_text[:600]}\n"""'
        if listing_text.strip()
        else "No listing text provided — analyse based on brand name and query context."
    )

    prompt = _GAP_PROMPT.format(
        query=query,
        top_brands_summary=top_brands_summary,
        user_brand=user_brand,
        user_score=user_score,
        ais_count=ais_count,
        listing_section=listing_section,
    )

    if not os.getenv("OPENROUTER_API_KEY"):
        log.warning("gap_analysis_no_key")
        return _FALLBACK

    try:
        result = await _call_gap_api(prompt)
        result.setdefault("gaps", [])
        result.setdefault("overall_verdict", "Analysis complete.")
        result.setdefault("quick_win", result["gaps"][0]["action"] if result["gaps"] else "")
        result.setdefault("estimated_score_if_fixed", None)
        log.info("gap_analysis_done", gaps=len(result["gaps"]))
        return result
    except (json.JSONDecodeError, ValueError) as e:
        log.error("gap_analysis_parse_failed", err=str(e))
        return _FALLBACK
    except Exception as e:
        log.error("gap_analysis_failed", err=str(e))
        return _FALLBACK
