# AEO Diagnostic 🚀
### AI Visibility Report Card for E-Commerce Brands

> *"Google has SEO tools worth $5 billion. AI search is replacing Google. Nobody has built the SEO equivalent for ChatGPT, Claude, and Gemini — until now."*

---

## What This Does

This tool shows Amazon sellers and DTC brands **exactly how visible they are in AI search** — and what to do about it.

When a shopper asks ChatGPT *"best magnesium supplement for seniors"*, some brands appear at position #1 in all 3 AI engines. Others don't appear at all. **This tool tells you which one you are — and why.**

---

## Quick Start

### 1. Set Up API Keys

```bash
cp backend/.env.example backend/.env
# Add your OpenAI, Anthropic, and Google API keys
```

### 2. Install Dependencies (First Time Only)

```bash
# Terminal 1: Backend
cd backend && pip install -r requirements.txt

# Terminal 2: Frontend
cd frontend && npm install
```

### 3. Run the Entire Project (Single Command)

**Windows:**
Double-click `start.bat` or run it from your terminal:
```cmd
.\start.bat
```

This will automatically launch the FastAPI backend (port 8000) in a new window and start the Vite frontend (port 5173) in your current terminal.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + Framer Motion |
| Styling | 21st.dev inspired Glassmorphism & Vanilla CSS |
| Backend | FastAPI (Python) |
| AI Calls | `asyncio.gather()` — all 3 engines simultaneously with Tenacity retries |
| Brand Extraction | Claude Sonnet (structured JSON NER) |
| Gap Analysis | Claude Sonnet (competitive reasoning) |
| Export | WeasyPrint + Jinja2 (PDF) |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/diagnostic` | Run full AEO diagnostic |
| `GET` | `/api/health` | API key status check |
| `GET` | `/api/export/pdf` | Export last result as PDF |

---

## Features

- ⚡ **Single Command Start** — Use `start.bat` to boot the entire stack instantly
- 🌌 **Ultra-Premium 21st.dev UI** — Dark obsidian theme, glassmorphism, Framer Motion animations
- ⚡ **Parallel AI calls** — GPT-4o, Claude & Gemini called simultaneously with Tenacity retries
- 📊 **Live streaming** — See AI responses render word-by-word with pulsing skeleton loaders
- 🏆 **Brand leaderboard** — Every brand ranked by AI visibility score, exportable to CSV
- 🎯 **Gap analysis** — Claude identifies exactly what top brands do that yours doesn't
- 📄 **PDF & CSV Export** — Downloadable reports for team sharing
- 🔴🟡🟢 **RAG scoring** — Instant visual status for every brand
- 💾 **Local History** — Automatically saves your recent queries for one-click re-runs

---

