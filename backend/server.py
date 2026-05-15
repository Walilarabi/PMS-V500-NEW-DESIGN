"""
FLOWTYM PMS — Backend Stub.

In Phase 1+2 the architecture is pure frontend + Supabase (Auth, RLS, Postgres).
This stub exists ONLY to satisfy the supervisor process manager.

Future use cases for this backend (later phases):
- BullMQ-style job orchestration (FEC export, billing batch, mail queue)
- Webhook receivers with HMAC validation (Stripe, channel managers)
- Operations requiring service_role_key that must NEVER be exposed to the client

SECURITY: CORS is restricted to known origins only (SECURITY_RULES §5).
Wildcard allow_origins is strictly forbidden in any environment.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="FLOWTYM Backend Stub", version="0.1.0")

# ---------------------------------------------------------------------------
# CORS — strict whitelist, never wildcard (SECURITY_RULES §5)
# Add origins via CORS_EXTRA_ORIGINS env var (comma-separated) for staging.
# ---------------------------------------------------------------------------
_DEFAULT_ORIGINS = [
    "https://flowtym.com",
    "https://www.flowtym.com",
    "https://app.flowtym.com",
]
_extra = os.environ.get("CORS_EXTRA_ORIGINS", "")
_ALLOWED_ORIGINS: list[str] = _DEFAULT_ORIGINS + [
    o.strip() for o in _extra.split(",") if o.strip()
]

# Local dev override: set CORS_ALLOW_LOCALHOST=true in .env
if os.environ.get("CORS_ALLOW_LOCALHOST", "false").lower() == "true":
    _ALLOWED_ORIGINS += ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "x-flowtym-client"],
    max_age=600,
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "flowtym-backend-stub"}


@app.get("/api/")
async def root() -> dict[str, str]:
    return {
        "service": "flowtym",
        "phase": "1-2",
        "primary_data_layer": "supabase",
    }
