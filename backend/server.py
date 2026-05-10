"""
FLOWTYM PMS — Backend Stub.

In Phase 1+2 the architecture is pure frontend + Supabase (Auth, RLS, Postgres).
This stub exists ONLY to satisfy the supervisor process manager.

Future use cases for this backend (later phases):
- BullMQ-style job orchestration (FEC export, billing batch, mail queue)
- Webhook receivers with HMAC validation (Stripe, channel managers)
- Operations requiring service_role_key that must NEVER be exposed to the client
"""
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from odms_emails import router as odms_emails_router
from fec import router as fec_router

app = FastAPI(title="FLOWTYM Backend", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(odms_emails_router)
app.include_router(fec_router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "flowtym-backend"}


@app.get("/api/")
async def root() -> dict[str, str]:
    return {
        "service": "flowtym",
        "phase": "1-2",
        "primary_data_layer": "supabase",
    }
