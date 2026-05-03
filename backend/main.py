"""
main.py — FastAPI application: AEO Diagnostic
Improvements over v1:
  - TTLCache for repeat queries (5-min TTL)
  - Structured logging via structlog
  - Strict Pydantic input validation
  - /api/health reports API key presence without leaking values
  - Startup event validates environment
  - Clean error response model
"""

import asyncio
import hashlib
import os
import uuid
from datetime import datetime
from typing import Optional

from cachetools import TTLCache
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from ai_caller import call_all_engines
from brand_extractor import extract_brands_parallel
from demo_cache import DEMO_RESULTS, get_demo_result
from gap_analyser import analyse_gaps
from logger import log
from pdf_generator import generate_pdf_bytes
from scorer import build_leaderboard

load_dotenv()

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AEO Diagnostic API",
    description="Real-time AI visibility & Answer Engine Optimisation for e-commerce brands.",
    version="1.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory cache (max 100 results, 5-minute TTL) ───────────────────────────
_cache: TTLCache = TTLCache(maxsize=100, ttl=300)
_last_result: dict = {}  # used for PDF export


# ── Models ─────────────────────────────────────────────────────────────────────
class DiagnosticRequest(BaseModel):
    query: str = Field(..., min_length=5, max_length=300)
    user_brand: Optional[str] = Field(default="", max_length=120)
    listing_text: Optional[str] = Field(default="", max_length=3000)
    use_demo: Optional[bool] = False

    @field_validator("query")
    @classmethod
    def strip_query(cls, v: str) -> str:
        return v.strip()

    @field_validator("user_brand")
    @classmethod
    def strip_brand(cls, v: Optional[str]) -> str:
        return (v or "").strip()


class ErrorResponse(BaseModel):
    detail: str
    code: str = "error"


# ── Helpers ────────────────────────────────────────────────────────────────────
def _cache_key(query: str, user_brand: str) -> str:
    raw = f"{query.lower().strip()}|{user_brand.lower().strip()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _build_result(
    query: str,
    user_brand: str,
    responses: list[dict],
    leaderboard: list[dict],
    gap_analysis: Optional[dict],
    duration: float,
) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "query": query,
        "user_brand": user_brand,
        "responses": responses,
        "leaderboard": leaderboard,
        "gap_analysis": gap_analysis,
        "duration_seconds": round(duration, 2),
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "from_cache": False,
    }


# ── Startup ────────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup() -> None:
    keys = {
        "OPENAI_API_KEY": bool(os.getenv("OPENAI_API_KEY")),
        "ANTHROPIC_API_KEY": bool(os.getenv("ANTHROPIC_API_KEY")),
        "GOOGLE_API_KEY": bool(os.getenv("GOOGLE_API_KEY")),
    }
    log.info("startup", **keys, version="1.1.0")
    missing = [k for k, v in keys.items() if not v]
    if missing:
        log.warning("missing_api_keys", keys=missing)


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
async def health():
    return {
        "status": "ok",
        "version": "1.1.0",
        "apis": {
            "openai":    bool(os.getenv("OPENAI_API_KEY")),
            "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
            "google":    bool(os.getenv("GOOGLE_API_KEY")),
        },
        "cache_size": len(_cache),
    }


@app.get("/api/demo-queries", tags=["System"])
async def demo_queries():
    return {"queries": list(DEMO_RESULTS.keys())}


# ── Diagnostic ─────────────────────────────────────────────────────────────────
@app.post("/api/diagnostic", tags=["Diagnostic"])
async def run_diagnostic(req: DiagnosticRequest, request: Request):
    global _last_result
    query = req.query
    user_brand = req.user_brand or ""
    log.info("diagnostic_start", query=query[:80], brand=user_brand or "(none)")

    # ── Demo shortcut ──────────────────────────────────────────────────────────
    if req.use_demo:
        cached = get_demo_result(query)
        if cached:
            cached = dict(cached)
            cached.update(id=str(uuid.uuid4()), generated_at=datetime.utcnow().isoformat() + "Z", from_cache=True)
            if user_brand:
                cached["user_brand"] = user_brand
            _last_result = cached
            log.info("diagnostic_demo", query=query[:60])
            return cached

    # ── Cache lookup ───────────────────────────────────────────────────────────
    ck = _cache_key(query, user_brand)
    if ck in _cache:
        log.info("diagnostic_cache_hit", key=ck)
        hit = dict(_cache[ck])
        hit["from_cache"] = True
        hit["id"] = str(uuid.uuid4())
        return hit

    start = datetime.utcnow()

    # ── Step 1: Parallel AI calls ──────────────────────────────────────────────
    try:
        responses = await call_all_engines(query)
    except Exception as e:
        log.error("engines_fatal", err=str(e))
        raise HTTPException(status_code=502, detail=f"AI engine error: {e}")

    successful = [r for r in responses if not r.get("error") and r.get("text")]
    if not successful:
        raise HTTPException(
            status_code=503,
            detail="All AI engines failed to respond. Check your API keys and try again.",
        )

    # ── Step 2: Parallel brand extraction ─────────────────────────────────────
    all_brands = await extract_brands_parallel(responses)

    # ── Step 3: Leaderboard ────────────────────────────────────────────────────
    leaderboard = build_leaderboard(all_brands, responses)

    # ── Step 4: Gap analysis ───────────────────────────────────────────────────
    gap_analysis: Optional[dict] = None
    if user_brand:
        gap_analysis = await analyse_gaps(
            query=query,
            leaderboard=leaderboard,
            user_brand=user_brand,
            listing_text=req.listing_text or "",
        )

    duration = (datetime.utcnow() - start).total_seconds()
    result = _build_result(query, user_brand, responses, leaderboard, gap_analysis, duration)
    log.info("diagnostic_done", duration_s=duration, brands=len(leaderboard))

    # Cache and store
    _cache[ck] = result
    _last_result = result
    return result


# ── PDF Export ─────────────────────────────────────────────────────────────────
@app.get("/api/export/pdf", tags=["Export"])
async def export_pdf_last():
    if not _last_result:
        raise HTTPException(status_code=404, detail="No diagnostic run yet. Run a diagnostic first.")
    return await _generate_pdf_response(_last_result)


@app.post("/api/export/pdf-from-result", tags=["Export"])
async def export_pdf_from_result(result: dict):
    if not result:
        raise HTTPException(status_code=400, detail="Empty result payload.")
    return await _generate_pdf_response(result)


async def _generate_pdf_response(result: dict) -> Response:
    try:
        loop = asyncio.get_event_loop()
        pdf_bytes = await loop.run_in_executor(None, generate_pdf_bytes, result)
        ts = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        filename = f"aeo-report-{ts}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        log.error("pdf_failed", err=str(e))
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")


# ── Error handlers ─────────────────────────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exc_handler(request: Request, exc: HTTPException):
    log.warning("http_error", status=exc.status_code, detail=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": f"http_{exc.status_code}"},
    )


@app.exception_handler(Exception)
async def generic_exc_handler(request: Request, exc: Exception):
    log.error("unhandled_error", err=str(exc), path=str(request.url))
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred.", "code": "internal_error"},
    )
