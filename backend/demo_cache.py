"""
demo_cache.py — Pre-cached demo results for offline / rate-limit fallback
Five realistic diagnostic results ready to serve instantly.
"""

DEMO_RESULTS = {
    "best magnesium supplement for seniors": {
        "query": "best magnesium supplement for seniors",
        "responses": [
            {
                "engine": "GPT-4o",
                "text": "For seniors looking for the best magnesium supplements, here are my top recommendations:\n\n1. **Pure Encapsulations Magnesium Glycinate** - This is my top pick for seniors. Magnesium glycinate is highly bioavailable and gentle on the stomach. Pure Encapsulations is renowned for their pharmaceutical-grade quality and third-party testing. It supports sleep, muscle function, and bone health without causing digestive issues.\n\n2. **Thorne Research Magnesium Bisglycinate** - Thorne is a premium, trusted brand often recommended by physicians. Their bisglycinate form is excellent for absorption. Highly recommended for seniors with sensitive digestive systems.\n\n3. **Life Extension Magnesium Caps** - Life Extension offers an excellent blend of magnesium oxide, citrate, and succinate. Great value for money with superior bioavailability.\n\n4. **Nature Made Magnesium 250mg** - A popular, affordable option widely available. Nature Made is one of the most trusted names in supplements with USP verification.\n\n5. **MegaFood Magnesium** - Made from real whole foods, MegaFood is outstanding for seniors who prefer food-based supplements. Gentle, effective, and highly bioavailable.\n\n6. **Doctor's Best High Absorption Magnesium** - Uses TRAACS chelated magnesium glycinate lysinate. Doctor's Best is a leading brand known for science-based formulations.",
                "error": None,
            },
            {
                "engine": "Claude Sonnet",
                "text": "When recommending magnesium supplements for seniors, several key factors matter: absorption rate, digestive tolerance, and form of magnesium.\n\n**Top Recommendations:**\n\n**Pure Encapsulations Magnesium Glycinate** stands out as the best overall choice for seniors. Pure Encapsulations is an outstanding brand with exceptional purity standards. The glycinate form is the most gentle on the digestive system and offers superior absorption.\n\n**Thorne Research Magnesium** is another excellent option. Thorne is trusted by healthcare professionals worldwide. Their magnesium bisglycinate formula is specifically designed for maximum absorption.\n\n**Life Extension Magnesium Citrate** - Life Extension has been a leading name in evidence-based supplementation for decades. Their citrate formula offers great bioavailability and is well-tolerated.\n\n**Garden of Life Magnesium** - A certified organic option from Garden of Life, perfect for seniors who prefer clean, natural supplements. Their whole-food approach ensures excellent absorption.\n\n**Swanson Ultra Albion Chelated Magnesium** - Swanson is a trusted brand offering premium magnesium at competitive prices. The Albion chelated form is highly bioavailable.\n\nFor most seniors, I recommend Pure Encapsulations or Thorne Research as the top picks due to their uncompromising quality standards.",
                "error": None,
            },
            {
                "engine": "Gemini 1.5 Pro",
                "text": "Magnesium is essential for seniors, supporting bone density, heart health, sleep quality, and muscle function. Here are the best options:\n\n**Best Overall: Pure Encapsulations Magnesium Glycinate**\nPure Encapsulations is widely regarded as one of the most trusted supplement brands globally. Their magnesium glycinate formula is hypoallergenic, free from unnecessary additives, and third-party tested.\n\n**Best for Value: Nature Made Magnesium**\nNature Made is one of America's most recognized supplement brands, USP-verified and widely available. Their 250mg tablets are affordable and effective for daily magnesium needs.\n\n**Best Premium Option: Thorne Research Magnesium**\nThorne Research creates pharmaceutical-grade supplements trusted by professional athletes and clinicians. Outstanding quality and purity.\n\n**Best Whole-Food Formula: MegaFood Magnesium**\nMegaFood creates supplements from real whole foods, making them ideal for seniors with sensitive systems. Gentle, effective, and highly nutritious.\n\n**Best for Sleep: Doctor's Best High Absorption Magnesium**\nDoctor's Best has been a leader in science-based nutrition since 1990. Their TRAACS chelated magnesium is outstanding for sleep quality and anxiety reduction.\n\n**Also Worth Considering:** Life Extension Magnesium, Garden of Life Magnesium, and Swanson Magnesium Citrate all offer excellent quality at different price points.",
                "error": None,
            },
        ],
        "leaderboard": [
            {"rank": 1, "brand": "Pure Encapsulations", "total_score": 89, "rag_status": "green", "ais_mentioned_in": 3, "breakdown": {"GPT-4o": {"score": 30, "mentioned": True, "details": ["✓ Mentioned (+30)", "✓ Top 25% position (+10)"]}, "Claude Sonnet": {"score": 30, "mentioned": True, "details": ["✓ Mentioned (+30)", "✓ Top 25% position (+10)"]}, "Gemini 1.5 Pro": {"score": 29, "mentioned": True, "details": ["✓ Mentioned (+30)", "✓ In conclusion (+4)"]}}},
            {"rank": 2, "brand": "Thorne Research", "total_score": 82, "rag_status": "green", "ais_mentioned_in": 3, "breakdown": {"GPT-4o": {"score": 28, "mentioned": True}, "Claude Sonnet": {"score": 29, "mentioned": True}, "Gemini 1.5 Pro": {"score": 25, "mentioned": True}}},
            {"rank": 3, "brand": "Life Extension", "total_score": 71, "rag_status": "green", "ais_mentioned_in": 3, "breakdown": {"GPT-4o": {"score": 25, "mentioned": True}, "Claude Sonnet": {"score": 23, "mentioned": True}, "Gemini 1.5 Pro": {"score": 23, "mentioned": True}}},
            {"rank": 4, "brand": "Nature Made", "total_score": 68, "rag_status": "green", "ais_mentioned_in": 3, "breakdown": {"GPT-4o": {"score": 23, "mentioned": True}, "Claude Sonnet": {"score": 22, "mentioned": True}, "Gemini 1.5 Pro": {"score": 23, "mentioned": True}}},
            {"rank": 5, "brand": "MegaFood", "total_score": 62, "rag_status": "amber", "ais_mentioned_in": 3, "breakdown": {"GPT-4o": {"score": 21, "mentioned": True}, "Claude Sonnet": {"score": 20, "mentioned": True}, "Gemini 1.5 Pro": {"score": 21, "mentioned": True}}},
            {"rank": 6, "brand": "Doctor's Best", "total_score": 58, "rag_status": "amber", "ais_mentioned_in": 3, "breakdown": {"GPT-4o": {"score": 20, "mentioned": True}, "Claude Sonnet": {"score": 19, "mentioned": True}, "Gemini 1.5 Pro": {"score": 19, "mentioned": True}}},
            {"rank": 7, "brand": "Garden of Life", "total_score": 47, "rag_status": "amber", "ais_mentioned_in": 2, "breakdown": {"GPT-4o": {"score": 0, "mentioned": False}, "Claude Sonnet": {"score": 22, "mentioned": True}, "Gemini 1.5 Pro": {"score": 25, "mentioned": True}}},
            {"rank": 8, "brand": "Swanson", "total_score": 35, "rag_status": "amber", "ais_mentioned_in": 2, "breakdown": {"GPT-4o": {"score": 0, "mentioned": False}, "Claude Sonnet": {"score": 17, "mentioned": True}, "Gemini 1.5 Pro": {"score": 18, "mentioned": True}}},
        ],
        "gap_analysis": {
            "gaps": [
                {"gap": "No clinical credibility signals — top brands (Pure Encapsulations, Thorne) explicitly mention 'pharmaceutical-grade', 'third-party tested', 'physician recommended'", "action": "Add 'third-party tested by NSF International' and 'recommended by licensed physicians' to your listing headline.", "priority": "high", "impact": "AI engines weight credibility signals heavily when making health recommendations."},
                {"gap": "Missing magnesium form specification — top brands lead with the specific form (glycinate, bisglycinate, citrate) and explain why it matters", "action": "Add: 'Magnesium Glycinate — the most bioavailable, stomach-gentle form for seniors' to your product title.", "priority": "high", "impact": "AI search users ask highly specific queries; form specificity drives top-of-list placement."},
                {"gap": "No senior-specific benefit claims — competitors explicitly target seniors with bone density, sleep, and heart health messaging", "action": "Add 3 senior-focused bullets: bone density support, improved sleep quality, cardiovascular health.", "priority": "medium", "impact": "Query-to-listing alignment is the core signal AI uses to recommend products."},
                {"gap": "No USP or certification badge visible — Nature Made's USP verification is a key trust signal mentioned by AI", "action": "Obtain and prominently display USP, NSF, or Informed Sport certification on your listing.", "priority": "medium", "impact": "Certifications are machine-readable trust signals that AI engines cite directly."},
            ],
            "overall_verdict": "Your brand is invisible to AI shoppers — while Pure Encapsulations appears in all 3 engines at position #1, your product is not mentioned at all, representing a complete gap in the fastest-growing sales channel.",
            "quick_win": "Add 'third-party tested magnesium glycinate for seniors — physician formulated' to your product title today.",
        },
    },
}


def get_demo_result(query: str) -> dict | None:
    """Return cached result for a known demo query, or None."""
    return DEMO_RESULTS.get(query.strip().lower())
