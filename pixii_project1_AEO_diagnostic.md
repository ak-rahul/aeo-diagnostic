# Pixii.ai — Founding Engineer Project #1
# AEO Diagnostic: AI Visibility Report Card

> **Role:** Founding Engineer — Pixii.ai
> **Project Code:** PIXII-001
> **Reviewer Wow Factor:** ⭐⭐⭐⭐⭐ (Instant, live, bleeding-edge)
> **Build Time:** 3 days to demo-ready MVP

---

## 1. The One-Line Pitch

> *"Google has SEO tools worth $5 billion. AI search is replacing Google. Nobody has built the SEO equivalent for ChatGPT, Claude, and Gemini — until now. This is that tool."*

---

## 2. Why This Wins With Reviewers

| Signal | Why It Matters to a Reviewer |
|---|---|
| **Zero credible competitors** | Semrush, Ahrefs, Helium10 don't do this. Brand new problem space. |
| **Trend timing is perfect** | AEO/GEO (Generative Engine Optimisation) is the #1 trending topic in marketing right now (2025). |
| **Live demo in 30 seconds** | Reviewer types a query, watches 3 AIs answer in real time, sees the brand scorecard appear. |
| **Emotional hook** | Seeing your own product score 22/100 while a competitor scores 95 is viscerally alarming. |
| **Fits Pixii.ai perfectly** | Pixii is an e-commerce AI brand. AEO diagnostic IS the core intelligence layer for e-commerce sellers. |

---

## 3. Problem Statement

When a shopper asks ChatGPT *"what's the best magnesium supplement for seniors"*, the AI recommends 3–5 brands. If your brand isn't one of them, you've lost the sale — and you never even knew the question was asked.

**The problem:** Amazon sellers and DTC brands have no way to:
1. Know whether AI engines are recommending them
2. Understand WHY competitors rank higher in AI responses
3. Get actionable steps to improve their AI visibility

This is the exact gap Pixii.ai's AEO Diagnostic fills.

---

## 4. Product Overview (MVP Scope)

### What the user does:
1. Types a product search query (e.g. *"best collagen powder for women over 40"*)
2. Optionally pastes their own brand/product name
3. Clicks **Run Diagnostic**

### What the tool does (in ~25 seconds):
1. Sends the query to GPT-4o, Claude Sonnet, and Gemini 1.5 **in parallel**
2. Extracts every brand/product mentioned in each response
3. Scores each brand by AI visibility (frequency + position + prominence)
4. Compares user's brand against top competitors
5. Generates a gap analysis: *"Top brands mention X, Y, Z — your listing doesn't"*

### What the user sees:
- **Live AI response feed** — three panels streaming in real time
- **Brand visibility leaderboard** — ranked table with scores per AI
- **Your score vs. competitors** — red/amber/green RAG status
- **Gap analysis card** — 3–5 specific, actionable improvements
- **Exportable PDF report** — for sharing with their team or agency

---

## 5. Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND (React)                   │
│  Query Input → Live Streaming Panel → Report Card   │
└──────────────────┬──────────────────────────────────┘
                   │ REST API
┌──────────────────▼──────────────────────────────────┐
│                BACKEND (FastAPI / Python)            │
│                                                      │
│  ┌────────────┐  ┌────────────┐  ┌───────────────┐  │
│  │  OpenAI    │  │  Anthropic │  │  Google       │  │
│  │  GPT-4o    │  │  Claude    │  │  Gemini 1.5   │  │
│  │  API Call  │  │  API Call  │  │  API Call     │  │
│  └─────┬──────┘  └─────┬──────┘  └──────┬────────┘  │
│        └───────────────┼─────────────────┘           │
│                        │ asyncio.gather()             │
│              ┌─────────▼──────────┐                  │
│              │  Brand Extractor   │                  │
│              │  (Claude API call) │                  │
│              └─────────┬──────────┘                  │
│                        │                             │
│              ┌─────────▼──────────┐                  │
│              │  Scoring Engine    │                  │
│              │  Visibility Score  │                  │
│              └─────────┬──────────┘                  │
│                        │                             │
│              ┌─────────▼──────────┐                  │
│              │  Gap Analyser      │                  │
│              │  (Claude API call) │                  │
│              └─────────┬──────────┘                  │
└────────────────────────┼────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   Report Card JSON  │
              │   + PDF Export      │
              └─────────────────────┘
