"""
main.py — FastAPI application: AEO Diagnostic
Fixes applied:
  - CORS: wildcard removed, explicit origin from env var
  - Startup: migrated to lifespan (replaces deprecated @app.on_event)
  - PDF endpoint: strict Pydantic model, no raw dict
  - _last_result race: replaced with per-request UUID store
  - Health: reports OpenRouter key presence
  - Rate limiting: per-IP via slowapi
"""

import asyncio
import hashlib
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional

import diskcache
from cachetools import TTLCache
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from ai_caller import call_all_engines
from brand_extractor import extract_brands_parallel
from demo_cache import DEMO_RESULTS, get_demo_result
from gap_analyser import analyse_gaps
from logger import log
from pdf_generator import generate_pdf_bytes
from scorer import build_leaderboard

load_dotenv()

# ── Rate limiter ───────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── In-memory cache (max 100 results, 5-minute TTL) ───────────────────────────
_cache: TTLCache = TTLCache(maxsize=100, ttl=300)

# Per-request result store — diskcache persists across server restarts.
# Fix: in-memory dict (_result_store) was wiped on every restart, making
# GET /api/export/pdf/{id} always return 404 after a redeploy.
_CACHE_DIR = Path(os.getenv("RESULT_CACHE_DIR", ".result_cache"))
_result_store: diskcache.Cache = diskcache.Cache(
    str(_CACHE_DIR),
    size_limit=50 * 1024 * 1024,  # 50 MB cap
    eviction_policy="least-recently-used",
)
_MAX_STORED = 200  # generous limit since diskcache uses disk not RAM


# ── Lifespan (replaces deprecated @app.on_event) ──────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    keys = {
        "OPENROUTER_API_KEY": bool(os.getenv("OPENROUTER_API_KEY")),
    }
    # Validate required env vars at startup — surfaces missing keys immediately
    # instead of waiting for the first user request to fail with a 503.
    if not os.getenv("OPENROUTER_API_KEY"):
        log.error(
            "startup_missing_key",
            key="OPENROUTER_API_KEY",
            hint="Add OPENROUTER_API_KEY to your .env file. Get a free key at https://openrouter.ai/keys",
        )
    log.info("startup", **keys, version="1.3.0", result_cache=str(_CACHE_DIR))
    yield
    log.info("shutdown")


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AEO Diagnostic API",
    description="Real-time AI visibility & Answer Engine Optimisation for e-commerce brands.",
    version="1.2.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS — explicit origin, no wildcard + credentials ─────────────────────────
_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=False,   # no cookies used
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


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


class PdfExportRequest(BaseModel):
    """Strict model for PDF export payload — prevents injection via raw dict."""
    id: Optional[str] = Field(default=None, max_length=64)
    query: str = Field(..., max_length=300)
    user_brand: Optional[str] = Field(default="", max_length=120)
    responses: list[dict] = Field(default_factory=list, max_length=10)
    leaderboard: list[dict] = Field(default_factory=list, max_length=100)
    gap_analysis: Optional[dict] = None
    duration_seconds: Optional[float] = None
    generated_at: Optional[str] = None
    from_cache: Optional[bool] = False


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


def _store_result(result: dict) -> None:
    """Store result keyed by its UUID in the persistent diskcache store."""
    rid = result.get("id")
    if not rid:
        return
    _result_store.set(rid, result, expire=86400)  # 24-hour TTL per result


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
async def health():
    return {
        "status": "ok",
        "version": "1.3.0",
        "apis": {
            "openrouter": bool(os.getenv("OPENROUTER_API_KEY")),
        },
        "cache_size": len(_cache),
        "result_store_size": len(_result_store),
        "allowed_origins": _ALLOWED_ORIGINS,
    }


@app.get("/api/demo-queries", tags=["System"])
async def demo_queries():
    return {"queries": list(DEMO_RESULTS.keys())}


# ── Diagnostic ─────────────────────────────────────────────────────────────────
@app.post("/api/diagnostic", tags=["Diagnostic"])
@limiter.limit("10/minute")
async def run_diagnostic(req: DiagnosticRequest, request: Request):
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
            _store_result(cached)
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
            detail="All AI engines failed to respond. Check your OPENROUTER_API_KEY and try again.",
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

    _cache[ck] = result
    _store_result(result)
    return result


# ── PDF Export ─────────────────────────────────────────────────────────────────
@app.get("/api/export/pdf/{result_id}", tags=["Export"])
async def export_pdf_by_id(result_id: str):
    """Fetch a previously stored result by UUID and export as PDF."""
    result = _result_store.get(result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found or expired. Run a diagnostic first.")
    return await _generate_pdf_response(result)


@app.post("/api/export/pdf-from-result", tags=["Export"])
async def export_pdf_from_result(payload: PdfExportRequest):
    """Export PDF from a strictly-validated payload (no raw dict injection)."""
    return await _generate_pdf_response(payload.model_dump())


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
