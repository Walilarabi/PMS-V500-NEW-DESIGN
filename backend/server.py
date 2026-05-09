"""
FLOWTYM PMS — Backend Stub.

In Phase 1+2 the architecture is pure frontend + Supabase (Auth, RLS, Postgres).
This stub exists ONLY to satisfy the supervisor process manager.

Future use cases for this backend (later phases):
- BullMQ-style job orchestration (FEC export, billing batch, mail queue)
- Webhook receivers with HMAC validation (Stripe, channel managers)
- Operations requiring service_role_key that must NEVER be exposed to the client
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="FLOWTYM Backend Stub", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
