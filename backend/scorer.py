"""
scorer.py — Brand visibility scoring engine.

Score components (max 100):
  Base mention (per engine):      +30   (max 90 across 3)
  Top-25% position bonus:         +10
  Top-50% position bonus:         +5
  Multiple mentions (≥2):         +5
  Positive sentiment context:     +3
  Conclusion / summary mention:   +4
  Per-engine cap:                 47
  Global cap:                     100

RAG thresholds:
  green  ≥ 70
  amber  ≥ 35
  red    < 35

Scoring note:
  Raw score across 3 engines can reach 141; this is normalised by capping
  at 100 (global cap). The displayed per-engine max of 47 is the per-engine
  cap — a brand perfect across all 3 would score 141 raw, shown as 100.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from logger import log

# ── Sentiment keywords — specific enough to be meaningful ─────────────────────
# Removed "best"/"top" because they appear universally in AI product responses
# and don't discriminate. Only words that reflect direct positive attribution.
_POSITIVE = frozenset({
    "excellent", "highly recommended", "superior",
    "premium", "leading", "trusted", "renowned",
    "effective", "proven", "outstanding", "exceptional",
    "remarkable", "impressive", "standout",
})

_CONCLUSION_MARKERS = frozenset({
    "in conclusion", "overall", "to summarize", "in summary", "my recommendation",
    "final", "verdict", "winner", "best overall", "top pick", "number one", "#1",
    "editor", "highly recommend", "my top",
})

_PER_ENGINE_CAP = 47
_GLOBAL_CAP = 100


@dataclass
class EngineScore:
    score: int = 0
    mentioned: bool = False
    mention_count: int = 0
    position_pct: Optional[float] = None
    details: list[str] = field(default_factory=list)


@dataclass
class BrandScore:
    brand: str
    total_score: int
    rag_status: str
    ais_mentioned_in: int
    rank: int = 0
    breakdown: dict[str, dict] = field(default_factory=dict)


def _score_engine(brand_lower: str, text: str) -> EngineScore:
    """Score a brand against a single engine response."""
    es = EngineScore()
    if not text:
        return es

    text_lower = text.lower()
    if brand_lower not in text_lower:
        es.details.append("✗ Not mentioned")
        return es

    es.mentioned = True
    es.mention_count = text_lower.count(brand_lower)
    es.score += 30
    es.details.append(f"✓ Mentioned ({es.mention_count}×) +30")

    # Frequency bonus
    if es.mention_count >= 2:
        es.score += 5
        es.details.append("✓ Multiple mentions +5")

    # Position bonus
    first_idx = text_lower.find(brand_lower)
    total_len = len(text_lower)
    es.position_pct = round((first_idx / total_len) * 100, 1) if total_len else 100.0
    if first_idx < total_len * 0.25:
        es.score += 10
        es.details.append("✓ Top 25% position +10")
    elif first_idx < total_len * 0.5:
        es.score += 5
        es.details.append("✓ Top 50% position +5")

    # Positive-sentiment context (±200 chars around first mention)
    lo = max(0, first_idx - 200)
    hi = min(total_len, first_idx + 200)
    context = text_lower[lo:hi]
    if any(pw in context for pw in _POSITIVE):
        es.score += 3
        es.details.append("✓ Positive context +3")

    # Conclusion mention — ONLY award bonus if the brand itself is in the tail.
    # The old bug: the +4 fired whenever any conclusion marker was in the tail,
    # even if the brand wasn't there. Fixed: condition is brand-in-tail only.
    tail = text_lower[-300:]
    if brand_lower in tail:
        es.score += 4
        es.details.append("✓ In conclusion +4")

    es.score = min(es.score, _PER_ENGINE_CAP)
    return es


def calculate_visibility_score(brand: str, responses: list[dict]) -> BrandScore:
    """
    Score brand visibility across all engine responses.
    Returns a BrandScore dataclass.
    """
    brand_lower = brand.lower().strip()
    breakdown: dict[str, dict] = {}
    total = 0

    for resp in responses:
        engine = resp.get("engine", "Unknown")
        text = resp.get("text", "") or ""
        es = _score_engine(brand_lower, text)
        breakdown[engine] = {
            "score": es.score,
            "mentioned": es.mentioned,
            "mention_count": es.mention_count,
            "position_pct": es.position_pct,
            "details": es.details,
        }
        total += es.score

    total = min(total, _GLOBAL_CAP)
    ais_in = sum(1 for v in breakdown.values() if v["mentioned"])

    if total >= 70:
        rag = "green"
    elif total >= 35:
        rag = "amber"
    else:
        rag = "red"

    return BrandScore(
        brand=brand,
        total_score=total,
        rag_status=rag,
        ais_mentioned_in=ais_in,
        breakdown=breakdown,
    )


def build_leaderboard(brands: list[str], responses: list[dict]) -> list[dict]:
    """
    Score all brands, deduplicate, sort descending, assign ranks.
    Returns a list of plain dicts (JSON-serialisable).
    """
    # Deduplicate brands case-insensitively, keep first casing encountered
    seen: dict[str, str] = {}
    for b in brands:
        key = b.lower().strip()
        if key and key not in seen:
            seen[key] = b

    if not seen:
        log.warning("leaderboard_empty_brands")
        return []

    scored: list[BrandScore] = [
        calculate_visibility_score(b, responses) for b in seen.values()
    ]
    scored.sort(key=lambda x: x.total_score, reverse=True)

    result = []
    for i, s in enumerate(scored):
        s.rank = i + 1
        result.append({
            "rank": s.rank,
            "brand": s.brand,
            "total_score": s.total_score,
            "rag_status": s.rag_status,
            "ais_mentioned_in": s.ais_mentioned_in,
            "breakdown": s.breakdown,
        })

    log.info("leaderboard_built", brands=len(result),
             top=result[0]["brand"] if result else None,
             top_score=result[0]["total_score"] if result else 0)
    return result
