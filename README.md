# AEO Diagnostic 🚀
### AI Visibility Report Card for E-Commerce Brands

> *"Google has SEO tools worth $5 billion. AI search is replacing Google. Nobody has built the SEO equivalent for ChatGPT, Claude, and Gemini — until now."*

---

## What This Does

This tool shows Amazon sellers and DTC brands **exactly how visible they are in AI search** — and what to do about it.

When a shopper asks ChatGPT *"best magnesium supplement for seniors"*, some brands appear at position #1 in all 3 AI engines. Others don't appear at all. **This tool tells you which one you are — and why.**

---

## Architecture Overview

We recently completed a major architectural overhaul to ensure production-ready reliability, strict security, and cost efficiency:

1. **OpenRouter Integration**: Instead of managing separate OpenAI, Anthropic, and Google API keys and limits, the backend has been fully unified behind **OpenRouter**. We query GPT-4o, Claude Sonnet, and Gemini Pro Latest simultaneously.
2. **Robust Connection Pooling**: By replacing per-request HTTP clients with a singleton `AsyncOpenAI` client, we significantly dropped connection overhead.
3. **Fuzzy Brand Matching**: The engine uses `rapidfuzz` to catch misspellings or punctuation differences (e.g. "Doctor's Best" vs "Doctors Best") rather than strict substring matching.
4. **Security Hardening**:
   - Explicit CORS origins mapped to environment variables (no more wildcard credentials).
   - Strict Jinja2 `autoescape` for PDF reports to mitigate injection vulnerabilities.
   - Per-IP Rate Limiting to prevent API quota drain.

---

## Quick Start

### 1. Configure OpenRouter

Get a single, free API key from [OpenRouter](https://openrouter.ai/keys) and place it in your `.env`.

```bash
cp backend/.env.example backend/.env
# Set your OPENROUTER_API_KEY
```

### 2. Run the Stack (Windows)

Double-click `start.bat` or run it from your terminal:
```cmd
.\start.bat
```

### 3. Run the Stack (Linux/Mac/Render)

```bash
chmod +x start.sh
./start.sh
```

---

## Key Features
- ⚡ **URL Parameter Syncing** — Share links like `?q=best+laptops&brand=Dell` directly with clients.
- 🌌 **Ultra-Premium 21st.dev UI** — Dark obsidian theme, glassmorphism, Framer Motion animations.
- 📊 **Developer Export** — Export raw JSON payloads alongside PDF/CSV reports.
- 🏆 **Interactive Leaderboard** — Search, sort, and analyze brand visibility on-the-fly.
- 🎯 **Gap analysis** — Claude identifies exactly what top brands do that yours doesn't.
- 🔴🟡🟢 **RAG scoring** — Instant visual status for every brand based on fuzzy match ranking logic.