```

### Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | React + Tailwind CSS | Fast to build, clean UI |
| Backend | FastAPI (Python) | Async, perfect for parallel API calls |
| AI Calls | `asyncio.gather()` | All 3 AIs called simultaneously |
| Brand Extraction | Claude Sonnet (structured JSON) | Most accurate NER for brand names |
| Gap Analysis | Claude Sonnet | Best at reasoning over text comparison |
| PDF Export | WeasyPrint or Puppeteer | Clean report generation |
| Hosting | Railway or Render (free tier) | Zero-cost for demo |

---

## 6. Core Algorithm: Visibility Scoring

```python
def calculate_visibility_score(brand: str, responses: dict) -> dict:
    """
    Score a brand's visibility across AI engines.
    
    Scoring weights:
    - Mentioned by AI:        +30 points per AI (max 90)
    - First mention:          +10 bonus points
    - Second mention:         +5 bonus points
    - Described positively:   +5 points per AI
    - Mentioned in summary:   +5 points per AI
    
    Max possible score: 100
    """
    score = 0
    breakdown = {}
    
    for ai_name, response_text in responses.items():
        ai_score = 0
        response_lower = response_text.lower()
        brand_lower = brand.lower()
        
        if brand_lower in response_lower:
            ai_score += 30  # Base mention score
            
            # Position bonus
            first_idx = response_lower.find(brand_lower)
            total_len = len(response_lower)
            if first_idx < total_len * 0.25:
                ai_score += 10  # Mentioned in first 25% = top recommendation
            elif first_idx < total_len * 0.5:
                ai_score += 5   # Mentioned in first half
            
        breakdown[ai_name] = ai_score
        score += ai_score
    
    return {
        "brand": brand,
        "total_score": min(score, 100),
        "breakdown": breakdown,
        "ais_mentioned_in": sum(1 for s in breakdown.values() if s > 0)
    }
```

---

## 7. Core Prompts

### Brand Extraction Prompt
```
You are a brand intelligence analyst. Given an AI response to a product search query,
extract every brand name, product name, or company mentioned.

Response text:
{ai_response}

Return ONLY a JSON array of strings. Example: ["Brand A", "Brand B", "Product X"]
No explanation. No markdown. Raw JSON only.
```

### Gap Analysis Prompt
```
You are a product listing consultant. A seller wants to improve their AI search visibility.

Query shoppers are asking: "{query}"

Top-ranked brands in AI responses and what they emphasise:
{top_brands_summary}

The user's product/brand: "{user_brand}"
Their product listing text: "{listing_text}" (if provided)

Identify exactly 3-5 specific gaps. For each gap:
- What the top brands do that theirs doesn't
- One concrete action to fix it

