"""
gap_analyser.py — Claude-powered competitive gap analysis with retry.
"""

import json
import os
import re

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

_FALLBACK = {
    "gaps": [
        {
            "gap": "Missing clinical credibility signals",
            "action": "Add 'third-party tested by NSF International' and 'recommended by licensed physicians' to your listing headline.",
            "priority": "high",
            "impact": "AI engines weight trust signals heavily when recommending health products.",
        },
        {
            "gap": "No specific active ingredient form stated",
            "action": "Lead with the specific compound form (e.g. 'Magnesium Glycinate — most bioavailable form for seniors') in the product title.",
            "priority": "high",
            "impact": "Query specificity is the #1 driver of AI top-of-list placement.",
        },
        {
            "gap": "Absent target-audience benefit claims",
            "action": "Add 3 audience-specific bullet points (e.g. 'Supports bone density in adults 50+', 'Promotes deep sleep', 'Gentle on sensitive stomachs').",
            "priority": "medium",
            "impact": "Query-to-listing alignment is the core ranking signal AI engines use.",
        },
        {
            "gap": "No certifications or verification marks",
            "action": "Obtain USP, NSF, or Informed Sport certification and display it prominently in the listing.",
            "priority": "medium",
            "impact": "Certifications are machine-readable trust tokens that AI engines cite directly.",
        },
    ],
    "overall_verdict": "Your brand has minimal AI search presence — run the live diagnostic with API keys for personalised analysis.",
    "quick_win": "Add specific benefit claims and a third-party certification to your product title today.",
    "estimated_score_if_fixed": 70,
}


@retry(
    retry=retry_if_exception_type(Exception),
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=2, max=6),
    reraise=False,
)
async def _call_claude_gap(prompt: str) -> dict:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"), timeout=25)
    msg = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1200,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text.strip() if msg.content else "{}"
    raw = re.sub(r"```(?:json)?|```", "", raw).strip()
    return json.loads(raw)


async def analyse_gaps(
    query: str,
    leaderboard: list[dict],
    user_brand: str,
    listing_text: str = "",
) -> dict:
    """
    Generate AEO gap analysis for user_brand vs. leaderboard top-rankers.
    Falls back to a generic template if Claude is unavailable.
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

    if not os.getenv("ANTHROPIC_API_KEY"):
        log.warning("gap_analysis_no_key")
        return _FALLBACK

    try:
        result = await _call_claude_gap(prompt)
        # Ensure required fields exist
        result.setdefault("gaps", [])
        result.setdefault("overall_verdict", "Analysis complete.")
        result.setdefault("quick_win", result["gaps"][0]["action"] if result["gaps"] else "")
        result.setdefault("estimated_score_if_fixed", None)
        log.info("gap_analysis_done", gaps=len(result["gaps"]))
        return result
    except Exception as e:
        log.error("gap_analysis_failed", err=str(e))
        return _FALLBACK
