"""
scorer.py — Brand visibility scoring engine with fuzzy matching.

Score components (max 100):
  Base mention (per engine):      +30   (max 90 across 3)
  Top-3 position bonus (ordinal): +10
  Top-6 position bonus (ordinal): +5
  Multiple mentions (≥2):         +5
  Positive sentiment context:     +3
  Conclusion / summary mention:   +4
  Per-engine cap:                 47
  Global cap:                     100

RAG thresholds:
  green  ≥ 70
  amber  ≥ 35
  red    < 35
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from rapidfuzz import fuzz

from logger import log

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


def _normalise(text: str) -> str:
    """Remove punctuation and normalise whitespace for robust matching."""
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _score_engine(brand: str, text: str) -> EngineScore:
    """Score a brand against a single engine response using fuzzy logic and ordinal positioning."""
    es = EngineScore()
    if not text:
        return es

    text_lower = text.lower()
    norm_text = _normalise(text)
    norm_brand = _normalise(brand)
    
    # 1. Fuzzy Mention Detection
    # Using partial_ratio to handle slight variations (e.g. "Doctor's Best" vs "Doctors Best")
    similarity = fuzz.partial_ratio(norm_brand, norm_text)
    if similarity < 85:
        es.details.append("✗ Not mentioned")
        return es

    es.mentioned = True
    
    # Count occurrences using regex on normalised text to avoid overlapping matches
    # We use \b to ensure word boundaries
    pattern = r'\b' + re.escape(norm_brand) + r'\b'
    # Fallback to direct count if regex fails to compile
    try:
        es.mention_count = len(re.findall(pattern, norm_text))
        if es.mention_count == 0:
            es.mention_count = 1 # We know it was mentioned via fuzzy match
    except re.error:
        es.mention_count = norm_text.count(norm_brand)

    es.score += 30
    es.details.append(f"✓ Mentioned ({es.mention_count}×) +30")

    # Frequency bonus
    if es.mention_count >= 2:
        es.score += 5
        es.details.append("✓ Multiple mentions +5")

    # 2. Ordinal Position Bonus (extract numbered lists like "1. Brand A", "2. Brand B")
    # This is more accurate than character position for LLM recommendations
    list_items = re.findall(r"(?:^|\n)\s*(?:\d+\.|\-|\*)\s+([^\n]+)", text)
    ordinal_pos = -1
    for i, item in enumerate(list_items):
        if fuzz.partial_ratio(norm_brand, _normalise(item)) >= 85:
            ordinal_pos = i + 1
            break

    if ordinal_pos > 0:
        if ordinal_pos <= 3:
            es.score += 10
            es.details.append(f"✓ Top 3 rank (List #{ordinal_pos}) +10")
        elif ordinal_pos <= 6:
            es.score += 5
            es.details.append(f"✓ Top 6 rank (List #{ordinal_pos}) +5")
    else:
        # Fallback to character position if no list is found
        first_idx = norm_text.find(norm_brand)
        total_len = len(norm_text)
        if first_idx >= 0 and total_len > 0:
            if first_idx < total_len * 0.25:
                es.score += 10
                es.details.append("✓ Top 25% position +10")
            elif first_idx < total_len * 0.5:
                es.score += 5
                es.details.append("✓ Top 50% position +5")

    # 3. Positive-sentiment context (±200 chars around first fuzzy match)
    match_idx = text_lower.find(brand.lower()) 
    if match_idx == -1:
        match_idx = norm_text.find(norm_brand) # fallback to approx position
        
    if match_idx >= 0:
        lo = max(0, match_idx - 200)
        hi = min(len(text_lower), match_idx + 200)
        context = text_lower[lo:hi]
        if any(pw in context for pw in _POSITIVE):
            es.score += 3
            es.details.append("✓ Positive context +3")

    # 4. Conclusion mention
    tail = norm_text[-300:]
    if fuzz.partial_ratio(norm_brand, tail) >= 85:
        es.score += 4
        es.details.append("✓ In conclusion +4")

    es.score = min(es.score, _PER_ENGINE_CAP)
    return es


def calculate_visibility_score(brand: str, responses: list[dict]) -> BrandScore:
    """
    Score brand visibility across all engine responses.
    Returns a BrandScore dataclass.
    """
    breakdown: dict[str, dict] = {}
    total = 0

    for resp in responses:
        engine = resp.get("engine", "Unknown")
        text = resp.get("text", "") or ""
        es = _score_engine(brand, text)
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
        key = _normalise(b)
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