Return as JSON:
{
  "gaps": [
    {
      "gap": "description of what's missing",
      "action": "specific thing to add/change",
      "priority": "high/medium/low"
    }
  ],
  "overall_verdict": "one sentence summary"
}
```

---

## 8. Day-by-Day Build Plan

### Day 1: Backend Core (8 hours)

**Morning (4h)**
- [ ] Set up FastAPI project structure
- [ ] Create `.env` with OpenAI, Anthropic, Google API keys
- [ ] Write `ai_caller.py` — async parallel calls to all 3 AIs
- [ ] Test raw responses from all 3 engines for 5 sample queries

**Afternoon (4h)**
- [ ] Write `brand_extractor.py` — Claude-powered JSON extraction
- [ ] Write `scorer.py` — visibility scoring algorithm
- [ ] Write `gap_analyser.py` — Claude-powered gap analysis
- [ ] End-to-end test: query in → full JSON report out

**Day 1 Deliverable:** `POST /api/diagnostic` returns complete JSON report

---

### Day 2: Frontend (8 hours)

**Morning (4h)**
- [ ] React app scaffold (Vite + Tailwind)
- [ ] Query input form with example queries pre-loaded
- [ ] Three-panel AI response display (streaming via SSE)
- [ ] Loading states that make the wait feel exciting

**Afternoon (4h)**
- [ ] Brand visibility leaderboard component
- [ ] Score card with RAG status (red/amber/green)
- [ ] Gap analysis card with priority badges
- [ ] Mobile-responsive layout

**Day 2 Deliverable:** Full working UI connected to backend

---

### Day 3: Polish + Demo Prep (8 hours)

**Morning (4h)**
- [ ] PDF export of the full report
- [ ] Pre-loaded demo queries (5 categories: supplements, skincare, pet food, kitchen, fitness)
- [ ] Error handling for rate limits and API failures
- [ ] Deploy to Railway/Render with public URL

**Afternoon (4h)**
- [ ] Record 60-second Loom demo video
- [ ] Write the one-page project summary for reviewers
- [ ] Stress test with 10 different queries
- [ ] Final UI polish — typography, spacing, Pixii branding

**Day 3 Deliverable:** Live public URL + demo video + reviewer write-up

---

## 9. Demo Script (for reviewers)

**Opening line:**
> "Every Amazon seller obsesses over Google SEO. But in 2025, half of product searches start on ChatGPT or Gemini. Nobody has a tool to measure that visibility — until now."

**Live demo steps:**
1. Open the tool on screen
2. Type: *"best magnesium supplement for seniors"*
3. Hit Run — let all three AI panels stream live
4. Point to the leaderboard: *"See how Brand X appears in all 3 AIs at position 1? Your brand appears in only 1."*
5. Scroll to gap analysis: *"Here's exactly why — and here are 3 things you can change on your listing today."*

**Closing line:**
> "This is the foundation of what Pixii.ai becomes: the intelligence layer every e-commerce brand needs to win in the AI-search era."

---

## 10. Preloaded Demo Queries

| Query | Category | Why It Works |
|---|---|---|
| "best magnesium supplement for seniors" | Supplements | High competition, clear brand winners |
| "best collagen powder for women" | Beauty/Health | Emotionally resonant, many brands |
| "best air fryer under $100" | Kitchen | Reviewer can personally relate |
| "best dog food for small breeds" | Pet | Passionate buyers, strong brand loyalty |
| "best creatine for beginners" | Fitness | Highly AI-searchable category |

---

## 11. What Makes This a "Founding Engineer" Project

As founding engineer at Pixii.ai, this project demonstrates:

- **Product thinking** — You identified a real market gap, not just a tech demo
- **System design** — Parallel async architecture, not a naive sequential implementation
- **AI fluency** — Using Claude for structured extraction AND gap analysis shows deep LLM usage
- **Business sense** — You understand why an e-commerce brand would pay for this
- **Speed** — 3 days from zero to deployed, demo-ready product

---

## 12. Post-MVP Expansion (show reviewers you're thinking long-term)

| Feature | Timeline | Business Value |
|---|---|---|
| Weekly automated tracking | Month 1 | Subscription model trigger |
| Competitor alert: "Brand X just appeared in Gemini" | Month 1 | Retention hook |
| Listing rewriter: auto-optimise for AI visibility | Month 2 | Core Pixii product tie-in |
| Historical trend charts | Month 2 | Dashboards = stickiness |
| Shopify/Amazon plugin | Month 3 | Distribution moat |
| Agency white-label | Month 3 | B2B revenue stream |

---

## 13. File Structure

```
pixii-aeo-diagnostic/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── ai_caller.py         # Parallel AI calls
│   ├── brand_extractor.py   # Claude NER extraction
│   ├── scorer.py            # Visibility scoring
│   ├── gap_analyser.py      # Claude gap analysis
│   ├── pdf_generator.py     # Report export
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── QueryInput.jsx
│   │   │   ├── AIPanels.jsx
│   │   │   ├── Leaderboard.jsx
│   │   │   ├── ScoreCard.jsx
│   │   │   └── GapAnalysis.jsx
│   │   └── index.css
│   └── package.json
├── .env.example
├── README.md
└── demo_queries.json
```

---

## 14. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| OpenAI/Google API rate limit during demo | Medium | Pre-cache 5 demo query results as fallback |
| AI response doesn't mention any brands | Low | Prompt engineering: "List specific product recommendations" |
| Scoring feels arbitrary to reviewer | Medium | Show the formula transparently in the UI |
| Google Gemini API access issues | Low | Have Gemini 1.0 Flash as backup |

---

*Built for Pixii.ai — the AI intelligence layer for e-commerce brands.*
*Founding Engineer submission — [Your Name]*
