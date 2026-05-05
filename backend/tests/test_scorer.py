"""
tests/test_scorer.py — pytest unit tests for scorer.py edge cases.

Covers the specific false-positive risks flagged in the code analysis:
  - Short brand names (< 5 chars) — must not match inside longer words
  - Brands not mentioned at all — must return score=0, mentioned=False
  - Brands mentioned only in conclusion
  - Brands as substrings of common words
  - Multiple mention bonus
  - Ordinal position bonuses
"""

import sys
import os

# Make backend importable when running from repo root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from scorer import _is_mentioned, _score_engine, calculate_visibility_score, build_leaderboard


# ── _is_mentioned edge cases ──────────────────────────────────────────────────

class TestIsMentioned:
    def test_exact_short_brand_found(self):
        """Short brand 'NOW' must match when present as a whole word."""
        assert _is_mentioned("now", "now foods is great") is True

    def test_short_brand_not_false_positive(self):
        """'NOW' must NOT match inside 'know', 'knowing', 'renew'."""
        assert _is_mentioned("now", "knowing is half the battle") is False
        assert _is_mentioned("now", "renew your subscription") is False

    def test_short_brand_swanson_vs_swansong(self):
        """'Swanson' (7 chars) must NOT match inside 'swansong'."""
        assert _is_mentioned("swanson", "the swansong of an era") is False

    def test_long_brand_fuzzy_match(self):
        """Long brand name with punctuation variation is still matched."""
        # "Doctor's Best" vs "Doctors Best" (no apostrophe after normalise)
        assert _is_mentioned("doctors best", "doctors best is excellent") is True

    def test_brand_not_in_text(self):
        assert _is_mentioned("pure encapsulations", "thorne research is great") is False

    def test_empty_text(self):
        assert _is_mentioned("thorne", "") is False

    def test_empty_brand(self):
        # Empty brand after normalise — should not match
        assert _is_mentioned("", "some text here") is False


# ── _score_engine edge cases ──────────────────────────────────────────────────

class TestScoreEngine:
    def test_not_mentioned_returns_zero(self):
        es = _score_engine("BrandX", "We recommend Thorne and Pure Encapsulations.")
        assert es.score == 0
        assert es.mentioned is False
        assert es.mention_count == 0

    def test_mentioned_gets_base_30(self):
        es = _score_engine("Thorne Research", "Thorne Research is our top pick for seniors.")
        assert es.mentioned is True
        assert es.score >= 30

    def test_top_position_bonus(self):
        text = "1. Thorne Research — best overall\n2. Pure Encapsulations\n3. Life Extension"
        es = _score_engine("Thorne Research", text)
        assert es.score >= 40  # 30 base + 10 top-3 bonus

    def test_multiple_mention_bonus(self):
        text = "Thorne Research is great. Thorne Research is recommended by doctors. Thorne Research leads the market."
        es = _score_engine("Thorne Research", text)
        # Should get base (30) + multiple mention bonus (5)
        assert es.score >= 35

    def test_per_engine_cap_at_47(self):
        # Even if a brand ticks every bonus, score should not exceed 47
        text = (
            "1. NOW Foods is the best\n"
            "NOW Foods is outstanding and excellent and highly recommended. "
            "NOW Foods is trusted and premium. In conclusion, NOW Foods is the winner."
        )
        es = _score_engine("NOW Foods", text)
        assert es.score <= 47

    def test_short_brand_not_false_positive_in_engine(self):
        """'NOW' brand must not fire when text has 'know' but not 'NOW Foods'."""
        text = "You should know that magnesium is important. Knowing the right dose matters."
        es = _score_engine("NOW", text)
        assert es.mentioned is False
        assert es.score == 0

    def test_conclusion_bonus(self):
        # Brand only mentioned in conclusion area
        tail = "a " * 200 + "Overall, Pure Encapsulations is our top recommendation."
        es = _score_engine("Pure Encapsulations", tail)
        assert es.mentioned is True
        # Should have base + conclusion bonus
        assert es.score >= 34


# ── calculate_visibility_score ────────────────────────────────────────────────

class TestCalculateVisibilityScore:
    def test_mentioned_in_all_three(self):
        responses = [
            {"engine": "GPT-5.1", "text": "Pure Encapsulations is excellent."},
            {"engine": "Claude Sonnet", "text": "Pure Encapsulations is highly recommended."},
            {"engine": "Gemini Pro Latest", "text": "Pure Encapsulations is trusted by doctors."},
        ]
        score = calculate_visibility_score("Pure Encapsulations", responses)
        assert score.ais_mentioned_in == 3
        assert score.total_score >= 70
        assert score.rag_status == "green"

    def test_not_mentioned_anywhere(self):
        responses = [
            {"engine": "GPT-5.1", "text": "Thorne Research is best."},
            {"engine": "Claude Sonnet", "text": "Life Extension is great."},
            {"engine": "Gemini Pro Latest", "text": "Nature Made is popular."},
        ]
        score = calculate_visibility_score("UnknownBrand", responses)
        assert score.ais_mentioned_in == 0
        assert score.total_score == 0
        assert score.rag_status == "red"

    def test_global_cap_at_100(self):
        # Spam a brand across all 3 engines in top positions
        text = "1. SuperBrand is the best outstanding premium trusted recommended choice."
        responses = [
            {"engine": "GPT-5.1", "text": text},
            {"engine": "Claude Sonnet", "text": text},
            {"engine": "Gemini Pro Latest", "text": text},
        ]
        score = calculate_visibility_score("SuperBrand", responses)
        assert score.total_score <= 100


# ── build_leaderboard ─────────────────────────────────────────────────────────

class TestBuildLeaderboard:
    def test_ranking_order(self):
        responses = [
            {"engine": "GPT-5.1", "text": "1. Thorne Research is best. 2. Life Extension is good."},
        ]
        brands = ["Thorne Research", "Life Extension"]
        board = build_leaderboard(brands, responses)
        assert board[0]["rank"] == 1
        assert board[0]["brand"] == "Thorne Research"

    def test_empty_brands(self):
        result = build_leaderboard([], [{"engine": "GPT-5.1", "text": "some text"}])
        assert result == []

    def test_deduplication(self):
        """Case-insensitive duplicates should be counted once."""
        responses = [{"engine": "GPT-5.1", "text": "Thorne Research is great."}]
        brands = ["Thorne Research", "thorne research", "THORNE RESEARCH"]
        board = build_leaderboard(brands, responses)
        assert len(board) == 1

    def test_ranks_are_sequential(self):
        responses = [
            {"engine": "GPT-5.1", "text": "Pure Encapsulations, Thorne Research, Life Extension are all good."},
        ]
        brands = ["Pure Encapsulations", "Thorne Research", "Life Extension"]
        board = build_leaderboard(brands, responses)
        ranks = [b["rank"] for b in board]
        assert ranks == list(range(1, len(ranks) + 1))
